const r=require("express").Router(),db=require("../db"),auth=require("../middleware/auth"),crypto=require("crypto"),bcrypt=require("bcryptjs");
const ledger=require("../ledger"),idem=require("../idempotency"),paymentMode=require("../payment-mode");
const schedule=require("../schedule");
const {lagosYMD,addYMD,lagosAt,isWeekendYMD,atFive,nextDay:nextSavingDay,firstEligibleYMD,nextEligibleYMD,firstEligibleFive,firstFutureFive,normalizeFrequency,nextAllocationEvent,countAllocationEvents,finalSavingDate}=schedule;
const identityFingerprint=value=>crypto.createHmac("sha256",String(process.env.IDENTITY_FINGERPRINT_KEY||process.env.JWT_SECRET)).update(String(value)).digest("hex");
const normalizePhone=v=>{let p=String(v||"").trim().replace(/[^0-9+]/g,"");if(p.startsWith("00"))p="+"+p.slice(2);if(p.startsWith("0")&&p.length===11)p="+234"+p.slice(1);if(/^234\d{10}$/.test(p))p="+"+p;return p||null};
r.use(auth);
async function requirePin(userId,pin){const u=(await db.query("SELECT transaction_pin_hash FROM users WHERE id=$1",[userId])).rows[0];return !!(u&&u.transaction_pin_hash&&await bcrypt.compare(String(pin||""),u.transaction_pin_hash));}

