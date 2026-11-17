/* OptiSave PostgreSQL client facade — no financial/account state is stored in localStorage. */
const DEFAULT_WALLET={balance:0,totalDeposited:0,totalWithdrawn:0,totalLocked:0,totalAllocated:0,totalDaily:0,totalCredited:0};
let __state={wallet:{...DEFAULT_WALLET},plans:[],transactions:[],notifications:[]},__ready=null,__lastRefreshAt=0;
function mapState(d){
 const w=d.wallet||{},summary=d.financialSummary||{};
 __state.wallet={balance:Number(w.available_balance||0),totalDeposited:Number(w.total_deposited||0),totalWithdrawn:Number(w.total_withdrawn||0),totalLocked:Number(w.total_locked||0),totalDaily:Number(summary.dailySaved||0),totalCredited:Number(w.total_credited||0)};
 __state.plans=(d.plans||[]).map(r=>{
  const m=r.metadata&&typeof r.metadata==="object"?r.metadata:{};
  const totalEvents=Number(r.schedule_total_events||m.totalEvents||m.allocationDays||m.duration||0),completedEvents=Number(r.schedule_completed_events||m.completedEvents||m.completedDays||0),eventAmount=Number(r.event_amount||m.eventAmount||m.dailyAllocation||r.daily_amount||0);
  return {...m,id:r.id,dbId:r.id,planName:r.plan_name,planType:r.plan_type==="lock"?"Lock Only":r.plan_type==="allocation"?"Lock & Allocation":"Daily Saving",type:r.plan_type,amount:Number(r.original_amount||0),totalAmount:Number(r.original_amount||0),remainingLocked:Number(r.remaining_locked||0),allocationPercent:Number(r.allocation_percent||0),allocationAmount:Number(r.allocation_amount||0),allocationRemaining:Number(r.allocation_remaining||0),allocationReleased:Math.max(0,Number(r.allocation_amount||0)-Number(r.allocation_remaining||0)),savedAmount:Number(r.saved_amount||0),dailyAmount:Number(r.daily_amount||0),dailyAllocation:r.plan_type==="allocation"?eventAmount:Number(r.daily_amount||0),eventAmount,totalEvents,allocationDays:r.plan_type==="allocation"?totalEvents:Number(m.allocationDays||0),duration:r.plan_type==="daily"?totalEvents:Number(m.duration||0),completedEvents,completedDays:r.plan_type==="daily"?completedEvents:Number(m.completedDays||0),startDate:r.start_at,createdAt:r.created_at,maturityDate:r.maturity_at,nextEventAt:r.next_event_at,nextAllocationDate:r.plan_type==="allocation"?r.next_event_at:null,nextDebitDate:r.plan_type==="daily"?r.next_event_at:null,lastEventAt:r.last_event_at,excludeWeekend:!!r.exclude_weekends,emergencyUsed:!!r.emergency_used,allocationConverted:!!r.allocation_converted,dailyEarlyAccessUsed:!!r.daily_early_access_used,maturedAt:r.matured_at,status:r.status};
 });
 __state.transactions=(d.transactions||[]).map(x=>({id:x.id,type:x.type,title:x.type,amount:Number(x.amount||0),direction:x.direction,description:x.description,status:x.status,date:x.created_at,createdAt:x.created_at,reference:x.reference,planId:x.plan_id,metadata:x.metadata||{}}));
 __state.notifications=(d.notifications||[]).map(x=>({id:x.id,title:x.title,message:x.message,type:x.type,read:x.is_read,is_read:x.is_read,actionUrl:x.action_url||"",action_url:x.action_url||"",date:x.created_at,created_at:x.created_at}));
 document.dispatchEvent(new CustomEvent("optisave:state"));window.dispatchEvent(new CustomEvent("optisave:notifications"));return __state;
}
async function refreshOptiSaveState(){if(!window.OptiSaveAPI)return __state;try{const mapped=mapState(await OptiSaveAPI.state());__lastRefreshAt=Date.now();return mapped}catch(e){console.error("PostgreSQL state:",e);return __state}}
function normalizeAllocationPlan(p){
 p=p||{};
 const type=String(p.type||p.planType||"").toLowerCase();
 const allocationAmount=toNumber(p.allocationAmount||p.allocation_amount);
 const allocationRemaining=Number.isFinite(Number(p.allocationRemaining))?Number(p.allocationRemaining):Number.isFinite(Number(p.allocation_remaining))?Number(p.allocation_remaining):allocationAmount;
 const eventAmount=toNumber(p.eventAmount||p.event_amount||p.dailyAllocation);
 const nextEvent=p.nextAllocationDate||p.nextEventAt||p.next_event_at||null;
 return {...p,type:type.includes("allocation")?"allocation":p.type,allocationAmount,allocationRemaining,eventAmount,dailyAllocation:eventAmount,nextAllocationDate:nextEvent,nextEventAt:nextEvent};
}
window.normalizeAllocationPlan=normalizeAllocationPlan;
function optisaveStateReady(){return __ready||Promise.resolve(__state)}
__ready=refreshOptiSaveState();
function getWallet(){return {...__state.wallet}} function getPlans(){return __state.plans.slice()} function getTransactions(){return __state.transactions.slice()} function getNotifications(){return __state.notifications.slice()}
function getPlanById(id){return __state.plans.find(p=>String(p.id)===String(id))||null}
function setSelectedPlan(id){if(id===undefined||id===null||id===""){sessionStorage.removeItem("optisave_selected_plan_id");return;}sessionStorage.setItem("optisave_selected_plan_id",String(id))}
function getSelectedPlan(){const id=sessionStorage.getItem("optisave_selected_plan_id");return id?getPlanById(id):null}
async function markNotificationRead(id){await OptiSaveAPI.markNotificationRead(id);await refreshOptiSaveState()}
async function markAllNotificationsRead(){await OptiSaveAPI.markAllNotificationsRead();await refreshOptiSaveState()}
function toNumber(v){const n=Number(v);return Number.isFinite(n)?n:0}
function getPlanTotal(p){return toNumber(p.totalAmount||p.amount||p.savedAmount)}
function getAllocationPool(p){return toNumber(p.allocationAmount)||(getPlanTotal(p)*toNumber(p.allocationPercent)/100)}
function getLockedAmount(p){return toNumber(p.remainingLocked||p.lockedAmount)||Math.max(0,getPlanTotal(p)-getAllocationPool(p))}
function getEmergencyWithdrawalQuote(p){const start=new Date(p.startDate||p.createdAt||Date.now()),maturity=new Date(p.maturityDate||start),eligibleAt=new Date(start.getTime()+(maturity.getTime()-start.getTime())/2),used=!!p.emergencyUsed,remaining=getLockedAmount(p),eligible=!used&&Date.now()>=eligibleAt.getTime()&&remaining>0,days=Math.max(0,Math.ceil((eligibleAt-Date.now())/86400000));return{used,eligible,eligibleAt:eligibleAt.toISOString(),daysUntilEligible:days,amount:Math.round(remaining*.5*100)/100,remainingLocked:remaining,reason:used?"Emergency access has already been used.":eligible?"Emergency access is available now.":`Emergency access becomes available at the halfway point${days?` in ${days} day${days===1?"":"s"}`:""}.`}}
/* Legacy mutation entry points are intentionally blocked: money changes must use authenticated API routes. */
function saveWallet(){throw Error("Direct wallet storage is disabled. Use the PostgreSQL API.")}
function savePlans(){throw Error("Direct plan storage is disabled. Use the PostgreSQL API.")}
function saveTransactions(){throw Error("Direct transaction storage is disabled. Use the PostgreSQL API.")}
function addPlan(){throw Error("Direct plan storage is disabled. Use the PostgreSQL API.")}
function lockMoney(){throw Error("Direct wallet mutation is disabled. Use the PostgreSQL API.")}
function allocateMoney(){throw Error("Direct wallet mutation is disabled. Use the PostgreSQL API.")}
function saveDailyMoney(){throw Error("Direct wallet mutation is disabled. Use the PostgreSQL API.")}
function processScheduledSavings(){return false} function processMaturedPlans(){return false} function processAllocationReleases(){return false}

