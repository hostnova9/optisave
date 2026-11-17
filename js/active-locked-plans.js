/* OptiSave Active Plans */
let allPlans=[], currentFilter="all";
const money=n=>"₦"+Number(n||0).toLocaleString();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const lagosYMD=(value=new Date())=>new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));
const scheduleText=v=>v?new Intl.DateTimeFormat("en-NG",{timeZone:"Africa/Lagos",day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(v)):"--";

document.addEventListener("DOMContentLoaded",async()=>{if(typeof optisaveStateReady==="function")await optisaveStateReady();loadPlans();bindFilters();});
function loadPlans(){allPlans=(getPlans()||[]).filter(p=>String(p.status||"Active").toLowerCase()==="active");updateSummary();renderPlans();}
function updateSummary(){
 document.getElementById("totalPlans").textContent=allPlans.length;
 let locked=0,daily=0,alloc=0;
 allPlans.forEach(p=>{
   if(p.type==="daily"){daily++;locked+=Number(p.savedAmount||0);}
   else if(p.type==="allocation"){locked+=Number(p.remainingLocked||0);alloc+=Number(p.allocationRemaining>0?p.dailyAllocation:0);}
   else locked+=Number(p.amount||p.totalAmount||0);
 });
 document.getElementById("totalLocked").textContent=money((typeof getWallet==="function"?getWallet().totalLocked:locked));
 document.getElementById("dailyPlans").textContent=daily;
 document.getElementById("todayAllocation").textContent=money(alloc);
}
function bindFilters(){document.querySelectorAll(".filter-btn").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filter-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");currentFilter=b.dataset.filter;renderPlans();});}
function renderPlans(){
 const c=document.getElementById("plansContainer"), empty=document.getElementById("emptyState");c.innerHTML="";
 const plans=currentFilter==="all"?allPlans:allPlans.filter(p=>p.type===currentFilter);
 if(!plans.length){empty.style.display="block";return;} empty.style.display="none";
 plans.forEach(p=>c.insertAdjacentHTML("beforeend",card(p)));
}
function card(p){
 let badge="LOCK ONLY",cls="badge-lock",details="",actions=`<button class="view-btn" onclick="showPlan('${p.id}')">View Details</button>`;
 if(p.type==="lock"||p.type==="allocation"){
   const eq=getEmergencyWithdrawalQuote(p);
   if(p.type==="lock"){
     const aq=getLockOnlyAllocationQuote(p);
     actions+=`<button class="more-btn allocate-lock-btn" ${aq.eligible?"":"disabled"} onclick="openLockAllocation('${p.id}')">${aq.eligible?"Allocate 50%":"50% Allocation Used"}</button>`;
   }
   const emergencyLabel=eq.eligible?"Emergency 50%":(eq.used?"Emergency Used":(eq.daysUntilEligible?`Available in ${eq.daysUntilEligible} day${eq.daysUntilEligible===1?"":"s"}`:"Emergency Locked"));
   actions+=`<button class="more-btn emergency-btn" ${eq.eligible?"":"disabled"} onclick="doEmergency('${p.id}')">${emergencyLabel}</button>`;
 }
 if(p.type==="daily"){
   badge="DAILY SAVING";cls="badge-daily";
   const duration=Math.max(1,Number(p.duration||1)),done=Number(p.completedDays||0),saved=Number(p.savedAmount||0),target=Number(p.totalTarget||p.totalAmount||0),pct=Math.min(100,Math.round(done/duration*100)), access=getDailySavingAccess(p);
   details=`<div class="daily-progress"><div><span>${done} of ${duration} saving days</span><b>${pct}%</b></div><div class="plan-progress"><i style="width:${pct}%"></i></div></div>
   <div class="detail-box"><div class="detail-label">Saved</div><div class="detail-value">${money(saved)}</div></div>
   <div class="detail-box"><div class="detail-label">Target</div><div class="detail-value">${money(target)}</div></div>
   <div class="detail-box"><div class="detail-label">Daily Amount</div><div class="detail-value">${money(p.dailyAmount)}</div></div>
   <div class="detail-box"><div class="detail-label">Next Saving</div><div class="detail-value">${scheduleText(p.nextDebitDate)}</div></div>
   <div class="detail-box"><div class="detail-label">Weekends</div><div class="detail-value">${p.excludeWeekend?"Excluded":"Included"}</div></div>
   <div class="detail-box"><div class="detail-label">Payment</div><div class="detail-value">${p.pendingToday?"Pending — fund wallet":"On schedule"}</div></div>`;
   actions+=`<button class="more-btn" ${access.eligible?"":"disabled"} onclick="earlyAccess('${p.id}')">${access.eligible?"Access 50%":"Early Access Locked"}</button>`;
 } else if(p.type==="allocation"){
   badge="LOCK + ALLOCATION";cls="badge-allocation";
   const eq2=getEmergencyWithdrawalQuote(p);
   details=`<div class="detail-box"><div class="detail-label">Remaining Locked</div><div class="detail-value">${money(p.remainingLocked)}</div></div><div class="detail-box"><div class="detail-label">Allocation Remaining</div><div class="detail-value">${money(p.allocationRemaining)}</div></div><div class="detail-box"><div class="detail-label">Frequency</div><div class="detail-value">${String(p.allocationFrequency||"daily").toLowerCase()==="weekly"?"Weekly":"Daily"}</div></div><div class="detail-box"><div class="detail-label">Next Release</div><div class="detail-value">${scheduleText(p.nextAllocationDate)}</div></div><div class="detail-box"><div class="detail-label">Emergency Access</div><div class="detail-value">${eq2.eligible?"Available now":(eq2.used?"Already used":(eq2.eligibleAt?new Date(eq2.eligibleAt).toLocaleDateString():"Locked"))}</div></div>`;
 } else {
   const eq2=getEmergencyWithdrawalQuote(p);
   details=`<div class="detail-box"><div class="detail-label">Locked Amount</div><div class="detail-value">${money(p.remainingLocked!==undefined?p.remainingLocked:(p.amount||p.totalAmount))}</div></div><div class="detail-box"><div class="detail-label">Duration</div><div class="detail-value">${p.duration||0}${[3,6,12,24].includes(Number(p.duration))?" Months":" Days"}</div></div><div class="detail-box"><div class="detail-label">Purpose</div><div class="detail-value">${esc(p.purpose||"General")}</div></div><div class="detail-box"><div class="detail-label">Emergency Access</div><div class="detail-value">${eq2.eligible?"Available now":(eq2.used?"Already used":(eq2.eligibleAt?new Date(eq2.eligibleAt).toLocaleDateString():"Locked"))}</div></div>`;
 }
 return `<div class="plan-card"><div class="plan-header"><div class="plan-title">${esc(p.planName||"Savings Plan")}</div><div class="plan-badge ${cls}">${badge}</div></div><div class="plan-details">${details}</div><div class="status-row"><div class="status-pill">${esc(p.status||"Active")}</div></div><div class="plan-actions">${actions}</div></div>`;
}
function showPlan(id){
 const p=allPlans.find(x=>String(x.id)===String(id)); if(!p)return;
 if(typeof setSelectedPlan==="function")setSelectedPlan(p.id);
 window.location.href="plan-details.html?id="+encodeURIComponent(p.id);
}
async function earlyAccess(id){
 const p=allPlans.find(x=>String(x.id)===String(id));if(!p)return;
 const access=getDailySavingAccess(p);if(!access.eligible)return alert(access.reason);
 if(!confirm(`Move ${money(access.amount)} (50% of your current saved balance) to your available wallet?\n\nThis early access can only be used once for this plan.`))return;
 const r=await requestDailySavingEarlyAccess(id);alert(r.message);loadPlans();
}
async function doEmergency(id){
 const p=allPlans.find(x=>String(x.id)===String(id));if(!p)return;
 const q=getEmergencyWithdrawalQuote(p);if(!q.eligible)return alert(q.reason);
 if(!confirm(`Emergency withdrawal will move ${money(q.amount)} to your available wallet.\n\nFor Lock & Allocation plans, any further allocations will be disabled until maturity. Continue?`))return;
 const r=await emergencyWithdraw(id);alert(r.ok?money(r.amount)+" moved to your available wallet.":r.message);loadPlans();
}

let pendingLockAllocationId=null;
function openLockAllocation(id){
 const p=allPlans.find(x=>String(x.id)===String(id));if(!p)return;
 const q=getLockOnlyAllocationQuote(p);if(!q.eligible)return alert(q.reason);
 pendingLockAllocationId=id;
 document.getElementById("lockAllocationSummary").textContent=`${money(q.amount)} will enter the allocation schedule and ${money(q.remainingLocked)} will remain locked.`;
 const date=document.getElementById("lockAllocationStartDate"),today=lagosYMD();
 date.min=today;date.value=today;document.getElementById("lockAllocationStartMode").value="now";
 document.getElementById("lockAllocationDateWrap").hidden=true;document.getElementById("lockAllocationModal").hidden=false;
}
function closeLockAllocation(){document.getElementById("lockAllocationModal").hidden=true;pendingLockAllocationId=null;}
document.addEventListener("DOMContentLoaded",()=>{
 const mode=document.getElementById("lockAllocationStartMode");
 if(mode)mode.onchange=()=>document.getElementById("lockAllocationDateWrap").hidden=mode.value!=="later";
 const close=document.getElementById("closeLockAllocationModal");if(close)close.onclick=closeLockAllocation;
 const modal=document.getElementById("lockAllocationModal");if(modal)modal.onclick=e=>{if(e.target===modal)closeLockAllocation();};
 const btn=document.getElementById("confirmLockAllocation");
 if(btn)btn.onclick=async()=>{
   const mode=document.getElementById("lockAllocationStartMode").value,date=document.getElementById("lockAllocationStartDate").value;
   if(mode==="later"&&!date)return alert("Choose an allocation start date.");
   const r=await startLockOnlyAllocation(pendingLockAllocationId,{allocationDays:Number(document.getElementById("lockAllocationDays").value),allocationFrequency:document.getElementById("lockAllocationFrequency").value||"daily",startMode:mode,startDate:mode==="later"?date:lagosYMD(),excludeWeekend:document.getElementById("lockAllocationWeekend").checked});
   if(!r.ok)return alert(r.message);
   closeLockAllocation();alert(`${money(r.amount)} is now scheduled for allocation. ${money(r.remainingLocked)} remains locked.`);loadPlans();
 };
});