const money=v=>{
  const n=Number(v);
  if(!Number.isFinite(n)||n<=0) return null;
  return Math.round(n*100)/100;
};
const ref=prefix=>`${prefix}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
const round2=v=>Math.round(Number(v||0)*100)/100;

r.get("/payments/mode",async(req,res,next)=>{try{res.json(await paymentMode.statusForUser(db,req.user.sub))}catch(e){next(e)}});

r.get("/wallet",async(req,res,next)=>{try{
  const q=await db.query("SELECT id,user_id,available_balance,total_deposited,total_withdrawn,total_locked,total_credited,updated_at FROM wallets WHERE user_id=$1",[req.user.sub]);
  res.json({wallet:q.rows[0]||null});
}catch(e){next(e)}});

r.get("/plans",async(req,res,next)=>{try{const q=await db.query("SELECT * FROM plans WHERE user_id=$1 ORDER BY created_at DESC",[req.user.sub]);res.json({plans:q.rows})}catch(e){next(e)}});
r.get("/plans/:id",async(req,res,next)=>{try{const p=await db.query("SELECT * FROM plans WHERE id=$1 AND user_id=$2",[req.params.id,req.user.sub]);if(!p.rows[0])return res.status(404).json({error:"Plan not found"});const t=await db.query("SELECT * FROM transactions WHERE plan_id=$1 AND user_id=$2 ORDER BY created_at DESC",[req.params.id,req.user.sub]);res.json({plan:p.rows[0],transactions:t.rows})}catch(e){next(e)}});
r.get("/plans/:id/daily-events",async(req,res,next)=>{try{
 const p=(await db.query("SELECT * FROM plans WHERE id=$1 AND user_id=$2 AND plan_type='daily'",[req.params.id,req.user.sub])).rows[0];
 if(!p)return res.status(404).json({error:"Daily Savings plan not found"});
 const q=await db.query("SELECT schedule_date,event_no,amount,status,due_at,paid_at,defaulted_at,reminder_5am_at,reminder_noon_at,reminder_6pm_at,final_notice_at FROM daily_saving_events WHERE plan_id=$1 ORDER BY schedule_date ASC LIMIT 730",[req.params.id]);
 const events=q.rows,m=p.metadata&&typeof p.metadata==='object'?p.metadata:{},total=Math.max(1,Number(p.schedule_total_events||m.duration||1)),exclude=!!p.exclude_weekends,amount=Number(p.event_amount||p.daily_amount||0),today=lagosYMD();
 const actual=new Map(events.map(e=>[String(e.schedule_date).slice(0,10),e]));
 let ymd=firstEligibleYMD(lagosYMD(m.scheduleStartAt||p.start_at||p.created_at),exclude),scheduleRows=[];
 for(let i=1;i<=Math.min(total,730);i++){
   const found=actual.get(ymd),isToday=ymd===today;
   let status=found?.status||'upcoming';
   if(!found&&isToday&&m.currentDueDate===ymd&&m.currentDailyStatus==='due')status='due';
   else if(!found&&ymd<today)status='processing';
   scheduleRows.push({schedule_date:ymd,event_no:i,amount:found?Number(found.amount):amount,status,due_at:(found?.due_at||atFive(ymd)).toISOString? (found?.due_at||atFive(ymd)).toISOString():found?.due_at,paid_at:found?.paid_at||null,defaulted_at:found?.defaulted_at||null,is_recorded:!!found});
   ymd=nextEligibleYMD(ymd,exclude);
 }
 res.json({events,schedule:scheduleRows,totalEvents:total});
}catch(e){next(e)}});

r.get("/transactions",async(req,res,next)=>{try{const q=await db.query("SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200",[req.user.sub]);res.json({transactions:q.rows})}catch(e){next(e)}});
r.get("/notifications",async(req,res,next)=>{try{const q=await db.query("SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",[req.user.sub]);res.json({notifications:q.rows})}catch(e){next(e)}});

/*
 Development wallet simulator.
 This is intentionally disabled unless ENABLE_DEV_WALLET=true AND NODE_ENV=development.
 A real payment provider must replace /wallet/dev-deposit and /wallet/dev-withdraw before production.
*/
r.post("/wallet/dev-deposit",async(req,res,next)=>{
 if(paymentMode.mode()!=="test"||process.env.NODE_ENV!=="development"||process.env.ENABLE_DEV_WALLET!=="true") return res.status(404).json({error:"Not available"});
 const amount=money(req.body.amount); if(!amount)return res.status(400).json({error:"Enter a valid amount"});
 const client=await db.pool.connect();
 try{
  await client.query("BEGIN");
  const claim=await idem.begin(client,req,'dev-deposit');
  if(claim.replayed){await client.query("COMMIT");return res.status(claim.statusCode).json(claim.response)}
  const w=(await client.query("SELECT * FROM wallets WHERE user_id=$1 FOR UPDATE",[req.user.sub])).rows[0];
  if(!w) throw Error("Wallet not found");
  const reference=ref("DEVDEP");
  const nw=(await client.query("UPDATE wallets SET available_balance=available_balance+$1,total_deposited=total_deposited+$1,updated_at=NOW() WHERE id=$2 RETURNING *",[amount,w.id])).rows[0];
  const tx=(await client.query("INSERT INTO transactions(user_id,wallet_id,type,amount,direction,description,status,reference,metadata) VALUES($1,$2,'Deposit',$3,'credit','Development wallet deposit','completed',$4,$5) RETURNING *",[req.user.sub,w.id,amount,reference,JSON.stringify({development:true})])).rows[0];
  await ledger.append(client,{userId:req.user.sub,walletId:w.id,transactionId:tx.id,entryType:'Development Deposit',direction:'credit',amount,idempotencyKey:`TX_${tx.id}_CREDIT`,before:w,after:nw,metadata:{reference:tx.reference,development:true}});
  await client.query("INSERT INTO notifications(user_id,title,message,type,action_url) VALUES($1,'Deposit successful',$2,'success','transactions.html')",[req.user.sub,`₦${amount.toLocaleString()} was added to your available balance.`]);
  const response={wallet:nw,transaction:tx};await idem.finish(client,claim,200,response);
  await client.query("COMMIT");res.json(response);
 }catch(e){await client.query("ROLLBACK");next(e)}finally{client.release()}
});

r.post("/wallet/dev-withdraw",async(req,res,next)=>{
 if(paymentMode.mode()!=="test"||process.env.NODE_ENV!=="development"||process.env.ENABLE_DEV_WALLET!=="true") return res.status(404).json({error:"Not available"});
 const amount=money(req.body.amount); if(!amount)return res.status(400).json({error:"Enter a valid amount"});
 const client=await db.pool.connect();
 try{
  await client.query("BEGIN");
  const claim=await idem.begin(client,req,'dev-withdraw');
  if(claim.replayed){await client.query("COMMIT");return res.status(claim.statusCode).json(claim.response)}
  const w=(await client.query("SELECT * FROM wallets WHERE user_id=$1 FOR UPDATE",[req.user.sub])).rows[0];
  if(!w) throw Error("Wallet not found");
  if(Number(w.available_balance)<amount){await client.query("ROLLBACK");return res.status(400).json({error:"Insufficient available balance"})}
  const reference=ref("DEVWDR");
  const nw=(await client.query("UPDATE wallets SET available_balance=available_balance-$1,total_withdrawn=total_withdrawn+$1,updated_at=NOW() WHERE id=$2 RETURNING *",[amount,w.id])).rows[0];
  const tx=(await client.query("INSERT INTO transactions(user_id,wallet_id,type,amount,direction,description,status,reference,metadata) VALUES($1,$2,'Withdrawal',$3,'debit',$4,'completed',$5,$6) RETURNING *",[req.user.sub,w.id,amount,String(req.body.note||"Development wallet withdrawal").slice(0,160),reference,JSON.stringify({development:true})])).rows[0];
  await ledger.append(client,{userId:req.user.sub,walletId:w.id,transactionId:tx.id,entryType:'Development Withdrawal',direction:'debit',amount,idempotencyKey:`TX_${tx.id}_DEBIT`,before:w,after:nw,metadata:{reference:tx.reference,development:true}});
  await client.query("INSERT INTO notifications(user_id,title,message,type,action_url) VALUES($1,'Withdrawal recorded',$2,'info','transactions.html')",[req.user.sub,`₦${amount.toLocaleString()} was withdrawn from your available balance.`]);
  const response={wallet:nw,transaction:tx};await idem.finish(client,claim,200,response);
  await client.query("COMMIT");res.json(response);
 }catch(e){try{await client.query("ROLLBACK")}catch(_){}next(e)}finally{client.release()}
});

/* Transitional unified-state bridge.
   PostgreSQL remains persistent storage while legacy UI pages are migrated.
   The browser cannot select another user: every row is scoped to req.user.sub. */
r.get("/state",async(req,res,next)=>{try{
 // One PostgreSQL round-trip instead of four. This matters when the app server
 // and hosted database are separated by network latency. History is bounded to
 // the same practical limits used by the dedicated endpoints.
 const q=await db.query(`
  SELECT
   (SELECT row_to_json(w) FROM wallets w WHERE w.user_id=$1) AS wallet,
   COALESCE((SELECT json_agg(p ORDER BY p.created_at) FROM plans p WHERE p.user_id=$1),'[]'::json) AS plans,
   COALESCE((SELECT json_agg(t ORDER BY t.created_at DESC) FROM (SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200) t),'[]'::json) AS transactions,
   COALESCE((SELECT json_agg(n ORDER BY n.created_at DESC) FROM (SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100) n),'[]'::json) AS notifications,
   COALESCE((SELECT json_build_object(
     'activePlanCount',COUNT(*),
     'lockPlanCount',COUNT(*) FILTER (WHERE plan_type='lock'),
     'allocationPlanCount',COUNT(*) FILTER (WHERE plan_type='allocation'),
     'dailyPlanCount',COUNT(*) FILTER (WHERE plan_type='daily'),
     'remainingLocked',COALESCE(SUM(remaining_locked),0),
     'allocationRemaining',COALESCE(SUM(allocation_remaining),0),
     'dailySaved',COALESCE(SUM(saved_amount) FILTER (WHERE plan_type='daily'),0)
   ) FROM plans WHERE user_id=$1 AND status='active'),'{}'::json) AS financial_summary
 `,[req.user.sub]);
 const x=q.rows[0]||{};
 res.json({wallet:x.wallet||null,plans:x.plans||[],transactions:x.transactions||[],notifications:x.notifications||[],financialSummary:x.financial_summary||{}});
}catch(e){next(e)}});

/* Financial consistency report: read-only and safe in every environment. */
r.get("/financial-audit",async(req,res,next)=>{try{
 const q=await db.query(`SELECT w.available_balance,w.total_deposited,w.total_withdrawn,w.total_locked,
  COALESCE(SUM(CASE WHEN p.status='active' AND p.plan_type IN ('lock','allocation') THEN p.remaining_locked+p.allocation_remaining ELSE 0 END),0) AS plans_locked,
  COALESCE(SUM(CASE WHEN p.status='active' AND p.plan_type='daily' THEN p.saved_amount ELSE 0 END),0) AS daily_saved,
  COUNT(*) FILTER (WHERE p.status='active') AS active_plans
 FROM wallets w LEFT JOIN plans p ON p.user_id=w.user_id WHERE w.user_id=$1 GROUP BY w.id`,[req.user.sub]);
 const a=q.rows[0]||{},walletLocked=Number(a.total_locked||0),plansLocked=Number(a.plans_locked||0);
 const ledgerStats=(await db.query(`SELECT COUNT(*)::int AS entries,COUNT(*) FILTER(WHERE available_before IS NOT NULL AND available_after IS NOT NULL)::int AS snapshot_entries FROM financial_ledger WHERE user_id=$1`,[req.user.sub])).rows[0]||{};
 const missing=(await db.query(`SELECT COUNT(*)::int AS n FROM transactions t WHERE t.user_id=$1 AND t.amount>0 AND (t.status='completed' OR (t.type='Withdrawal' AND t.status='pending' AND COALESCE(t.metadata->>'reserved','false')='true')) AND NOT EXISTS(SELECT 1 FROM financial_ledger l WHERE l.transaction_id=t.id)`,[req.user.sub])).rows[0]?.n||0;
 const withdrawalState=(await db.query(`SELECT
   COUNT(*) FILTER(WHERE status='pending' AND COALESCE(metadata->>'reserved','false')='true')::int AS reserved_pending,
   COUNT(*) FILTER(WHERE status='pending' AND COALESCE(metadata->>'needs_reconciliation','false')='true')::int AS needs_reconciliation
  FROM transactions WHERE user_id=$1 AND type='Withdrawal'`,[req.user.sub])).rows[0]||{};
 const engine=(await db.query('SELECT last_started_at,last_completed_at,last_success_at,last_checked_count,last_processed_count,last_error_count,last_error,updated_at FROM financial_engine_state WHERE singleton=TRUE')).rows[0]||null;
 const difference=Math.round((walletLocked-plansLocked)*100)/100,reconciliation=Number(withdrawalState.needs_reconciliation||0),ok=Math.abs(difference)<0.01&&Number(missing)===0&&reconciliation===0;
 res.json({ok,wallet:{available:Number(a.available_balance||0),totalDeposited:Number(a.total_deposited||0),totalWithdrawn:Number(a.total_withdrawn||0),totalLocked:walletLocked},plans:{locked:plansLocked,dailySaved:Number(a.daily_saved||0),active:Number(a.active_plans||0)},difference,ledger:{entries:Number(ledgerStats.entries||0),snapshotEntries:Number(ledgerStats.snapshot_entries||0),transactionsMissingLedger:Number(missing)},withdrawals:{reservedPending:Number(withdrawalState.reserved_pending||0),needsReconciliation:reconciliation},engine});
}catch(e){next(e)}});

r.get('/financial-engine/status',async(req,res,next)=>{try{const state=(await db.query('SELECT * FROM financial_engine_state WHERE singleton=TRUE')).rows[0]||null;res.json({engine:state})}catch(e){next(e)}});

r.post("/plans",async(req,res,next)=>{
 const x=req.body||{},type=String(x.type||"").toLowerCase();
 if(!["lock","allocation","daily"].includes(type))return res.status(400).json({error:"Invalid plan type"});
 const client=await db.pool.connect();
 try{
  await client.query("BEGIN");
  const claim=await idem.begin(client,req,'create-plan');
  if(claim.replayed){await client.query("COMMIT");return res.status(claim.statusCode).json(claim.response)}
  const w=(await client.query("SELECT * FROM wallets WHERE user_id=$1 FOR UPDATE",[req.user.sub])).rows[0];
  if(!w)throw Error("Wallet not found");
  const now=new Date(),name=String(x.planName||"Savings Plan").slice(0,160),purpose=String(x.purpose||"").slice(0,1000);
  const duration=Math.max(1,Math.floor(Number(x.duration||1))),exclude=!!x.excludeWeekend;
  let original=0,locked=0,ap=0,aa=0,ar=0,saved=0,daily=0,debit=0,next=null,maturity=null,eventAmount=0,totalEvents=0,completedEvents=0;
  let allocationFrequency='daily',dailyPendingNow=false,dailyDueDate=null,dailyScheduleFirst=null;
  const startMode=String(x.startMode||"now").toLowerCase()==="later"?"later":"now";
  let start;
  if(startMode==="later"&&x.startDate){
    const requested=atFive(String(x.startDate).slice(0,10))||new Date(x.startDate);
    // A same-day scheduled time that has already passed cannot consume hours before the
    // plan exists. It becomes a current-time anchor and the first event stays the next 5 AM.
    start=requested&&requested>now?requested:now;
  }else start=now;
  if(Number.isNaN(start.getTime()))start=now;

  if(type==="lock"){
    original=money(x.amount);if(!original)throw Object.assign(Error("Enter a valid lock amount"),{status:400});
    debit=original;locked=original;maturity=new Date(start.getTime()+duration*86400000);
  }else if(type==="allocation"){
    original=money(x.amount);ap=Number(x.allocationPercent);allocationFrequency=normalizeFrequency(x.allocationFrequency||'daily');
    if(!original||!Number.isFinite(ap)||ap<10||ap>80)throw Object.assign(Error("Enter a valid amount and allocation percentage (10–80%)"),{status:400});
    aa=round2(original*ap/100);ar=aa;locked=round2(original-aa);debit=original;
    maturity=new Date(start.getTime()+duration*86400000);
    // Allocation never releases at creation. The first release is always the next eligible
    // Lagos 05:00. Weekend-created plans therefore count only the real hours left to Monday.
    next=firstFutureFive(start,exclude,now);
    totalEvents=countAllocationEvents(next,maturity,allocationFrequency,exclude);
    if(totalEvents<1)throw Object.assign(Error("The selected duration is too short for an allocation release schedule."),{status:400});
    eventAmount=round2(aa/totalEvents);
  }else{
    daily=money(x.dailyAmount);if(!daily)throw Object.assign(Error("Enter a valid daily amount"),{status:400});
    original=round2(daily*duration);totalEvents=duration;eventAmount=daily;
    const todayYMD=lagosYMD(now),todayFive=atFive(todayYMD),todayEligible=!exclude||!isWeekendYMD(todayYMD);
    const startNowWindow=startMode==="now"&&todayEligible&&now>=todayFive;

    if(startNowWindow){
      dailyScheduleFirst=todayFive;
      dailyDueDate=todayYMD;
      if(Number(w.available_balance)>=daily){
        debit=daily;saved=daily;completedEvents=1;
        next=completedEvents>=totalEvents?null:nextSavingDay(todayFive,exclude);
      }else{
        // Due immediately. Keeping next_event_at due now makes the engine re-check the
        // wallet every scheduler pass until the saving day closes at midnight.
        dailyPendingNow=true;next=now;
      }
    }else if(startMode==="now"){
      // Before 5 AM, or on an excluded weekend, nothing is charged early.
      next=firstFutureFive(start,exclude,new Date(now.getTime()-1));dailyScheduleFirst=next;
    }else{
      next=firstFutureFive(start,exclude,now);dailyScheduleFirst=next;
    }

    if(!dailyScheduleFirst)dailyScheduleFirst=firstEligibleFive(start,exclude)||atFive(now);
    const finalFive=finalSavingDate(dailyScheduleFirst,totalEvents,exclude),finalYMD=lagosYMD(finalFive);
    maturity=lagosAt(addYMD(finalYMD,1),0,1,0); // final saving day closes first
  }

  if(Number(w.available_balance)<debit)throw Object.assign(Error("Insufficient available balance"),{status:400});
  let walletAfter=w;
  if(debit>0)walletAfter=(await client.query("UPDATE wallets SET available_balance=available_balance-$1,total_locked=total_locked+$2,updated_at=NOW() WHERE id=$3 RETURNING *",[debit,(type==="lock"||type==="allocation")?debit:0,w.id])).rows[0];

  const meta={...x,type,duration,amount:original,totalAmount:original,savedAmount:saved,remainingLocked:locked,allocationAmount:aa,allocationRemaining:ar,status:"Active",completedDays:completedEvents,completedEvents,totalEvents,eventAmount,
    allocationFrequency:type==="allocation"?allocationFrequency:undefined,releaseAmount:type==="allocation"?eventAmount:undefined,allocationDays:type==="allocation"?totalEvents:undefined,dailyAllocation:type==="allocation"&&allocationFrequency==='daily'?eventAmount:undefined,
    pendingToday:type==="daily"?dailyPendingNow:undefined,processedDays:type==="daily"?completedEvents:undefined,defaultedDays:type==="daily"?0:undefined,
    currentDailyStatus:type==="daily"?(completedEvents?"paid":dailyPendingNow?"due":"scheduled"):undefined,currentDueDate:type==="daily"?(dailyDueDate||(next?lagosYMD(next):null)):undefined,
    scheduleStartAt:type==="daily"&&dailyScheduleFirst?dailyScheduleFirst.toISOString():undefined,nextAllocationDate:type==="allocation"&&next?next.toISOString():undefined};

  const plan=(await client.query(`INSERT INTO plans(user_id,plan_name,purpose,plan_type,original_amount,remaining_locked,allocation_percent,allocation_amount,allocation_remaining,saved_amount,daily_amount,start_at,maturity_at,next_event_at,exclude_weekends,status,metadata,schedule_total_events,schedule_completed_events,event_amount,last_event_at)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active',$16,$17,$18,$19,$20) RETURNING *`,
  [req.user.sub,name,purpose,type,original,locked,ap,aa,ar,saved,daily,start,maturity,next,exclude,JSON.stringify(meta),totalEvents,completedEvents,eventAmount,completedEvents>0?now:null])).rows[0];

  if(debit>0){
   const scheduleDate=type==="daily"?lagosYMD(now):null;
   const reference=type==="daily"?`DAILY_${plan.id}_DAY_${scheduleDate}`:ref("PLAN");
   const txType=type==="lock"?"Lock Fund":type==="allocation"?"Lock & Allocation":"Daily Saving";
   const createdTx=(await client.query(`INSERT INTO transactions(user_id,wallet_id,plan_id,type,amount,direction,description,status,reference,metadata) VALUES($1,$2,$3,$4,$5,'debit',$6,'completed',$7,$8) RETURNING id,reference,type`,[req.user.sub,w.id,plan.id,txType,debit,type==="daily"?`${name} daily contribution for ${scheduleDate}`:name,reference,JSON.stringify({planType:type,engine:true,eventNumber:type==="daily"?1:null,totalEvents:type==="daily"?totalEvents:null,scheduleDate})])).rows[0];
   await ledger.append(client,{userId:req.user.sub,walletId:w.id,planId:plan.id,transactionId:createdTx.id,entryType:txType,direction:'debit',amount:debit,idempotencyKey:`TX_${createdTx.id}_DEBIT`,before:w,after:walletAfter,metadata:{reference:createdTx.reference,planType:type}});
   if(type==="daily"){
    await client.query("INSERT INTO notifications(user_id,title,message,type,action_url,source_transaction_id,event_key) VALUES($1,'Daily Savings Contribution',$2,'success','daily-saving-center.html',$3,$4) ON CONFLICT DO NOTHING",[req.user.sub,`₦${debit.toLocaleString()} was saved into ${name}. Contribution 1 of ${totalEvents}.`,createdTx.id,`DAILY_${plan.id}_${scheduleDate}_PAID`]);
    await client.query("INSERT INTO daily_saving_events(plan_id,user_id,schedule_date,event_no,amount,status,due_at,paid_at,transaction_id) VALUES($1,$2,$3,1,$4,'paid',$5,NOW(),$6) ON CONFLICT(plan_id,schedule_date) DO NOTHING",[plan.id,req.user.sub,scheduleDate,debit,atFive(scheduleDate),createdTx.id]);
   }
  }

  if(type==="daily"&&dailyPendingNow){
   const ymd=dailyDueDate,t5=atFive(ymd),t12=lagosAt(ymd,12),t18=lagosAt(ymd,18);
   await client.query(`INSERT INTO daily_saving_events(plan_id,user_id,schedule_date,event_no,amount,status,due_at,reminder_5am_at,reminder_noon_at,reminder_6pm_at)
    VALUES($1,$2,$3,1,$4,'due',$5,$6,$7,$8) ON CONFLICT(plan_id,schedule_date) DO NOTHING`,[plan.id,req.user.sub,ymd,daily,t5,now>=t5?now:null,now>=t12?now:null,now>=t18?now:null]);
   await client.query("INSERT INTO notifications(user_id,title,message,type,action_url,event_key) VALUES($1,'Daily Savings Contribution Due',$2,'warning','wallet-deposit.html',$3) ON CONFLICT DO NOTHING",[req.user.sub,`Your ${name} contribution of ₦${daily.toLocaleString()} is due today. Fund your available balance before midnight and OptiSave will collect it automatically.`,`DAILY_${plan.id}_${ymd}_DUE_START`]);
  }

  // Daily Savings uses its contribution-day ledger as the only customer-facing event stream.
  if(type!=="daily")await client.query("INSERT INTO notifications(user_id,title,message,type,action_url,event_key) VALUES($1,$2,$3,'success',$4,$5) ON CONFLICT DO NOTHING",[req.user.sub,type==="lock"?"Lock Only created":"Lock & Allocation created",`${name} was created successfully.`,"active-locked-plans.html",null]);
  const response={plan,wallet:(await client.query("SELECT * FROM wallets WHERE user_id=$1",[req.user.sub])).rows[0]};
  await idem.finish(client,claim,201,response);
  await client.query("COMMIT");
  res.status(201).json(response);
 }catch(e){try{await client.query("ROLLBACK")}catch(_){}if(e.status)return res.status(e.status).json({error:e.message});next(e)}finally{client.release()}
});

