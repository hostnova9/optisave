const db=require('./db');
const schedule=require('./schedule');
const ledger=require('./ledger');
const {lagosYMD,addYMD,lagosAt,atFive,nextDay,isWeekendYMD,firstFutureFive,normalizeFrequency,nextAllocationEvent}=schedule;
const n=v=>Math.round(Number(v||0)*100)/100;
const ref=(p,id,stamp)=>`${p}_${id}_${stamp}`;
function meta(p){return p.metadata&&typeof p.metadata==='object'?{...p.metadata}:{} }
async function txExists(c,r){return !!(await c.query('SELECT 1 FROM transactions WHERE reference=$1',[r])).rows[0]}
async function notify(c,user,title,message,type='info',url='transactions.html',sourceTx=null,eventKey=null){await c.query('INSERT INTO notifications(user_id,title,message,type,action_url,source_transaction_id,event_key) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',[user,title,message,type,url,sourceTx,eventKey])}
async function ensureDailyEvent(c,p,eventNo,due){
 const date=lagosYMD(due),amount=n(p.event_amount||p.daily_amount);
 await c.query(`INSERT INTO daily_saving_events(plan_id,user_id,schedule_date,event_no,amount,status,due_at)
  VALUES($1,$2,$3,$4,$5,'due',$6) ON CONFLICT DO NOTHING`,[p.id,p.user_id,date,eventNo,amount,due]);
 return (await c.query('SELECT * FROM daily_saving_events WHERE plan_id=$1 AND (schedule_date=$2 OR event_no=$3) ORDER BY CASE WHEN schedule_date=$2 THEN 0 ELSE 1 END LIMIT 1 FOR UPDATE',[p.id,date,eventNo])).rows[0]||null;
}
async function processDaily(c,p,w,now,m){
 const total=Math.max(1,Number(p.schedule_total_events||m.duration||1));
 let processed=Math.max(0,Number(m.processedDays||0));
 let defaulted=Math.max(0,Number(m.defaultedDays||0));
 let paidCount=Math.max(0,Number(p.schedule_completed_events||m.completedDays||0));
 let savedIncrement=0,paidIncrement=0,lastEventAt=null;
 let due=p.next_event_at?atFive(p.next_event_at):atFive(now);
 let guard=0;
 if(processed>=total){await c.query('UPDATE plans SET next_event_at=NULL,metadata=$1,updated_at=NOW() WHERE id=$2',[JSON.stringify(m),p.id]);return true}

 // A Daily Savings plan advances by eligible Lagos calendar dates only. If the server was
 // offline for several days, every missed eligible date is materialized and defaulted in
 // this same run instead of taking one minute per missed day or silently jumping dates.
 while(processed<total&&guard++<370){
  let date=lagosYMD(due);
  if(p.exclude_weekends&&isWeekendYMD(date)){due=nextDay(due,true);continue}
  const eventNo=processed+1;
  const ev=await ensureDailyEvent(c,p,eventNo,due);if(!ev)break;
  date=lagosYMD(ev.due_at||due);

  if(ev.status==='paid'||ev.status==='defaulted'){
   processed=Math.max(processed,Number(ev.event_no||eventNo));
   if(ev.status==='paid')paidCount=Math.max(paidCount,Number(ev.event_no||eventNo)-defaulted);
   due=processed>=total?null:nextDay(ev.due_at||due,p.exclude_weekends);
   if(!due)break;
   continue;
  }

  const amount=n(ev.amount),keyBase=`DAILY_${p.id}_${date}`;
  const t5=lagosAt(date,5),t12=lagosAt(date,12),t18=lagosAt(date,18),close=lagosAt(addYMD(date,1),0);

  if(now>=close){
   await notify(c,p.user_id,'Daily Savings Contribution Defaulted',`${p.plan_name} was not funded for ${date}. That day has been recorded as Defaulted; the next eligible contribution remains separate.`,'error','daily-saving-center.html',null,`${keyBase}_DEFAULT`);
   await c.query("UPDATE daily_saving_events SET status='defaulted',defaulted_at=COALESCE(defaulted_at,NOW()),final_notice_at=COALESCE(final_notice_at,NOW()),updated_at=NOW() WHERE id=$1",[ev.id]);
   processed=eventNo;defaulted+=1;m.currentDailyStatus='defaulted';m.currentDueDate=date;lastEventAt=now;
   due=processed>=total?null:nextDay(due,p.exclude_weekends);
   if(!due)break;
   continue;
  }

  // A future 05:00 event stays scheduled. Never move it another day merely because a
  // weekend was skipped earlier.
  if(now<t5){m.pendingToday=false;m.currentDailyStatus='scheduled';m.currentDueDate=date;break}

  // During the open date, collect immediately whenever the wallet becomes sufficient.
  if(Number(w.available_balance)>=amount){
   const r=`DAILY_${p.id}_DAY_${date}`;
   let tx=(await c.query('SELECT id FROM transactions WHERE reference=$1',[r])).rows[0];
   if(!tx){
    const before={...w};
    const walletAfter=(await c.query('UPDATE wallets SET available_balance=available_balance-$1,updated_at=NOW() WHERE id=$2 RETURNING *',[amount,w.id])).rows[0];
    Object.assign(w,walletAfter);
    tx=(await c.query("INSERT INTO transactions(user_id,wallet_id,plan_id,type,amount,direction,description,status,reference,metadata) VALUES($1,$2,$3,'Daily Saving',$4,'debit',$5,'completed',$6,$7) RETURNING id,reference",[p.user_id,w.id,p.id,amount,`${p.plan_name} daily contribution for ${date}`,r,JSON.stringify({engine:true,eventNumber:eventNo,totalEvents:total,scheduleDate:date})])).rows[0];
    await ledger.append(c,{userId:p.user_id,walletId:w.id,planId:p.id,transactionId:tx.id,entryType:'Daily Saving',direction:'debit',amount,idempotencyKey:`TX_${tx.id}_DEBIT`,before,after:walletAfter,metadata:{reference:tx.reference,eventNumber:eventNo,totalEvents:total,scheduleDate:date}});
   }
   await c.query("UPDATE daily_saving_events SET status='paid',paid_at=COALESCE(paid_at,NOW()),transaction_id=$1,updated_at=NOW() WHERE id=$2",[tx.id,ev.id]);
   await notify(c,p.user_id,'Daily Savings Contribution',`₦${amount.toLocaleString()} was saved into ${p.plan_name}. Contribution ${eventNo} of ${total}.`,'success','daily-saving-center.html',tx.id,`${keyBase}_PAID`);
   processed=eventNo;paidCount+=1;paidIncrement+=1;savedIncrement+=amount;lastEventAt=now;
   m.completedDays=paidCount;m.completedEvents=paidCount;m.lastDebitISO=now.toISOString();m.currentDailyStatus='paid';m.currentDueDate=date;m.pendingToday=false;
   due=processed>=total?null:nextDay(due,p.exclude_weekends);
   break;
  }

  m.pendingToday=true;m.currentDailyStatus='due';m.currentDueDate=date;
  if(now>=t5&&now<t12&&!ev.reminder_5am_at){await notify(c,p.user_id,'Daily Savings Contribution Due',`Your ${p.plan_name} contribution of ₦${amount.toLocaleString()} is due today. Fund your available balance and OptiSave will collect it automatically.`,'warning','wallet-deposit.html',null,`${keyBase}_5AM`);await c.query('UPDATE daily_saving_events SET reminder_5am_at=NOW(),updated_at=NOW() WHERE id=$1',[ev.id])}
  if(now>=t12&&now<t18&&!ev.reminder_noon_at){await notify(c,p.user_id,'Daily Savings Contribution Reminder',`Your ₦${amount.toLocaleString()} contribution for ${p.plan_name} is still unpaid. Add funds before the day closes.`,'warning','wallet-deposit.html',null,`${keyBase}_NOON`);await c.query('UPDATE daily_saving_events SET reminder_noon_at=NOW(),updated_at=NOW() WHERE id=$1',[ev.id])}
  if(now>=t18&&now<close&&!ev.reminder_6pm_at){await notify(c,p.user_id,'Daily Savings Contribution Reminder',`Your ${p.plan_name} contribution is still waiting for ₦${amount.toLocaleString()}. OptiSave will keep checking until midnight.`,'warning','wallet-deposit.html',null,`${keyBase}_6PM`);await c.query('UPDATE daily_saving_events SET reminder_6pm_at=NOW(),updated_at=NOW() WHERE id=$1',[ev.id])}
  break;
 }

 m.processedDays=processed;m.defaultedDays=defaulted;
 if(processed>=total){due=null;m.pendingToday=false}
 await c.query(`UPDATE plans SET saved_amount=saved_amount+$1,schedule_completed_events=schedule_completed_events+$2,
  last_event_at=CASE WHEN $3::timestamptz IS NULL THEN last_event_at ELSE $3 END,next_event_at=$4,metadata=$5,updated_at=NOW() WHERE id=$6`,
  [savedIncrement,paidIncrement,lastEventAt,due,JSON.stringify(m),p.id]);
 return true;
}
async function processAllocation(c,p,w,now,m){
 const total=Math.max(1,Number(p.schedule_total_events||m.allocationEvents||m.allocationDays||1));
 const frequency=normalizeFrequency(m.allocationFrequency||'daily');
 let done=Math.max(0,Number(p.schedule_completed_events||0)),remain=n(p.allocation_remaining),due=atFive(p.next_event_at),guard=0,releasedAny=false;
 const base=n(p.event_amount||m.releaseAmount||m.dailyAllocation||m.allocationPerRelease||n(p.allocation_amount)/total);
 while(remain>0&&done<total&&due&&due<=now&&guard++<1000){
  const date=lagosYMD(due);
  if(p.exclude_weekends&&isWeekendYMD(date)){due=nextDay(due,true);continue}
  // The final scheduled release absorbs any rounding remainder so the allocation pool
  // reaches exactly zero instead of leaving a few kobo for maturity.
  const amount=done+1>=total?remain:Math.min(remain,base),stamp=date,r=ref('ALLOC',p.id,stamp);
  let tx=(await c.query('SELECT id FROM transactions WHERE reference=$1',[r])).rows[0];
  if(!tx){
   const before={...w};
   const walletAfter=(await c.query('UPDATE wallets SET available_balance=available_balance+$1,total_locked=GREATEST(0,total_locked-$1),updated_at=NOW() WHERE id=$2 RETURNING *',[amount,w.id])).rows[0];
   Object.assign(w,walletAfter);
   tx=(await c.query("INSERT INTO transactions(user_id,wallet_id,plan_id,type,amount,direction,description,status,reference,metadata) VALUES($1,$2,$3,'Allocation Release',$4,'credit',$5,'completed',$6,$7) RETURNING id,reference",[p.user_id,w.id,p.id,amount,`${p.plan_name} allocation release ${done+1} of ${total}`,r,JSON.stringify({engine:true,eventNumber:done+1,totalEvents:total,scheduleDate:stamp,frequency})])).rows[0];
   await ledger.append(c,{userId:p.user_id,walletId:w.id,planId:p.id,transactionId:tx.id,entryType:'Allocation Release',direction:'credit',amount,idempotencyKey:`TX_${tx.id}_CREDIT`,before,after:walletAfter,metadata:{reference:tx.reference,eventNumber:done+1,totalEvents:total,scheduleDate:stamp,frequency}});
  }
  await notify(c,p.user_id,'Allocation released',`₦${amount.toLocaleString()} from ${p.plan_name} is now available. Release ${done+1} of ${total}.`,'success','allocation-center.html',tx.id,`ALLOC_${p.id}_${stamp}`);
  remain=Math.max(0,n(remain-amount));done=Math.min(total,done+1);releasedAny=true;
  due=remain>0&&done<total?nextAllocationEvent(due,frequency,p.exclude_weekends):null;
 }
 m.completedEvents=done;m.allocationReleased=n(p.allocation_amount)-remain;m.allocationRemaining=remain;m.nextAllocationDate=due?due.toISOString():null;m.allocationFrequency=frequency;
 await c.query('UPDATE plans SET allocation_remaining=$1,schedule_completed_events=$2,last_event_at=CASE WHEN $3::boolean THEN NOW() ELSE last_event_at END,next_event_at=$4,metadata=$5,updated_at=NOW() WHERE id=$6',[remain,done,releasedAny,due,JSON.stringify(m),p.id]);
 return true;
}
async function processPlan(id){
 const c=await db.pool.connect();
 try{await c.query('BEGIN');const p=(await c.query("SELECT * FROM plans WHERE id=$1 AND status='active' FOR UPDATE SKIP LOCKED",[id])).rows[0];if(!p){await c.query('ROLLBACK');return false}
  const w=(await c.query('SELECT * FROM wallets WHERE user_id=$1 FOR UPDATE',[p.user_id])).rows[0],now=new Date(),m=meta(p);
  const dailyProcessed=Math.max(0,Number(m.processedDays||0)),dailyTotal=Math.max(1,Number(p.schedule_total_events||m.duration||1));
  if(p.maturity_at&&new Date(p.maturity_at)<=now&&(p.plan_type!=='daily'||dailyProcessed>=dailyTotal)){
   const release=p.plan_type==='daily'?n(p.saved_amount):n(p.remaining_locked)+n(p.allocation_remaining),r=ref('MATURITY',p.id,new Date(p.maturity_at).toISOString().slice(0,10));
   if(!(await txExists(c,r))&&release>0){
    const before={...w};
    const walletAfter=(await c.query('UPDATE wallets SET available_balance=available_balance+$1,total_locked=GREATEST(0,total_locked-$2),updated_at=NOW() WHERE id=$3 RETURNING *',[release,p.plan_type==='daily'?0:release,w.id])).rows[0];
    Object.assign(w,walletAfter);
    const tx=(await c.query("INSERT INTO transactions(user_id,wallet_id,plan_id,type,amount,direction,description,status,reference,metadata) VALUES($1,$2,$3,'Plan Maturity',$4,'credit',$5,'completed',$6,$7) RETURNING id,reference",[p.user_id,w.id,p.id,release,`${p.plan_name} matured`,r,JSON.stringify({engine:true})])).rows[0];
    await ledger.append(c,{userId:p.user_id,walletId:w.id,planId:p.id,transactionId:tx.id,entryType:'Plan Maturity',direction:'credit',amount:release,idempotencyKey:`TX_${tx.id}_CREDIT`,before,after:walletAfter,metadata:{reference:tx.reference,planType:p.plan_type}});
    await notify(c,p.user_id,'Savings plan matured',`${p.plan_name} matured and ₦${release.toLocaleString()} is now available.`,'success','active-locked-plans.html',tx.id,`MATURITY_${p.id}_DONE`);
   }
   await c.query("UPDATE plans SET remaining_locked=0,allocation_remaining=0,saved_amount=CASE WHEN plan_type='daily' THEN 0 ELSE saved_amount END,status='matured',matured_at=NOW(),next_event_at=NULL,metadata=metadata||$2::jsonb,updated_at=NOW() WHERE id=$1",[p.id,JSON.stringify({status:'Matured',maturedAt:now.toISOString()})]);await c.query('COMMIT');return true}
  if(!p.next_event_at||new Date(p.next_event_at)>now){await c.query('ROLLBACK');return false}
  if(p.plan_type==='allocation'&&!m.allocationsDisabled&&n(p.allocation_remaining)>0){await processAllocation(c,p,w,now,m);await c.query('COMMIT');return true}
  if(p.plan_type==='daily'){await processDaily(c,p,w,now,m);await c.query('COMMIT');return true}
  await c.query('ROLLBACK');return false;
 }catch(e){try{await c.query('ROLLBACK')}catch(_){}throw e}finally{c.release()}}
