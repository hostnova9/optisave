/* OptiSave Allocation Center — no demo/hard-coded financial data */
let plan=null,timer=null;
const $=id=>document.getElementById(id), money=n=>"₦"+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
document.addEventListener("DOMContentLoaded",async()=>{
 if(typeof optisaveStateReady==="function")await optisaveStateReady();
 if(typeof refreshOptiSaveState==="function")await refreshOptiSaveState();
 const plans=(getPlans()||[]).map(p=>typeof normalizeAllocationPlan==="function"?normalizeAllocationPlan(p):p).filter(p=>{const t=String(p.type||"").toLowerCase(),pt=String(p.planType||"").toLowerCase(),s=String(p.status||"active").toLowerCase();return (t==="allocation"||pt.includes("allocation")||Number(p.allocationAmount||0)>0)&&!["completed","cancelled","matured"].includes(s);});
 plan=plans.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))[0]||null;
 const select=$("allocationPlanSelect");
 if(plans.length){select.innerHTML=plans.map((p,i)=>`<option value="${p.id}">${p.planName||"Allocation Plan "+(i+1)}</option>`).join("");$("allocationPlanCount").textContent=plans.length+" active "+(plans.length===1?"plan":"plans");$("allocationSwitcher").hidden=plans.length<2;select.value=plan.id;select.addEventListener("change",()=>{plan=plans.find(p=>String(p.id)===String(select.value))||plans[0];render();});}
 document.querySelector(".back-btn")?.addEventListener("click",()=>window.location.href="dashboard.html");
 $("viewPlanBtn")?.addEventListener("click",()=>location.href="active-locked-plans.html");
 $("historyBtn")?.addEventListener("click",()=>location.href="transactions.html");
 if(!plan){$("emptyAllocation").hidden=false;$("allocationContent").hidden=true;return;}
 $("allocationContent").hidden=false;$("emptyAllocation").hidden=true;render();timer=setInterval(updateCountdown,1000);
});
function dateText(v){if(!v)return"—";const d=new Date(v);return isNaN(d)?"—":d.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});}
function render(){
 const total=Number(plan.totalAmount||plan.amount||0),pool=Number(plan.allocationAmount||0),rem=Number(plan.allocationRemaining??pool),released=Math.max(0,pool-rem),locked=Number(plan.remainingLocked||0),daily=Number(plan.eventAmount||plan.dailyAllocation||0);
 const pct=pool?Math.min(100,Math.max(0,released/pool*100)):0;
 $("planName").textContent=plan.planName||"Lock & Allocation";$("nextAmount").textContent=money(Math.min(daily,rem));$("originalLock").textContent=money(total);$("allocationPool").textContent=money(pool);$("releasedSoFar").textContent=money(released);$("allocationRemaining").textContent=money(rem);$("stillLocked").textContent=money(locked);$("allocationRate").textContent=Number(plan.allocationPercent||0)+"%";$("dailyRelease").textContent=money(daily);$("weekendRule").textContent=plan.excludeWeekend?"Excluded":"Included";$("maturityDate").textContent=dateText(plan.maturityDate);
 $("progressFill").style.width=pct+"%";$("progressAllocated").textContent=Math.round(pct)+"% Released";$("progressRemaining").textContent=Math.max(0,100-Math.round(pct))+"% Remaining";
 const left=Math.max(0,Number(plan.totalEvents||plan.allocationDays||0)-Number(plan.completedEvents||0));$("releasesLeft").textContent=left;$("releaseFrequency").textContent=String(plan.allocationFrequency||"daily").toLowerCase()==="weekly"?"Weekly":"Daily";
 const canonicalNext=plan.nextEventAt||plan.nextAllocationDate||null; const next=canonicalNext?new Date(canonicalNext):null;$("nextDate").textContent=next&&!isNaN(next)?dateText(next):"—";$("nextTime").textContent=next&&!isNaN(next)?next.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"—";
 $("nextStatus").textContent=plan.allocationsDisabled?"Disabled":rem>0?"Scheduled":"Completed";
 const frequency=String(plan.allocationFrequency||"daily").toLowerCase()==="weekly"?"weekly":"daily";$("guideText").textContent=plan.allocationsDisabled?"Further allocation releases are disabled because an emergency withdrawal was used.":rem>0?`Your allocation pool is released ${frequency} from the amount already locked. No second deduction is made.`:"Your allocation pool has been fully released. The remaining locked portion stays locked until maturity.";
 renderTimeline();updateCountdown();
}
function renderTimeline(){
 const box=$("timeline"),tx=(getTransactions()||[]).filter(t=>String(t.planId||"")===String(plan.id||"")&&String(t.type||"").toLowerCase()==="allocation release");
 if(!tx.length){box.innerHTML='<div class="timeline-empty">No allocation release has happened yet.</div>';return;}
 box.innerHTML=tx.slice(0,8).map(t=>`<div class="timeline-item completed"><div class="timeline-icon"><i class="fas fa-check"></i></div><div class="timeline-content"><h4>${dateText(t.date)}</h4><p>${money(t.amount)} • ${String(t.type||"Allocation")}</p></div><span class="status success">Completed</span></div>`).join("");
}
function updateCountdown(){
 if(!plan||plan.allocationsDisabled||!(plan.nextEventAt||plan.nextAllocationDate)){$("allocationCountdown").textContent="--:--:--";return;}
 const diff=new Date(plan.nextEventAt||plan.nextAllocationDate)-new Date();if(diff<=0){$("allocationCountdown").textContent="Processing…";return;}
 const d=Math.floor(diff/86400000),h=Math.floor(diff%86400000/3600000),m=Math.floor(diff%3600000/60000),s=Math.floor(diff%60000/1000);
 $("allocationCountdown").textContent=(d?d+"d ":"")+String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
}