/* ===== v1.21 PostgreSQL financial actions ===== */
function planMeta(p){return p.metadata&&typeof p.metadata==="object"?{...p.metadata}:{}}
function halfPoint(p){const a=new Date(p.start_at||p.created_at),b=new Date(p.maturity_at||a);return new Date(a.getTime()+Math.max(0,b-a)/2)}
function planActions(p){const m=planMeta(p),now=Date.now(),half=halfPoint(p),locked=Number(p.remaining_locked||0);const dailyTotal=Math.max(1,Number(p.schedule_total_events||m.duration||1)),dailyHalf=Math.ceil(dailyTotal/2),done=Math.max(Number(p.schedule_completed_events||0),Number(m.completedDays||0));return {emergency:{used:!!p.emergency_used,eligible:!p.emergency_used&&["lock","allocation"].includes(p.plan_type)&&now>=half.getTime()&&locked>0,eligibleAt:half.toISOString(),amount:Math.round(locked*.5*100)/100},conversion:{used:!!p.allocation_converted||p.plan_type!=="lock",eligible:p.plan_type==="lock"&&!p.allocation_converted&&!p.emergency_used&&locked>0,amount:Math.round(locked*.5*100)/100},dailyEarlyAccess:{used:!!p.daily_early_access_used,eligible:p.plan_type==="daily"&&!p.daily_early_access_used&&done>=dailyHalf&&Number(p.saved_amount)>0,requiredDays:dailyHalf,completedDays:done,amount:Math.round(Number(p.saved_amount||0)*.5*100)/100}}}
r.get("/plans/:id/actions",async(req,res,next)=>{try{const p=(await db.query("SELECT * FROM plans WHERE id=$1 AND user_id=$2",[req.params.id,req.user.sub])).rows[0];if(!p)return res.status(404).json({error:"Plan not found"});res.json({actions:planActions(p)})}catch(e){next(e)}});
r.post("/plans/:id/emergency-withdraw",async(req,res,next)=>{
 const c=await db.pool.connect();
 try{
  await c.query("BEGIN");
  const claim=await idem.begin(c,req,`emergency:${req.params.id}`);
  if(claim.replayed){await c.query('COMMIT');return res.status(claim.statusCode||200).json(claim.response)}
  const p=(await c.query("SELECT * FROM plans WHERE id=$1 AND user_id=$2 FOR UPDATE",[req.params.id,req.user.sub])).rows[0];
  if(!p){await c.query("ROLLBACK");return res.status(404).json({error:"Plan not found"})}
  const a=planActions(p).emergency;
  if(!a.eligible){await c.query("ROLLBACK");return res.status(409).json({error:a.used?"Emergency access has already been used.":"Emergency access is not available yet.",actions:planActions(p)})}
  const w=(await c.query("SELECT * FROM wallets WHERE user_id=$1 FOR UPDATE",[req.user.sub])).rows[0],m=planMeta(p),reference=`EMERGENCY_${p.id}`;
  if((await c.query("SELECT 1 FROM transactions WHERE reference=$1",[reference])).rows[0]){await c.query("ROLLBACK");return res.status(409).json({error:"Emergency withdrawal was already processed."})}
  if(p.plan_type==="allocation")m.allocationsDisabled=true;
  const walletAfter=(await c.query("UPDATE wallets SET available_balance=available_balance+$1,total_locked=GREATEST(0,total_locked-$1),updated_at=NOW() WHERE id=$2 RETURNING *",[a.amount,w.id])).rows[0];
  await c.query("UPDATE plans SET remaining_locked=GREATEST(0,remaining_locked-$1),emergency_used=true,next_event_at=CASE WHEN plan_type='allocation' THEN NULL ELSE next_event_at END,metadata=$2,updated_at=NOW() WHERE id=$3",[a.amount,JSON.stringify(m),p.id]);
  const tx=(await c.query("INSERT INTO transactions(user_id,wallet_id,plan_id,type,amount,direction,description,status,reference,metadata) VALUES($1,$2,$3,'Emergency Withdrawal',$4,'credit',$5,'completed',$6,$7) RETURNING id,reference",[req.user.sub,w.id,p.id,a.amount,`${p.plan_name} emergency access`,reference,JSON.stringify({engine:true})])).rows[0];
  await ledger.append(c,{userId:req.user.sub,walletId:w.id,planId:p.id,transactionId:tx.id,entryType:'Emergency Withdrawal',direction:'credit',amount:a.amount,idempotencyKey:`TX_${tx.id}_CREDIT`,before:w,after:walletAfter,metadata:{reference:tx.reference}});
  await c.query("INSERT INTO notifications(user_id,title,message,type,action_url,source_transaction_id,event_key) VALUES($1,'Emergency access completed',$2,'success','active-locked-plans.html',$3,$4) ON CONFLICT DO NOTHING",[req.user.sub,`₦${a.amount.toLocaleString()} was moved to your available balance.`,tx.id,`EMERGENCY_${p.id}_DONE`]);
  const response={ok:true,amount:a.amount};await idem.finish(c,claim,200,response);
  await c.query("COMMIT");res.json(response);
 }catch(e){try{await c.query("ROLLBACK")}catch(_){}if(e.status)return res.status(e.status).json({error:e.message});next(e)}finally{c.release()}
});
r.post("/plans/:id/daily-early-access",async(req,res,next)=>{
 const c=await db.pool.connect();
 try{
  await c.query("BEGIN");
  const claim=await idem.begin(c,req,`daily-early:${req.params.id}`);
  if(claim.replayed){await c.query('COMMIT');return res.status(claim.statusCode||200).json(claim.response)}
  const p=(await c.query("SELECT * FROM plans WHERE id=$1 AND user_id=$2 FOR UPDATE",[req.params.id,req.user.sub])).rows[0];
  if(!p){await c.query("ROLLBACK");return res.status(404).json({error:"Plan not found"})}
  const a=planActions(p).dailyEarlyAccess;
  if(!a.eligible){await c.query("ROLLBACK");return res.status(409).json({error:a.used?"Early access has already been used.":`Early access becomes available after ${a.requiredDays} completed saving days.`})}
  const w=(await c.query("SELECT * FROM wallets WHERE user_id=$1 FOR UPDATE",[req.user.sub])).rows[0],reference=`DAILYEARLY_${p.id}`;
  if((await c.query('SELECT 1 FROM transactions WHERE reference=$1',[reference])).rows[0]){await c.query('ROLLBACK');return res.status(409).json({error:'Early access has already been processed.'})}
  const walletAfter=(await c.query("UPDATE wallets SET available_balance=available_balance+$1,updated_at=NOW() WHERE id=$2 RETURNING *",[a.amount,w.id])).rows[0];
  await c.query("UPDATE plans SET saved_amount=GREATEST(0,saved_amount-$1),daily_early_access_used=true,updated_at=NOW() WHERE id=$2",[a.amount,p.id]);
  const tx=(await c.query("INSERT INTO transactions(user_id,wallet_id,plan_id,type,amount,direction,description,status,reference,metadata) VALUES($1,$2,$3,'Daily Saving Early Access',$4,'credit',$5,'completed',$6,$7) RETURNING id,reference",[req.user.sub,w.id,p.id,a.amount,`${p.plan_name} 50% early access`,reference,JSON.stringify({engine:true})])).rows[0];
  await ledger.append(c,{userId:req.user.sub,walletId:w.id,planId:p.id,transactionId:tx.id,entryType:'Daily Saving Early Access',direction:'credit',amount:a.amount,idempotencyKey:`TX_${tx.id}_CREDIT`,before:w,after:walletAfter,metadata:{reference:tx.reference}});
  await c.query("INSERT INTO notifications(user_id,title,message,type,action_url,source_transaction_id,event_key) VALUES($1,'Daily Savings early access completed',$2,'success','daily-saving-center.html',$3,$4) ON CONFLICT DO NOTHING",[req.user.sub,`₦${a.amount.toLocaleString()} was moved to your available balance.`,tx.id,`DAILY_EARLY_${p.id}_DONE`]);
  const response={ok:true,amount:a.amount};await idem.finish(c,claim,200,response);
  await c.query("COMMIT");res.json(response);
 }catch(e){try{await c.query("ROLLBACK")}catch(_){}if(e.status)return res.status(e.status).json({error:e.message});next(e)}finally{c.release()}
});
r.post("/plans/:id/convert-allocation",async(req,res,next)=>{const c=await db.pool.connect();try{
 await c.query("BEGIN");
 const claim=await idem.begin(c,req,`convert-allocation:${req.params.id}`);
 if(claim.replayed){await c.query('COMMIT');return res.status(claim.statusCode||200).json(claim.response)}
 const p=(await c.query("SELECT * FROM plans WHERE id=$1 AND user_id=$2 FOR UPDATE",[req.params.id,req.user.sub])).rows[0];
 if(!p){await c.query('ROLLBACK');return res.status(404).json({error:"Plan not found"})}
 const a=planActions(p).conversion;if(!a.eligible){await c.query("ROLLBACK");return res.status(409).json({error:p.emergency_used?"Allocation cannot be started after emergency access.":"This Lock Only plan has already used its allocation conversion."})}
 const periodDays=Math.max(1,Math.floor(Number(req.body.allocationDays||1))),frequency=normalizeFrequency(req.body.allocationFrequency||'daily'),m=planMeta(p),amount=a.amount,remaining=round2(Number(p.remaining_locked)-amount),startMode=String(req.body.startMode||"now"),exclude=!!req.body.excludeWeekend,now=new Date();
 let anchor;
 if(startMode==="later"&&req.body.startDate){const requested=atFive(String(req.body.startDate).slice(0,10));anchor=requested&&requested>now?requested:now}else anchor=now;
 const first=firstFutureFive(anchor,exclude,now),requestedEnd=new Date(anchor.getTime()+periodDays*86400000),planMaturity=p.maturity_at?new Date(p.maturity_at):requestedEnd,end=planMaturity<requestedEnd?planMaturity:requestedEnd;
 const total=countAllocationEvents(first,end,frequency,exclude);
 if(total<1){await c.query("ROLLBACK");return res.status(400).json({error:"There is not enough time before maturity for the selected allocation frequency."})}
 const releaseAmount=round2(amount/total);
 Object.assign(m,{allocationDays:total,allocationEvents:total,allocationFrequency:frequency,releaseAmount,dailyAllocation:frequency==='daily'?releaseAmount:undefined,excludeWeekend:exclude,convertedFromLock:true,allocationStartDate:first.toISOString(),nextAllocationDate:first.toISOString()});
 await c.query("UPDATE plans SET plan_type='allocation',remaining_locked=$1,allocation_percent=50,allocation_amount=$2,allocation_remaining=$2,next_event_at=$3,exclude_weekends=$4,allocation_converted=true,metadata=$5,schedule_total_events=$6,schedule_completed_events=0,event_amount=$7,last_event_at=NULL,updated_at=NOW() WHERE id=$8",[remaining,amount,first,exclude,JSON.stringify(m),total,releaseAmount,p.id]);
 const w=(await c.query('SELECT * FROM wallets WHERE user_id=$1',[req.user.sub])).rows[0];
 const tx=(await c.query("INSERT INTO transactions(user_id,wallet_id,plan_id,type,amount,direction,description,status,reference,metadata) VALUES($1,(SELECT id FROM wallets WHERE user_id=$1),$2,'Allocation Conversion',$3,'internal',$4,'completed',$5,$6) RETURNING id,reference,wallet_id",[req.user.sub,p.id,amount,`${p.plan_name}: 50% of remaining locked balance moved into a ${frequency} allocation schedule`,`CONVERT_${p.id}`,JSON.stringify({engine:true,noWalletDebit:true,frequency,totalEvents:total})])).rows[0];
 await ledger.append(c,{userId:req.user.sub,walletId:tx.wallet_id,planId:p.id,transactionId:tx.id,entryType:'Allocation Conversion',direction:'internal',amount,idempotencyKey:`TX_${tx.id}_INTERNAL`,before:w,after:w,metadata:{reference:tx.reference,frequency,totalEvents:total,noWalletMovement:true}});
 const response={ok:true,amount,remainingLocked:remaining,frequency,totalEvents:total,releaseAmount};await idem.finish(c,claim,200,response);
 await c.query("COMMIT");res.json(response);
}catch(e){try{await c.query("ROLLBACK")}catch(_){}if(e.status)return res.status(e.status).json({error:e.message});next(e)}finally{c.release()}});
r.post("/financial-engine/run",async(req,res,next)=>{if(process.env.NODE_ENV!=="development")return res.status(404).json({error:"Not available"});try{const engine=require("../financial-engine");res.json({ok:true,checked:await engine.run()})}catch(e){next(e)}});

