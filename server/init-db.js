require("dotenv").config();const fs=require("fs"),path=require("path"),bcrypt=require("bcryptjs"),db=require("./db"),schedule=require("./schedule");
const {lagosYMD,isWeekendYMD,atFive,nextDay,firstFutureFive}=schedule;
(async()=>{try{
 if(db.kind!=="pglite"&&!process.env.DATABASE_URL)throw Error("DATABASE_URL is missing");
 await db.query(fs.readFileSync(path.join(__dirname,"schema.sql"),"utf8"));
 // Backfill canonical schedule fields from legacy metadata without moving money.
 await db.query(`UPDATE plans SET schedule_total_events=CASE WHEN schedule_total_events>0 THEN schedule_total_events WHEN plan_type='daily' THEN GREATEST(1,COALESCE(NULLIF((metadata->>'duration')::int,0),1)) WHEN plan_type='allocation' THEN GREATEST(1,COALESCE(NULLIF((metadata->>'allocationDays')::int,0),1)) ELSE 0 END, schedule_completed_events=CASE WHEN schedule_completed_events>0 THEN schedule_completed_events WHEN plan_type='daily' THEN GREATEST(0,COALESCE((metadata->>'completedDays')::int,0)) WHEN plan_type='allocation' AND allocation_amount>0 THEN GREATEST(0,ROUND(((allocation_amount-allocation_remaining)/NULLIF(allocation_amount,0))*GREATEST(1,COALESCE(NULLIF((metadata->>'allocationDays')::int,0),1)))::int) ELSE 0 END, event_amount=CASE WHEN event_amount>0 THEN event_amount WHEN plan_type='daily' THEN daily_amount WHEN plan_type='allocation' THEN ROUND(allocation_amount/GREATEST(1,COALESCE(NULLIF((metadata->>'allocationDays')::int,0),1)),2) ELSE 0 END WHERE plan_type IN ('daily','allocation')`);
 // Repair legacy Lock & Allocation schedules that existed before canonical scheduler fields.
 // We derive the schedule from the plan itself/legacy metadata; no money is moved here.
 const legacyAlloc=(await db.query(`SELECT id,allocation_amount,allocation_remaining,start_at,created_at,next_event_at,exclude_weekends,metadata,schedule_total_events,event_amount FROM plans WHERE plan_type='allocation' AND status='active' AND allocation_remaining>0`)).rows;
 for(const p of legacyAlloc){
  const m=p.metadata&&typeof p.metadata==='object'?{...p.metadata}:{};
  const pool=Number(p.allocation_amount||0),remaining=Number(p.allocation_remaining||0);
  let total=Math.max(0,Number(p.schedule_total_events||0));
  const legacyDaily=Number(p.event_amount||m.dailyAllocation||m.allocationPerRelease||m.allocationPerDay||0);
  if(!total) total=Math.max(1,Math.floor(Number(m.allocationDays||m.allocationDuration||m.duration||0))||0);
  if((!total||total===1)&&legacyDaily>0&&pool>legacyDaily) total=Math.max(1,Math.ceil(pool/legacyDaily));
  if(!total) total=1;
  let event=Number(p.event_amount||0);if(!(event>0))event=legacyDaily>0?legacyDaily:Math.round((pool/total)*100)/100;
  let next=p.next_event_at?atFive(p.next_event_at):null;
  if(!next||Number.isNaN(next.getTime())){
   const raw=m.nextAllocationDate||m.allocationStartDate||m.startDate||p.start_at||p.created_at||new Date();
   next=firstFutureFive(raw,p.exclude_weekends,new Date());
  }else if(p.exclude_weekends&&isWeekendYMD(lagosYMD(next))){next=nextDay(next,true)}
  const completed=pool>0?Math.max(0,Math.min(total,Math.round(((pool-remaining)/pool)*total))):0;
  m.allocationDays=total;m.dailyAllocation=event;m.completedEvents=completed;m.allocationRemaining=remaining;m.nextAllocationDate=next.toISOString();
  await db.query(`UPDATE plans SET schedule_total_events=$1,schedule_completed_events=GREATEST(schedule_completed_events,$2),event_amount=$3,next_event_at=$4,metadata=$5,updated_at=NOW() WHERE id=$6`,[total,completed,event,next,JSON.stringify(m),p.id]);
 }
 // v1.51: collapse the exact legacy generated Daily Savings name/purpose pair into one
 // plan identity. This only changes rows produced by the old “<goal> Saving” pattern.
 await db.query(`UPDATE plans SET plan_name=purpose,purpose=NULL,metadata=metadata||jsonb_build_object('goal',purpose),updated_at=NOW()
  WHERE plan_type='daily' AND purpose IS NOT NULL AND BTRIM(purpose)<>'' AND plan_name=(purpose||' Saving')`);
 // v1.51: repair a first-event date that was accidentally pushed one extra day after a
 // weekend. Only untouched schedules are considered, so legitimate Tuesday events after
 // a processed Monday are never moved backwards. No money is moved here.
 const untouched=(await db.query(`SELECT id,plan_type,start_at,created_at,next_event_at,exclude_weekends,metadata,schedule_completed_events
  FROM plans WHERE status='active' AND plan_type IN ('daily','allocation') AND next_event_at IS NOT NULL AND schedule_completed_events=0`)).rows;
 for(const p of untouched){
  const m=p.metadata&&typeof p.metadata==='object'?p.metadata:{};
  if(Number(m.processedDays||0)>0)continue;
  const history=p.plan_type==='daily'
   ?(await db.query('SELECT 1 FROM daily_saving_events WHERE plan_id=$1 LIMIT 1',[p.id])).rowCount
   :(await db.query("SELECT 1 FROM transactions WHERE plan_id=$1 AND type='Allocation Release' LIMIT 1",[p.id])).rowCount;
  if(history)continue;
  const created=new Date(p.created_at||Date.now()),base=p.start_at||p.created_at||created;
  const expected=firstFutureFive(base,!!p.exclude_weekends,created),current=new Date(p.next_event_at);
  if(expected&&current&&expected<current){
   await db.query('UPDATE plans SET next_event_at=$1,metadata=metadata||$2::jsonb,updated_at=NOW() WHERE id=$3',[expected,JSON.stringify(p.plan_type==='allocation'?{nextAllocationDate:expected.toISOString()}:{nextDebitDate:expected.toISOString()}),p.id]);
  }
 }
 // v1.52: Start Now is anchored to the exact creation instant. v1.51 and older
 // normalized start_at to 05:00 of the creation date, which could make a weekend plan
 // look older than it really was. This is bookkeeping only and never moves money.
 await db.query(`UPDATE plans SET start_at=created_at,updated_at=NOW()
  WHERE status='active' AND plan_type IN ('daily','allocation','lock')
    AND ((metadata->>'startMode')='now' OR (plan_type='lock' AND COALESCE(metadata->>'startDate','') LIKE '%T%'))
    AND ABS(EXTRACT(EPOCH FROM (created_at-start_at)))>60`);
 // For an untouched Lock & Allocation Start Now plan, also make maturity use the exact
 // creation timestamp. The first release remains the first eligible 05:00 after creation.
 const exactStartAlloc=(await db.query(`SELECT id,created_at,exclude_weekends,metadata,schedule_completed_events
  FROM plans WHERE status='active' AND plan_type='allocation' AND (metadata->>'startMode')='now'
    AND schedule_completed_events=0`)).rows;
 for(const p of exactStartAlloc){
  const history=(await db.query("SELECT 1 FROM transactions WHERE plan_id=$1 AND type='Allocation Release' LIMIT 1",[p.id])).rowCount;
  if(history)continue;
  const m=p.metadata&&typeof p.metadata==='object'?p.metadata:{};
  const duration=Math.max(1,Math.floor(Number(m.duration||1)));
  const created=new Date(p.created_at),expected=firstFutureFive(created,!!p.exclude_weekends,created);
  const maturity=new Date(created.getTime()+duration*86400000);
  await db.query('UPDATE plans SET start_at=$1,maturity_at=$2,next_event_at=$3,metadata=metadata||$4::jsonb,updated_at=NOW() WHERE id=$5',
   [created,maturity,expected,JSON.stringify({nextAllocationDate:expected.toISOString(),scheduleAnchor:'exact-creation-v1.52'}),p.id]);
 }
 // v1.30: prevent an already-contributed Daily Saving plan from consuming another event on the same Lagos calendar day.
 await db.query(`UPDATE plans p SET next_event_at=((date_trunc('day', NOW() AT TIME ZONE 'Africa/Lagos') + interval '1 day' + CASE WHEN p.exclude_weekends AND EXTRACT(DOW FROM (NOW() AT TIME ZONE 'Africa/Lagos')::date + 1)=6 THEN interval '2 day' WHEN p.exclude_weekends AND EXTRACT(DOW FROM (NOW() AT TIME ZONE 'Africa/Lagos')::date + 1)=0 THEN interval '1 day' ELSE interval '0 day' END + interval '5 hour') AT TIME ZONE 'Africa/Lagos'), updated_at=NOW() WHERE p.plan_type='daily' AND p.status='active' AND p.next_event_at<=NOW() AND EXISTS (SELECT 1 FROM transactions t WHERE t.plan_id=p.id AND t.type='Daily Saving' AND t.status='completed' AND t.amount>0 AND (t.created_at AT TIME ZONE 'Africa/Lagos')::date=(NOW() AT TIME ZONE 'Africa/Lagos')::date)`);
 // v1.28: reconcile confirmed duplicate Daily Saving debits from older scheduler builds.
 // A Daily Saving plan is allowed at most one contribution per calendar day. We keep the
 // earliest completed debit for that plan/day, refund later same-day duplicates, preserve
 // them in the ledger as reversed, and canonicalize legitimate events to EVENT_N references.
 const dailyPlans=(await db.query(`SELECT id,user_id,saved_amount,schedule_total_events,schedule_completed_events,metadata FROM plans WHERE plan_type='daily'`)).rows;
 for(const p of dailyPlans){
  const txs=(await db.query(`SELECT id,wallet_id,amount,reference,created_at FROM transactions WHERE plan_id=$1 AND type='Daily Saving' AND amount>0 AND status='completed' ORDER BY created_at,id`,[p.id])).rows;
  if(!txs.length)continue;
  const kept=[],dupes=[],seen=new Set();
  for(const t of txs){const day=lagosYMD(t.created_at);if(seen.has(day))dupes.push(t);else{seen.add(day);kept.push(t)}}
  // Move legacy references out of the canonical namespace before assigning EVENT_N.
  for(const t of txs)await db.query(`UPDATE transactions SET reference=$1 WHERE id=$2 AND reference<>$1`,[`LEGACY_DAILY_${p.id}_${t.id}`,t.id]);
  for(let i=0;i<kept.length;i++)await db.query(`UPDATE transactions SET reference=$1,metadata=metadata||$2::jsonb WHERE id=$3`,[`DAILY_${p.id}_EVENT_${i+1}`,JSON.stringify({eventNumber:i+1,reconciledBy:'v1.28'}),kept[i].id]);
  let refund=0;
  for(const t of dupes){
   const amount=Number(t.amount||0);refund+=amount;
   await db.query(`DELETE FROM notifications WHERE source_transaction_id=$1`,[t.id]);
   await db.query(`UPDATE transactions SET status='reversed',description=COALESCE(description,'')||' [duplicate scheduler debit reversed by v1.28]',metadata=metadata||$1::jsonb WHERE id=$2`,[JSON.stringify({duplicate:true,reversedBy:'v1.28'}),t.id]);
   const rr=`DAILY_DUPLICATE_REVERSAL_${t.id}`;
   await db.query(`INSERT INTO transactions(user_id,wallet_id,plan_id,type,amount,direction,description,status,reference,metadata) VALUES($1,$2,$3,'Daily Saving Duplicate Reversal',$4,'credit','Automatic refund of duplicate Daily Saving debit','completed',$5,$6) ON CONFLICT(reference) DO NOTHING`,[p.user_id,t.wallet_id,p.id,amount,rr,JSON.stringify({engine:true,reversalOf:t.id})]);
  }
  if(refund>0){
   await db.query(`UPDATE wallets SET available_balance=available_balance+$1,updated_at=NOW() WHERE user_id=$2`,[refund,p.user_id]);
   await db.query(`INSERT INTO notifications(user_id,title,message,type,action_url) VALUES($1,'Daily saving duplicate corrected',$2,'success','daily-saving-center.html')`,[p.user_id,`₦${refund.toLocaleString()} from duplicate Daily Saving deduction(s) was returned to your available balance.`]);
  }
  const completed=kept.length,m=p.metadata&&typeof p.metadata==='object'?{...p.metadata}:{};
  m.completedDays=completed;m.completedEvents=completed;
  await db.query(`UPDATE plans SET saved_amount=GREATEST(0,saved_amount-$1),schedule_completed_events=$2,metadata=$3,updated_at=NOW() WHERE id=$4`,[refund,completed,JSON.stringify(m),p.id]);
 }
 // v1.47: seed the Daily Savings day ledger from legitimate historical paid contributions.
 // This is bookkeeping only; it never moves wallet money.
 await db.query(`INSERT INTO daily_saving_events(plan_id,user_id,schedule_date,event_no,amount,status,due_at,paid_at,transaction_id)
  SELECT t.plan_id,t.user_id,(t.created_at AT TIME ZONE 'Africa/Lagos')::date,
   ROW_NUMBER() OVER(PARTITION BY t.plan_id ORDER BY t.created_at,t.id),t.amount,'paid',
   ((((t.created_at AT TIME ZONE 'Africa/Lagos')::date + time '05:00')) AT TIME ZONE 'Africa/Lagos'),t.created_at,t.id
  FROM transactions t JOIN plans p ON p.id=t.plan_id
  WHERE p.plan_type='daily' AND t.type='Daily Saving' AND t.status='completed' AND t.amount>0
  ON CONFLICT(plan_id,schedule_date) DO NOTHING`);
 await db.query(`UPDATE plans SET metadata=metadata||jsonb_build_object('processedDays',schedule_completed_events,'defaultedDays',COALESCE((metadata->>'defaultedDays')::int,0)) WHERE plan_type='daily' AND NOT (metadata ? 'processedDays')`);

 // v1.33: reconcile KYC and withdrawal-bank state for users already verified by Paystack.
 // No money is moved. A verified KYC state makes the linked primary bank verified; withdrawal
 // readiness still requires the Paystack recipient code prepared from the account during KYC.
 const bankSync=await db.query(`UPDATE bank_accounts b SET is_verified=true FROM kyc_profiles k WHERE b.user_id=k.user_id AND b.is_primary=true AND b.is_verified=false AND (k.status='verified' OR k.provider_status='verified') RETURNING b.id,b.user_id,b.provider_recipient_code`);
 if(bankSync.rowCount)console.log(`KYC withdrawal-bank reconciliation: ${bankSync.rowCount} account(s) marked verified.`);
 const notReady=bankSync.rows.filter(r=>!r.provider_recipient_code).length;
 if(notReady)console.log(`KYC withdrawal-bank reconciliation: ${notReady} verified account(s) still need a Paystack recipient code; re-save/re-verify bank details for those accounts.`);

 // Repair ledger events from older builds that moved money but did not create a matching notification.
 await db.query(`UPDATE notifications n SET title='Daily Savings Contribution',action_url='daily-saving-center.html' FROM transactions t WHERE n.source_transaction_id=t.id AND t.type='Daily Saving' AND t.amount>0 AND t.status='completed' AND n.title IN ('Daily saving recorded','Daily saving paid')`);
 // One successful Daily Savings debit has one customer-facing contribution notification.
 // Repair only missing contribution notifications; do not create a second 'recorded' event.
 await db.query(`INSERT INTO notifications(user_id,title,message,type,action_url,source_transaction_id,event_key)
  SELECT t.user_id,'Daily Savings Contribution','₦'||TRIM(TO_CHAR(t.amount,'FM999999999999990.00'))||' was saved into '||COALESCE(p.plan_name,'your Daily Savings plan')||'.','success','daily-saving-center.html',t.id,
   'DAILY_'||t.plan_id||'_'||TO_CHAR((t.created_at AT TIME ZONE 'Africa/Lagos')::date,'YYYY-MM-DD')||'_PAID'
  FROM transactions t LEFT JOIN plans p ON p.id=t.plan_id
  WHERE t.type='Daily Saving' AND t.amount>0 AND t.status='completed'
   AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.source_transaction_id=t.id)
  ON CONFLICT DO NOTHING`);
 // v1.48: old zero-value Daily Saving Default rows duplicated the canonical day ledger.
 // They never moved money, so remove them from the financial transaction feed; daily_saving_events keeps the default history.
 await db.query(`DELETE FROM transactions WHERE type='Daily Saving Default' AND amount=0 AND direction='none'`);
 // v1.50: Daily Savings is represented by contribution-day events, not a separate plan-created notification.
 // Remove only the legacy creation notices; no financial transaction or contribution history is touched.
 await db.query(`DELETE FROM notifications n USING plans p WHERE n.user_id=p.user_id AND p.plan_type='daily' AND n.event_key=('DAILY_'||p.id||'_CREATED')`);
 await db.query(`UPDATE notifications SET title='Daily Savings Contribution Due' WHERE title='Daily saving is due'`);
 await db.query(`UPDATE notifications SET title='Daily Savings Contribution Reminder' WHERE title IN ('Daily saving reminder','Daily saving evening reminder')`);
 await db.query(`UPDATE notifications SET title='Daily Savings Contribution Defaulted' WHERE title='Daily saving defaulted'`);
 // Canonicalize active allocation schedule time to 05:00 Africa/Lagos without moving money.
 await db.query(`UPDATE plans SET next_event_at=(((next_event_at AT TIME ZONE 'Africa/Lagos')::date + time '05:00') AT TIME ZONE 'Africa/Lagos'), updated_at=NOW() WHERE plan_type='allocation' AND status='active' AND next_event_at IS NOT NULL AND (next_event_at AT TIME ZONE 'Africa/Lagos')::time <> time '05:00'`);
 const email=String(process.env.ADMIN_EMAIL||"").trim().toLowerCase(),password=String(process.env.ADMIN_PASSWORD||"");
 if(email&&password){
  if(password.length<10)throw Error("ADMIN_PASSWORD must be at least 10 characters");
  const hash=await bcrypt.hash(password,12);
  await db.query(`INSERT INTO admins(email,password_hash,full_name,role) VALUES($1,$2,$3,'super_admin')
   ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,updated_at=NOW()`,
   [email,hash,String(process.env.ADMIN_NAME||"OptiSave Administrator")]);
  console.log("Admin account initialized:",email);
 }else console.log("Admin account not seeded (set ADMIN_EMAIL and ADMIN_PASSWORD in .env).");
 console.log("OptiSave database initialized.");await db.pool.end()
}catch(e){console.error(e.message);process.exit(1)}})();