/* v1.21 eligibility helpers. These only render quotes; the server re-checks every rule under SQL row locks before money moves. */
function getLockOnlyAllocationQuote(p){const remaining=getLockedAmount(p),used=!!p.allocationConverted||p.type!=="lock";return{used,eligible:p.type==="lock"&&!used&&!p.emergencyUsed&&remaining>0,amount:Math.round(remaining*.5*100)/100,remainingLocked:Math.round(remaining*.5*100)/100,reason:used?"The 50% allocation conversion has already been used.":p.emergencyUsed?"Allocation is disabled after emergency access.":"Convert exactly 50% of the currently locked balance into an allocation schedule."}}
function getDailySavingAccess(p){const duration=Math.max(1,Number(p.duration||1)),done=Number(p.completedDays||0),need=Math.ceil(duration/2),saved=Number(p.savedAmount||0),used=!!p.dailyEarlyAccessUsed;return{used,eligible:p.type==="daily"&&!used&&done>=need&&saved>0,amount:Math.round(saved*.5*100)/100,requiredDays:need,reason:used?"Early access has already been used for this plan.":done<need?`Complete ${need} saving days before early access becomes available.`:saved<=0?"There is no saved balance available for early access.":"50% of the current saved balance is available once."}}
async function requestDailySavingEarlyAccess(id){try{const r=await OptiSaveAPI.dailyEarlyAccess(id);await refreshOptiSaveState();return{ok:true,amount:r.amount,message:`₦${Number(r.amount||0).toLocaleString()} moved to your available wallet.`}}catch(e){return{ok:false,message:e.message}}}
async function emergencyWithdraw(id){try{const r=await OptiSaveAPI.emergencyWithdraw(id);await refreshOptiSaveState();return{ok:true,amount:r.amount,message:"Emergency withdrawal completed."}}catch(e){return{ok:false,message:e.message}}}
async function startLockOnlyAllocation(id,options){try{const r=await OptiSaveAPI.convertAllocation(id,options||{});await refreshOptiSaveState();return{ok:true,amount:r.amount,remainingLocked:r.remainingLocked}}catch(e){return{ok:false,message:e.message}}}

/* v1.43 freshness bridge: pages never intentionally render an old financial snapshot after returning to them. */
(function(){
 let busy=false;
 async function fresh(force){
  if(busy||document.hidden||!window.OptiSaveAPI?.token?.())return;
  if(!force && Date.now()-__lastRefreshAt<2500)return;
  busy=true;try{await refreshOptiSaveState()}finally{busy=false}
 }
 window.addEventListener("pageshow",()=>fresh(true));
 window.addEventListener("focus",()=>fresh(false));
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)fresh(true)});
})();