/* ===== Bank account provider integration (Paystack) ===== */
function normName(v){return String(v||"").toUpperCase().replace(/[^A-Z ]/g," ").split(/\s+/).filter(Boolean)}
function nameMatch(a,b){const A=normName(a),B=normName(b);if(!A.length||!B.length)return {matched:false,score:0};const hit=A.filter(x=>B.includes(x)).length;const score=Math.round((hit/Math.max(A.length,B.length))*100);return {matched:hit>=2&&score>=50,score}}
function normalizeKyc(row){
 const k=row||{};
 const raw=String(k.status||"not_submitted").toLowerCase();
 const provider=String(k.provider_status||"").toLowerCase();
 let state=raw;
 if(provider==="verified"||raw==="verified") state="verified";
 else if(provider==="failed"||["action_required","rejected","failed"].includes(raw)) state="action_required";
 else if(provider==="pending"||["verification_in_progress","pending"].includes(raw)) state="verification_in_progress";
 else if(raw==="review_required") state="under_review";
 else if(raw==="submitted") state="under_review";
 else state="not_submitted";
 const copy={
  not_submitted:{label:"Not submitted",action:"submit",message:"Complete your identity information to start verification."},
  verification_in_progress:{label:"Verification in progress",action:"wait",message:"Your identity verification is being processed. You do not need to submit it again."},
  under_review:{label:"Under review",action:"wait",message:"Your submitted KYC is awaiting review."},
  verified:{label:"Verified",action:"none",message:"Your identity verification has been completed successfully."},
  action_required:{label:"Action required",action:"retry",message:k.provider_reason||k.review_reason||"We could not complete verification. Review your details and re-verify or re-upload the requested information."}
 }[state];
 return {...k,normalized_status:state,status_label:copy.label,next_action:copy.action,status_message:copy.message,can_retry:state==="action_required",can_edit:["not_submitted","action_required"].includes(state)};
}