async function repairSchedules(){
 // v1.51 also collapses the exact legacy generated name/purpose pair (for example
 // “Rent Saving” + “Rent”) into one Daily Savings plan identity.
 await db.query(`UPDATE plans SET plan_name=purpose,purpose=NULL,metadata=metadata||jsonb_build_object('goal',purpose),updated_at=NOW()
  WHERE plan_type='daily' AND purpose IS NOT NULL AND BTRIM(purpose)<>'' AND plan_name=(purpose||' Saving')`);
 const q=await db.query(`SELECT p.id,p.plan_type,p.start_at,p.created_at,p.next_event_at,p.exclude_weekends,p.metadata,p.schedule_completed_events,
  EXISTS(SELECT 1 FROM daily_saving_events d WHERE d.plan_id=p.id) AS has_daily_history,
  EXISTS(SELECT 1 FROM transactions t WHERE t.plan_id=p.id AND t.type='Allocation Release') AS has_allocation_history
  FROM plans p WHERE p.status='active' AND p.plan_type IN ('daily','allocation') AND p.next_event_at IS NOT NULL`);
 for(const p of q.rows){
  let current=atFive(p.next_event_at),changed=false;
  if(p.exclude_weekends&&isWeekendYMD(lagosYMD(current))){current=nextDay(current,true);changed=true}
  const m=meta(p),untouched=Number(p.schedule_completed_events||0)===0&&Number(m.processedDays||0)===0&&!(p.plan_type==='daily'?p.has_daily_history:p.has_allocation_history);
  if(untouched){
   const created=new Date(p.created_at||Date.now()),expected=firstFutureFive(p.start_at||p.created_at,!!p.exclude_weekends,created);
   if(expected&&expected<current){current=expected;changed=true}
  }
  if(changed)await db.query('UPDATE plans SET next_event_at=$1,metadata=metadata||$2::jsonb,updated_at=NOW() WHERE id=$3',[current,JSON.stringify(p.plan_type==='allocation'?{nextAllocationDate:current.toISOString()}:{nextDebitDate:current.toISOString()}),p.id]);
 }
 return q.rowCount;
}
async function engineState(fields){
 const sets=[],values=[];let i=1;for(const [k,v] of Object.entries(fields)){sets.push(`${k}=$${i++}`);values.push(v)}
 sets.push('updated_at=NOW()');await db.query(`UPDATE financial_engine_state SET ${sets.join(',')} WHERE singleton=TRUE`,values);
}
async function run(options={}){
 const maxBatches=Math.max(1,Math.min(20,Number(options.maxBatches||10))),batchSize=Math.max(1,Math.min(250,Number(options.batchSize||100)));
 const seen=new Set();let checked=0,processed=0,errors=0,lastError=null;
 await engineState({last_started_at:new Date(),last_checked_count:0,last_processed_count:0,last_error_count:0,last_error:null});
 try{
  for(let batch=0;batch<maxBatches;batch++){
   const q=await db.query("SELECT id FROM plans WHERE status='active' AND ((maturity_at IS NOT NULL AND maturity_at<=NOW()) OR (next_event_at IS NOT NULL AND next_event_at<=NOW())) ORDER BY COALESCE(next_event_at,maturity_at) LIMIT $1",[batchSize]);
   const rows=q.rows.filter(row=>!seen.has(String(row.id)));if(!rows.length)break;
   for(const row of rows){
    seen.add(String(row.id));checked++;
    try{if(await processPlan(row.id))processed++}catch(e){errors++;lastError=String(e?.message||e);console.error('Financial engine plan',row.id,e)}
   }
   if(q.rowCount<batchSize)break;
  }
  const now=new Date(),state={last_completed_at:now,last_checked_count:checked,last_processed_count:processed,last_error_count:errors,last_error:lastError};
  if(!errors)state.last_success_at=now;
  await engineState(state);
  return checked;
 }catch(e){
  await engineState({last_completed_at:new Date(),last_checked_count:checked,last_processed_count:processed,last_error_count:errors+1,last_error:String(e?.message||e)}).catch(()=>{});throw e;
 }
}
function start(){
 repairSchedules().then(()=>run({maxBatches:20})).catch(e=>console.error('Financial engine recovery',e));
 const t=setInterval(()=>run().catch(e=>console.error('Financial engine',e)),60000);t.unref?.();
 console.log('OptiSave financial engine started (60s scheduler + startup recovery)');
}
module.exports={run,start,nextDay,processPlan,repairSchedules};