async function paystack(path,options={}){
 const key=process.env.PAYSTACK_SECRET_KEY;if(!key)throw Object.assign(Error("Bank verification provider is not configured"),{status:503});
 const headers={Authorization:"Bearer "+key,...(options.headers||{})};if(options.body)headers["Content-Type"]="application/json";const resp=await fetch("https://api.paystack.co"+path,{...options,headers});
 const data=await resp.json().catch(()=>({}));
 if(!resp.ok||data.status===false){
  const error=Object.assign(Error(data.message||"Bank provider request failed"),{status:resp.status||502});
  // A provider business-level rejection with an otherwise successful HTTP response is
  // definitive. Network errors, timeouts, duplicate-reference responses and 5xx errors
  // remain ambiguous and must never trigger an automatic wallet refund.
  error.providerRejected=resp.ok&&data.status===false;
  throw error;
 }
 return data;
}
r.get("/banks",async(req,res,next)=>{try{
 const data=await paystack("/bank?country=nigeria&perPage=100");
 res.json({banks:(data.data||[]).map(b=>({name:b.name,code:b.code,slug:b.slug,type:b.type})).filter(b=>b.code)});
}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}});

r.get("/banks/resolve",async(req,res,next)=>{try{
 const n=String(req.query.account_number||"").replace(/\D/g,""),code=String(req.query.bank_code||"");
 if(n.length!==10||!code)return res.status(400).json({error:"Select a bank and enter a 10-digit account number"});
 const data=await paystack(`/bank/resolve?account_number=${encodeURIComponent(n)}&bank_code=${encodeURIComponent(code)}`);
 res.json({accountName:data.data?.account_name||"",accountNumber:data.data?.account_number||n});
}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}});

r.get("/bank-account",async(req,res,next)=>{try{
 // v1.33 self-heal: a final verified KYC state is authoritative for the linked primary bank.
 // This repairs users whose success webhook verified KYC but an older build left the bank pending.
 const c=await db.pool.connect();let row=null;
 try{
  await c.query("BEGIN");
  const k=(await c.query("SELECT status,provider_status FROM kyc_profiles WHERE user_id=$1 FOR UPDATE",[req.user.sub])).rows[0];
  if(k&&(k.status==='verified'||k.provider_status==='verified'))
   await c.query("UPDATE bank_accounts SET is_verified=true WHERE user_id=$1 AND is_primary=true AND is_verified=false",[req.user.sub]);
  row=(await c.query("SELECT id,bank_name,bank_code,account_number_last4,account_name,is_verified,is_primary,(provider_recipient_code IS NOT NULL) AS withdrawal_ready,created_at FROM bank_accounts WHERE user_id=$1 AND is_primary=true ORDER BY id DESC LIMIT 1",[req.user.sub])).rows[0]||null;
  await c.query("COMMIT");
 }catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}
 res.json({bankAccount:row});
}catch(e){next(e)}});

r.post("/bank-account",async(req,res,next)=>{try{
 await paymentMode.assertProviderWriteAccess(db,req.user.sub);
 if(!(await requirePin(req.user.sub,req.body.pin)))return res.status(403).json({error:"Enter your transaction PIN before changing bank information"});
 const bankName=String(req.body.bankName||"").trim(),bankCode=String(req.body.bankCode||"").trim(),n=String(req.body.accountNumber||"").replace(/\D/g,""),claimed=String(req.body.accountName||"").trim();
 if(!bankName||!bankCode||n.length!==10)return res.status(400).json({error:"Valid bank details are required"});
 const data=await paystack(`/bank/resolve?account_number=${encodeURIComponent(n)}&bank_code=${encodeURIComponent(bankCode)}`);
 const verified=String(data.data?.account_name||"").trim();if(!verified)return res.status(400).json({error:"Unable to verify account"});
 if(claimed&&claimed.toLowerCase()!==verified.toLowerCase())return res.status(400).json({error:"Account verification changed. Please resolve it again."});
 const c=await db.pool.connect();try{await c.query("BEGIN");await c.query("UPDATE bank_accounts SET is_primary=false WHERE user_id=$1",[req.user.sub]);
 const identity=(await c.query("SELECT full_name FROM users WHERE id=$1",[req.user.sub])).rows[0];const match=nameMatch(identity?.full_name,verified);
 const recipient=await paystack('/transferrecipient',{method:'POST',body:JSON.stringify({type:'nuban',name:verified,account_number:n,bank_code:bankCode,currency:'NGN',description:'OptiSave verified withdrawal account'})});
 const recipientCode=String(recipient.data?.recipient_code||'');if(!recipientCode)throw Object.assign(Error('Unable to prepare this account for withdrawals'),{status:502});
 const row=(await c.query(`INSERT INTO bank_accounts(user_id,bank_name,bank_code,account_number_last4,account_name,is_verified,is_primary,provider_recipient_code) VALUES($1,$2,$3,$4,$5,true,true,$6) RETURNING id,bank_name,bank_code,account_number_last4,account_name,is_verified,is_primary,true AS withdrawal_ready,created_at`,[req.user.sub,bankName,bankCode,n.slice(-4),verified,recipientCode])).rows[0];
 await c.query(`INSERT INTO kyc_profiles(user_id,status,bank_name_match,bank_account_name,match_score,review_reason,updated_at) VALUES($1,'not_submitted',$2,$3,$4,$5,NOW()) ON CONFLICT(user_id) DO UPDATE SET bank_name_match=$2,bank_account_name=$3,match_score=$4,review_reason=$5,updated_at=NOW()`,[req.user.sub,match.matched,verified,match.score,match.matched?null:"Profile name does not sufficiently match the resolved bank account name."]);
 await c.query("COMMIT");res.json({bankAccount:row,nameMatch:match});}catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}
}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}});


/* v1.34: securely finish Paystack recipient setup for an already KYC-verified bank.
   The account number is accepted for this request only and is never persisted. */
r.post("/bank-account/prepare-recipient",async(req,res,next)=>{try{
 await paymentMode.assertProviderWriteAccess(db,req.user.sub);
 if(!(await requirePin(req.user.sub,req.body.pin)))return res.status(403).json({error:"Enter your transaction PIN before changing withdrawal setup"});
 const accountNumber=String(req.body.accountNumber||"").replace(/\D/g,"");
 if(accountNumber.length!==10)return res.status(400).json({error:"Enter the same 10-digit bank account number used for KYC."});
 const c=await db.pool.connect();let bank,kyc,user;
 try{
  await c.query('BEGIN');
  kyc=(await c.query("SELECT status,provider_status FROM kyc_profiles WHERE user_id=$1 FOR UPDATE",[req.user.sub])).rows[0];
  if(!kyc||!(kyc.status==='verified'||kyc.provider_status==='verified')){await c.query('ROLLBACK');return res.status(400).json({error:'KYC must be verified before preparing a withdrawal recipient.'})}
  bank=(await c.query("SELECT id,bank_name,bank_code,account_number_last4,account_name,is_verified,provider_recipient_code FROM bank_accounts WHERE user_id=$1 AND is_primary=true ORDER BY id DESC LIMIT 1 FOR UPDATE",[req.user.sub])).rows[0];
  if(!bank){await c.query('ROLLBACK');return res.status(404).json({error:'No KYC-linked bank account was found.'})}
  if(bank.provider_recipient_code){await c.query('COMMIT');return res.json({ready:true,bankAccount:{...bank,withdrawal_ready:true}})}
  if(accountNumber.slice(-4)!==String(bank.account_number_last4||'')){await c.query('ROLLBACK');return res.status(400).json({error:'That account number does not match the bank account verified during KYC.'})}
  user=(await c.query('SELECT full_name FROM users WHERE id=$1',[req.user.sub])).rows[0];
  await c.query('COMMIT');
 }catch(e){try{await c.query('ROLLBACK')}catch{};throw e}finally{c.release()}

 // Paystack's documented transfer test account uses a normal bank code. Code 007 is OptiSave's
 // KYC-only test-bank alias, so in test mode recipient creation is routed through Zenith (057).
 const isTest=String(process.env.PAYSTACK_SECRET_KEY||'').startsWith('sk_test_');
 const isKycTestBank=bank.bank_code==='007';
 if(isKycTestBank&&!isTest)return res.status(400).json({error:'The Paystack Test Bank is only available with Paystack test keys.'});
 // Paystack documents Zenith 057 / 0000000000 for Nigerian transfer-recipient testing.
 // 007 is only OptiSave's KYC sandbox alias, so never send 007 (or the user's KYC
 // sandbox account number) to Paystack's real account-resolution/recipient endpoints.
 // This mapping is strictly gated by sk_test_ and never runs with live keys.
 const providerBankCode=(isKycTestBank&&isTest)?'057':bank.bank_code;
 const providerAccountNumber=(isKycTestBank&&isTest)?'0000000000':accountNumber;
 let resolvedName=String(bank.account_name||user?.full_name||'OptiSave User').trim();
 if(!(isKycTestBank&&isTest)){
  const resolved=await paystack(`/bank/resolve?account_number=${encodeURIComponent(providerAccountNumber)}&bank_code=${encodeURIComponent(providerBankCode)}`);
  if(resolved.data?.account_name)resolvedName=String(resolved.data.account_name).trim();
 }
 const recipient=await paystack('/transferrecipient',{method:'POST',body:JSON.stringify({type:'nuban',name:resolvedName,account_number:providerAccountNumber,bank_code:providerBankCode,currency:'NGN',description:isKycTestBank&&isTest?'OptiSave Paystack test withdrawal recipient':'OptiSave verified withdrawal account'})});
 const recipientCode=String(recipient.data?.recipient_code||'');
 if(!recipientCode)throw Object.assign(Error('Paystack did not return a transfer recipient code.'),{status:502});
 const q=await db.query("UPDATE bank_accounts SET is_verified=true,provider_recipient_code=$1,account_name=COALESCE(NULLIF($2,''),account_name) WHERE id=$3 AND user_id=$4 RETURNING id,bank_name,bank_code,account_number_last4,account_name,is_verified,is_primary,true AS withdrawal_ready,created_at",[recipientCode,resolvedName,bank.id,req.user.sub]);
 await db.query("INSERT INTO notifications(user_id,title,message,type,action_url) VALUES($1,'Withdrawal account ready',$2,'success','wallet-withdraw.html')",[req.user.sub,`${bank.bank_name} ending ${bank.account_number_last4} is ready for withdrawals.`]);
 res.json({ready:true,bankAccount:q.rows[0]});
}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}});


/* ===== Paystack deposits + withdrawals (v1.29) ===== */
r.post('/payments/deposits/initialize',async(req,res,next)=>{try{
 const amount=money(req.body.amount);if(!amount)return res.status(400).json({error:'Enter a valid deposit amount'});
 if(amount<100)return res.status(400).json({error:'Minimum deposit is ₦100'});
 await paymentMode.assertPaymentAccess(db,req.user.sub,'deposit',amount);
 const u=(await db.query('SELECT email FROM users WHERE id=$1',[req.user.sub])).rows[0];
 const w=(await db.query('SELECT id FROM wallets WHERE user_id=$1',[req.user.sub])).rows[0];if(!u||!w)return res.status(404).json({error:'Wallet not found'});
 const reference=ref('DEP').replace(/_/g,'-');
 const base=String(process.env.APP_BASE_URL||`${req.protocol}://${req.get('host')}`).replace(/\/$/,'');
 const tx=(await db.query("INSERT INTO transactions(user_id,wallet_id,type,amount,direction,description,status,reference,metadata) VALUES($1,$2,'Deposit',$3,'credit','Paystack wallet deposit','pending',$4,$5) RETURNING *",[req.user.sub,w.id,amount,reference,JSON.stringify({provider:'paystack'})])).rows[0];
 try{
  const ps=await paystack('/transaction/initialize',{method:'POST',body:JSON.stringify({email:u.email,amount:String(Math.round(amount*100)),currency:'NGN',reference,callback_url:base+'/wallet-deposit.html',metadata:JSON.stringify({optisave_user_id:req.user.sub,optisave_transaction_id:tx.id,type:'wallet_deposit'})})});
  await db.query("UPDATE transactions SET metadata=metadata||$2::jsonb WHERE id=$1",[tx.id,JSON.stringify({access_code:ps.data?.access_code||null})]);
  res.json({reference,authorizationUrl:ps.data?.authorization_url,accessCode:ps.data?.access_code});
 }catch(e){await db.query("UPDATE transactions SET status='failed',metadata=metadata||$2::jsonb WHERE id=$1",[tx.id,JSON.stringify({initialize_error:e.message})]);throw e}
}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}});

r.post('/payments/deposits/verify',async(req,res,next)=>{try{
 const reference=String(req.body.reference||'').trim();if(!reference)return res.status(400).json({error:'Payment reference is required'});
 const tx=(await db.query("SELECT id FROM transactions WHERE reference=$1 AND user_id=$2 AND type='Deposit'",[reference,req.user.sub])).rows[0];if(!tx)return res.status(404).json({error:'Deposit not found'});
 const ps=await paystack('/transaction/verify/'+encodeURIComponent(reference));
 const payments=require('../payments');await payments.settleDeposit(ps.data||{});
 const fresh=(await db.query('SELECT * FROM transactions WHERE id=$1',[tx.id])).rows[0];
 res.json({transaction:fresh});
}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}});

r.post('/payments/withdrawals',async(req,res,next)=>{
 const amount=money(req.body.amount);if(!amount)return res.status(400).json({error:'Enter a valid withdrawal amount'});
 if(amount<100)return res.status(400).json({error:'Minimum withdrawal is ₦100'});
 try{await paymentMode.assertPaymentAccess(db,req.user.sub,'withdrawal',amount)}catch(e){return res.status(e.status||403).json({error:e.message})}
 const client=await db.pool.connect();let tx,bank,claim;
 try{
  await client.query('BEGIN');
  claim=await idem.begin(client,req,'withdrawal:create');
  if(claim.replayed){
   const cached={...(claim.response||{})};
   if(cached.transaction?.id){const fresh=(await client.query('SELECT * FROM transactions WHERE id=$1 AND user_id=$2',[cached.transaction.id,req.user.sub])).rows[0];if(fresh)cached.transaction=fresh}
   await client.query('COMMIT');return res.status(claim.statusCode||200).json(cached);
  }
  const k=(await client.query("SELECT status,provider_status FROM kyc_profiles WHERE user_id=$1 FOR UPDATE",[req.user.sub])).rows[0];
  if(String(k?.status)!=='verified'&&String(k?.provider_status)!=='verified'){await client.query('ROLLBACK');return res.status(403).json({error:'Complete KYC verification before withdrawing'})}
  bank=(await client.query("SELECT id,bank_name,account_name,account_number_last4,provider_recipient_code FROM bank_accounts WHERE user_id=$1 AND is_primary=true AND is_verified=true ORDER BY id DESC LIMIT 1 FOR UPDATE",[req.user.sub])).rows[0];
  if(!bank?.provider_recipient_code){await client.query('ROLLBACK');return res.status(400).json({error:'Your saved bank account is not yet prepared for withdrawals. Open Bank Information and save/verify it again.'})}
  const w=(await client.query('SELECT * FROM wallets WHERE user_id=$1 FOR UPDATE',[req.user.sub])).rows[0];if(!w)throw Error('Wallet not found');
  if(Number(w.available_balance)<amount){await client.query('ROLLBACK');return res.status(400).json({error:'Insufficient available balance'})}
  const reference=ref('wdr').toLowerCase();
  const walletAfter=(await client.query('UPDATE wallets SET available_balance=available_balance-$1,updated_at=NOW() WHERE id=$2 RETURNING *',[amount,w.id])).rows[0];
  tx=(await client.query("INSERT INTO transactions(user_id,wallet_id,type,amount,direction,description,status,reference,metadata) VALUES($1,$2,'Withdrawal',$3,'debit',$4,'pending',$5,$6) RETURNING *",[req.user.sub,w.id,amount,`Withdrawal to ${bank.bank_name} ••••${bank.account_number_last4}`,reference,JSON.stringify({provider:'paystack',bank_account_id:bank.id,reserved:true})])).rows[0];
  await ledger.append(client,{userId:req.user.sub,walletId:w.id,transactionId:tx.id,entryType:'Withdrawal Reserve',direction:'debit',amount,idempotencyKey:`WITHDRAWAL_RESERVE_${tx.id}`,before:w,after:walletAfter,metadata:{reference:tx.reference,bankAccountId:bank.id}});
  const reservedResponse={transaction:{...tx,status:'pending'},providerStatus:'reserved'};
  await idem.finish(client,claim,200,reservedResponse);
  await client.query('COMMIT');
 }catch(e){try{await client.query('ROLLBACK')}catch(_){}client.release();if(e.status)return res.status(e.status).json({error:e.message});return next(e)}
 client.release();
 try{
  const ps=await paystack('/transfer',{method:'POST',body:JSON.stringify({source:'balance',amount:Math.round(amount*100),recipient:bank.provider_recipient_code,reference:tx.reference,reason:'OptiSave withdrawal',currency:'NGN'})});
  const providerStatus=String(ps.data?.status||'pending');
  await db.query("UPDATE transactions SET metadata=metadata||$2::jsonb WHERE id=$1",[tx.id,JSON.stringify({provider_status:providerStatus,transfer_code:ps.data?.transfer_code||null})]);
  await db.query("INSERT INTO notifications(user_id,title,message,type,action_url,source_transaction_id) VALUES($1,'Withdrawal processing',$2,'info','transactions.html',$3) ON CONFLICT (source_transaction_id) WHERE source_transaction_id IS NOT NULL DO NOTHING",[req.user.sub,providerStatus==='otp'?'Your withdrawal is reserved and requires business transfer authorization before it can be sent.':'Your withdrawal is being processed to your verified bank account.',tx.id]);
  const response={transaction:{...tx,status:'pending'},providerStatus};
  await idem.refresh(db.pool,req.user.sub,'withdrawal:create',claim.key,200,response);
  res.json(response);
 }catch(e){
  // Never refund an ambiguous provider outcome. A network timeout or 5xx may happen
  // after the transfer was accepted; refunding here could let the same money exist in
  // both the user's OptiSave wallet and the banking rail. Only a definitive rejection
  // is safe to refund immediately. Ambiguous reservations remain pending until a
  // provider webhook or later reconciliation gives a final answer.
  const code=Number(e.status||0),definitive=!!e.providerRejected||(code>=400&&code<500&&![408,409,425,429].includes(code));
  if(!definitive){
   await db.query("UPDATE transactions SET metadata=metadata||$2::jsonb WHERE id=$1",[tx.id,JSON.stringify({provider_status:'unknown',provider_error:String(e.message||''),needs_reconciliation:true})]);
   await db.query("INSERT INTO notifications(user_id,title,message,type,action_url,source_transaction_id) VALUES($1,'Withdrawal awaiting confirmation',$2,'warning','transactions.html',$3) ON CONFLICT (source_transaction_id) WHERE source_transaction_id IS NOT NULL DO UPDATE SET title=EXCLUDED.title,message=EXCLUDED.message,type=EXCLUDED.type,is_read=false,created_at=NOW()",[req.user.sub,'Your withdrawal amount is reserved while OptiSave confirms the payment provider status. Do not submit the same withdrawal again.',tx.id]);
   const fresh=(await db.query('SELECT * FROM transactions WHERE id=$1',[tx.id])).rows[0]||tx;
   const body={transaction:fresh,providerStatus:'unknown',reserved:true,needsReconciliation:true,message:'Your withdrawal is safely reserved while the payment provider status is confirmed. It has not been deducted twice; do not submit another withdrawal for the same amount yet.'};
   await idem.refresh(db.pool,req.user.sub,'withdrawal:create',claim.key,202,body).catch(()=>{});
   return res.status(202).json(body);
  }

  const c=await db.pool.connect();let refunded=false;
  try{
   await c.query('BEGIN');
   const locked=(await c.query("SELECT * FROM transactions WHERE id=$1 FOR UPDATE",[tx.id])).rows[0];
   if(locked&&locked.status==='pending'){
    const before=(await c.query('SELECT * FROM wallets WHERE id=$1 FOR UPDATE',[locked.wallet_id])).rows[0];
    const after=(await c.query('UPDATE wallets SET available_balance=available_balance+$1,updated_at=NOW() WHERE id=$2 RETURNING *',[locked.amount,locked.wallet_id])).rows[0];
    await c.query("UPDATE transactions SET status='failed',metadata=metadata||$2::jsonb WHERE id=$1",[locked.id,JSON.stringify({provider_status:'rejected',provider_error:e.message,refunded:true,needs_reconciliation:false})]);
    await ledger.append(c,{userId:locked.user_id,walletId:locked.wallet_id,transactionId:locked.id,entryType:'Withdrawal Refund',direction:'credit',amount:locked.amount,idempotencyKey:`WITHDRAWAL_REFUND_${locked.id}`,before,after,metadata:{reference:locked.reference,providerError:String(e.message||'')}});
    refunded=true;
   }
   await c.query('COMMIT');
  }catch(x){await c.query('ROLLBACK');throw x}finally{c.release()}
  const providerError=String(e.message||'');
  const customerError=/starter business|third party payouts/i.test(providerError)?'Withdrawal service is currently unavailable. The reserved amount has been returned to your available balance.':'The provider rejected this withdrawal. The reserved amount has been returned to your available balance.';
  const status=(code>=400&&code<500)?code:502,body={error:customerError,safeToRetry:true,refunded};
  await idem.refresh(db.pool,req.user.sub,'withdrawal:create',claim.key,status,body).catch(()=>{});
  return res.status(status).json(body);
 }
});

/* ===== Profile + KYC metadata in PostgreSQL ===== */
r.get("/profile",async(req,res,next)=>{try{
 // Repair legacy success events from builds where the success notification was written
 // but stale KYC fields could still be returned to the UI.
 await db.query(`UPDATE kyc_profiles k SET status='verified',provider_status='verified',provider_reason=NULL,review_reason=NULL,verified_at=COALESCE(k.verified_at,n.created_at,NOW()),provider_checked_at=COALESCE(k.provider_checked_at,n.created_at,NOW()),updated_at=NOW() FROM LATERAL (SELECT created_at FROM notifications WHERE user_id=$1 AND title='Identity verified' ORDER BY created_at DESC LIMIT 1) n WHERE k.user_id=$1 AND (k.status<>'verified' OR COALESCE(k.provider_status,'')<>'verified')`,[req.user.sub]);
 // A provider request must not remain pending forever. If no final webhook arrives
 // within 15 minutes, expose an actionable retry state. A later success webhook
 // can still move the record to verified.
 await db.query(`UPDATE kyc_profiles SET status='action_required',provider_status='failed',provider_reason=COALESCE(provider_reason,'Verification did not return a final result. Please re-verify your identity.'),provider_checked_at=NOW(),updated_at=NOW() WHERE user_id=$1 AND provider_status='pending' AND last_verification_started_at IS NOT NULL AND last_verification_started_at < NOW() - INTERVAL '15 minutes'`,[req.user.sub]);
 const u=(await db.query("SELECT id,email,full_name,phone,country,date_of_birth,gender,address,city,state,status FROM users WHERE id=$1",[req.user.sub])).rows[0];
 const k=(await db.query("SELECT document_type,document_number_masked,status,submitted_at,verified_at,bank_name_match,bank_account_name,match_score,review_reason,provider_status,provider_reason,provider_checked_at,verification_attempts,last_verification_started_at FROM kyc_profiles WHERE user_id=$1",[req.user.sub])).rows[0];
 res.json({profile:u,kyc:normalizeKyc(k)});
}catch(e){next(e)}});
r.put("/profile",async(req,res,next)=>{try{
 if(!(await requirePin(req.user.sub,req.body.pin)))return res.status(403).json({error:"Enter your correct transaction PIN to edit personal information"});
 const x=req.body||{},k=(await db.query("SELECT status FROM kyc_profiles WHERE user_id=$1",[req.user.sub])).rows[0],locked=["submitted","verified"].includes(String(k?.status||"").toLowerCase());
 const old=(await db.query("SELECT * FROM users WHERE id=$1",[req.user.sub])).rows[0];
 const full=locked?old.full_name:String(x.fullName||old.full_name).trim(),dob=locked?old.date_of_birth:(x.dob||old.date_of_birth);
 const phone=String(x.phone||"").trim(),normalizedPhone=normalizePhone(phone);if(phone&&!normalizedPhone)return res.status(400).json({error:"Enter a valid phone number"});
 const q=await db.query(`UPDATE users SET full_name=$1,phone=$2,normalized_phone=$3,country=$4,date_of_birth=$5,gender=$6,address=$7,city=$8,state=$9,updated_at=NOW() WHERE id=$10 RETURNING id,email,full_name,phone,country,date_of_birth,gender,address,city,state,status`,
 [full,phone,normalizedPhone,String(x.country||""),dob||null,String(x.gender||""),String(x.address||""),String(x.city||""),String(x.state||""),req.user.sub]);
 await db.query("INSERT INTO login_events(user_id,event_type,ip_address,user_agent) VALUES($1,'profile_changed',$2,$3)",[req.user.sub,String(req.headers['cf-connecting-ip']||req.ip||''),String(req.get('user-agent')||'')]);
 res.json({profile:q.rows[0]});
}catch(e){if(e.code==="23505"&&String(e.constraint||"").includes("phone"))return res.status(409).json({error:"This phone number is already linked to an OptiSave account"});next(e)}});
r.post("/kyc",async(req,res,next)=>{try{
 const x=req.body||{},dt=String(x.documentType||"").trim(),dn=String(x.documentNumber||"").trim();
 if(!dt||!dn)return res.status(400).json({error:"Document type and number are required"});
 const masked=dn.length<=4?"****":"•".repeat(Math.max(4,dn.length-4))+dn.slice(-4);
 const prior=(await db.query("SELECT bank_name_match FROM kyc_profiles WHERE user_id=$1",[req.user.sub])).rows[0],status=prior&&prior.bank_name_match===false?'review_required':'submitted';
 const q=await db.query(`INSERT INTO kyc_profiles(user_id,document_type,document_number_masked,status,submitted_at,updated_at)
 VALUES($1,$2,$3,$4,NOW(),NOW()) ON CONFLICT(user_id) DO UPDATE SET document_type=EXCLUDED.document_type,document_number_masked=EXCLUDED.document_number_masked,status=$4,submitted_at=NOW(),verified_at=NULL,provider_status=NULL,provider_reason=NULL,review_reason=CASE WHEN $4='review_required' THEN kyc_profiles.review_reason ELSE NULL END,updated_at=NOW()
 RETURNING document_type,document_number_masked,status,submitted_at,verified_at,bank_name_match,bank_account_name,match_score,review_reason`,[req.user.sub,dt,masked,status]);
 await db.query("INSERT INTO notifications(user_id,title,message,type,action_url) VALUES($1,'KYC submitted',$2,'info','kyc.html')",[req.user.sub,status==='review_required'?'Your KYC needs review because the profile and bank account names did not match sufficiently.':'Your KYC was submitted and is awaiting verification.']);
 res.json({kyc:q.rows[0]});
}catch(e){next(e)}});


/* Start Paystack Nigerian customer identification. Raw BVN/account number are sent to Paystack and are not persisted by OptiSave. */
r.post("/kyc/provider-verify",async(req,res,next)=>{try{
 await paymentMode.assertProviderWriteAccess(db,req.user.sub);
 if(!(await requirePin(req.user.sub,req.body.pin)))return res.status(403).json({error:"Enter your transaction PIN before submitting identity verification"});
 const bvn=String(req.body.bvn||"").replace(/\D/g,""),account=String(req.body.accountNumber||"").replace(/\D/g,""),bankCode=String(req.body.bankCode||"").trim();
 if(bvn.length!==11||account.length!==10||!bankCode)return res.status(400).json({error:"Enter a valid 11-digit BVN, 10-digit account number and bank."});
 const bvnFingerprint=identityFingerprint("BVN:"+bvn),bankFingerprint=identityFingerprint("BANK:"+bankCode+":"+account);
 const duplicate=(await db.query("SELECT user_id FROM kyc_profiles WHERE user_id<>$1 AND (bvn_fingerprint=$2 OR bank_account_fingerprint=$3) LIMIT 1",[req.user.sub,bvnFingerprint,bankFingerprint])).rows[0];
 if(duplicate)return res.status(409).json({error:"This identity or verified bank account is already associated with another OptiSave account. Contact Support if you believe this is an error."});
 const u=(await db.query("SELECT id,email,full_name,phone FROM users WHERE id=$1",[req.user.sub])).rows[0];if(!u)return res.status(404).json({error:"User not found"});
 const names=String(u.full_name||"").trim().split(/\s+/);if(names.length<2)return res.status(400).json({error:"Your profile must contain your legal first and last name before verification."});
 const first=names[0],last=names[names.length-1];
 let customer;
 try{customer=(await paystack("/customer/"+encodeURIComponent(u.email))).data}catch(e){
   customer=(await paystack("/customer",{method:"POST",body:JSON.stringify({email:u.email,first_name:first,last_name:last,phone:u.phone||undefined})})).data
 }
 const code=customer?.customer_code;if(!code)throw Object.assign(Error("Unable to create/fetch Paystack customer"),{status:502});
 // v1.32: prepare the exact bank supplied during KYC as the withdrawal destination.
 // The full account number is used only for the Paystack call and is never persisted by OptiSave.
 let bankName=bankCode==="007"?"Paystack Test Bank":"Verified bank",recipientCode=null,recipientAccountName=u.full_name||`${first} ${last}`;
 try{
   if(bankCode!=="007"){
     const banks=await paystack("/bank?country=nigeria&perPage=100");
     const found=(banks.data||[]).find(b=>String(b.code)===bankCode);if(found?.name)bankName=String(found.name);
   }
   const recipient=await paystack('/transferrecipient',{method:'POST',body:JSON.stringify({type:'nuban',name:recipientAccountName,account_number:account,bank_code:bankCode,currency:'NGN',description:'OptiSave KYC withdrawal account'})});
   recipientCode=String(recipient.data?.recipient_code||'')||null;
   if(recipient.data?.details?.account_name)recipientAccountName=String(recipient.data.details.account_name);
 }catch(recipientError){console.warn('KYC withdrawal recipient preparation deferred:',recipientError.message)}
 const c=await db.pool.connect();
 try{
   await c.query('BEGIN');
   await c.query(`INSERT INTO kyc_profiles(user_id,status,provider_customer_code,provider_status,provider_reason,verification_attempts,last_verification_started_at,bvn_fingerprint,bank_account_fingerprint,updated_at) VALUES($1,'verification_in_progress',$2,'pending',NULL,1,NOW(),$3,$4,NOW()) ON CONFLICT(user_id) DO UPDATE SET status='verification_in_progress',provider_customer_code=$2,provider_status='pending',provider_reason=NULL,review_reason=NULL,verification_attempts=COALESCE(kyc_profiles.verification_attempts,0)+1,last_verification_started_at=NOW(),verified_at=NULL,bvn_fingerprint=$3,bank_account_fingerprint=$4,updated_at=NOW()`,[req.user.sub,code,bvnFingerprint,bankFingerprint]);
   await c.query('UPDATE bank_accounts SET is_primary=false WHERE user_id=$1',[req.user.sub]);
   await c.query(`INSERT INTO bank_accounts(user_id,bank_name,bank_code,account_number_last4,account_name,is_verified,is_primary,provider_recipient_code) VALUES($1,$2,$3,$4,$5,false,true,$6)`,[req.user.sub,bankName,bankCode,account.slice(-4),recipientAccountName,recipientCode]);
   await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 try{
  const result=await paystack("/customer/"+encodeURIComponent(code)+"/identification",{method:"POST",body:JSON.stringify({country:"NG",type:"bank_account",account_number:account,bvn,bank_code:bankCode,first_name:first,last_name:last})});
  res.status(202).json({status:"verification_in_progress",withdrawalAccountPrepared:!!recipientCode,message:result.message||"Customer Identification in progress"});
 }catch(providerError){
  const reason=String(providerError.message||"Identity verification could not be started. Please check your details and re-verify.").slice(0,1000);
  await db.query("UPDATE kyc_profiles SET status='action_required',provider_status='failed',provider_reason=$1,provider_checked_at=NOW(),bvn_fingerprint=NULL,bank_account_fingerprint=NULL,updated_at=NOW() WHERE user_id=$2",[reason,req.user.sub]);
  return res.status(providerError.status||502).json({error:reason,kyc:{normalized_status:"action_required",status_label:"Action required",next_action:"retry",can_retry:true}});
 }
}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}});

r.patch("/notifications/:id/read",async(req,res,next)=>{try{await db.query("UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2",[req.params.id,req.user.sub]);res.json({ok:true})}catch(e){next(e)}});
r.post("/notifications/read-all",async(req,res,next)=>{try{await db.query("UPDATE notifications SET is_read=true WHERE user_id=$1",[req.user.sub]);res.json({ok:true})}catch(e){next(e)}});
r.get("/settings",async(req,res,next)=>{try{const q=await db.query("SELECT notification_preferences FROM user_settings WHERE user_id=$1",[req.user.sub]);res.json({notificationPreferences:q.rows[0]?.notification_preferences||{moneyAlerts:true,savingAlerts:true,reminderAlerts:true}})}catch(e){next(e)}});
r.put("/settings/notifications",async(req,res,next)=>{try{const p=req.body||{};const clean={moneyAlerts:p.moneyAlerts!==false,savingAlerts:p.savingAlerts!==false,reminderAlerts:p.reminderAlerts!==false};await db.query(`INSERT INTO user_settings(user_id,notification_preferences) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET notification_preferences=EXCLUDED.notification_preferences,updated_at=NOW()`,[req.user.sub,JSON.stringify(clean)]);res.json({notificationPreferences:clean})}catch(e){next(e)}});

r.post("/dev/reset",async(req,res,next)=>{
 if(process.env.NODE_ENV!=="development")return res.status(404).json({error:"Not available"});
 if(String(req.body.confirm||"")!=="RESET")return res.status(400).json({error:"Type RESET to confirm"});
 const c=await db.pool.connect();try{await c.query("BEGIN");
  await c.query("DELETE FROM financial_ledger WHERE user_id=$1",[req.user.sub]);
  await c.query("DELETE FROM idempotency_requests WHERE user_id=$1",[req.user.sub]);
  await c.query("DELETE FROM transactions WHERE user_id=$1",[req.user.sub]);
  await c.query("DELETE FROM plans WHERE user_id=$1",[req.user.sub]);
  await c.query("DELETE FROM notifications WHERE user_id=$1",[req.user.sub]);
  await c.query("UPDATE wallets SET available_balance=0,total_deposited=0,total_withdrawn=0,total_locked=0,total_credited=0,updated_at=NOW() WHERE user_id=$1",[req.user.sub]);
  await c.query("COMMIT");res.json({ok:true});
 }catch(e){await c.query("ROLLBACK");next(e)}finally{c.release()}
});


/* v1.40 real security activity and active device sessions */
r.get('/security/activity',async(req,res,next)=>{try{const q=await db.query("SELECT id,event_type,ip_address,user_agent,created_at FROM login_events WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",[req.user.sub]);res.json({events:q.rows})}catch(e){next(e)}});
r.get('/security/sessions',async(req,res,next)=>{try{const q=await db.query("SELECT id,device_label,browser_label,location_label,created_at,last_seen_at FROM account_sessions WHERE user_id=$1 AND revoked_at IS NULL ORDER BY last_seen_at DESC",[req.user.sub]);res.json({currentSessionId:req.user.sid||null,sessions:q.rows})}catch(e){next(e)}});
r.delete('/security/sessions/:id',async(req,res,next)=>{try{if(String(req.params.id)===String(req.user.sid||''))return res.status(400).json({error:'Use Log out to end your current device session'});await db.query('UPDATE account_sessions SET revoked_at=NOW() WHERE id=$1 AND user_id=$2',[req.params.id,req.user.sub]);res.json({ok:true})}catch(e){next(e)}});
r.post('/security/sessions/revoke-others',async(req,res,next)=>{try{await db.query('UPDATE account_sessions SET revoked_at=NOW() WHERE user_id=$1 AND id<>$2 AND revoked_at IS NULL',[req.user.sub,req.user.sid||null]);res.json({ok:true})}catch(e){next(e)}});

module.exports=r;
