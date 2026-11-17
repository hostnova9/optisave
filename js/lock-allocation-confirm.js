let reviewPlan=null;
document.addEventListener("DOMContentLoaded",loadReview);
function money(v){return "₦"+Number(v||0).toLocaleString(undefined,{maximumFractionDigits:2})}
function dateText(v){const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleDateString(undefined,{timeZone:"Africa/Lagos",day:"numeric",month:"short",year:"numeric"})}
function loadReview(){
 reviewPlan=JSON.parse(sessionStorage.getItem("allocationPlanReview"));
 if(!reviewPlan){location.href="lock-allocation.html";return}
 const wallet=getWallet(),amount=Number(reviewPlan.amount||0),allocationAmount=Number(reviewPlan.allocationAmount||0),remainingLocked=Number(reviewPlan.remainingLocked||0),frequency=reviewPlan.allocationFrequency==="weekly"?"Weekly":"Daily",events=Number(reviewPlan.allocationEvents||0),release=Number(reviewPlan.releaseAmount||0);
 document.getElementById("reviewPlanName").textContent=reviewPlan.planName||"—";
 document.getElementById("reviewPurpose").textContent=reviewPlan.purpose||"—";
 document.getElementById("reviewStartDate").textContent=dateText(reviewPlan.allocationStartDate||reviewPlan.startDate);
 document.getElementById("reviewMaturity").textContent=dateText(reviewPlan.maturityDate);
 document.getElementById("reviewAmount").textContent=money(amount);
 document.getElementById("reviewDuration").textContent=Number(reviewPlan.duration||0)+" Days";
 document.getElementById("reviewPercent").textContent=Number(reviewPlan.allocationPercent||0)+"%";
 document.getElementById("reviewAllocation").textContent=money(allocationAmount);
 document.getElementById("reviewRemaining").textContent=money(remainingLocked);
 document.getElementById("reviewWeekend").textContent=reviewPlan.excludeWeekend?"Excluded":"Included";
 document.getElementById("reviewFrequency").textContent=frequency;
 document.getElementById("reviewAllocationDays").textContent=events+" Releases";
 document.getElementById("reviewDaily").textContent=money(release);
 document.getElementById("walletBefore").textContent=money(wallet.balance);
 document.getElementById("walletLock").textContent=money(amount);
 document.getElementById("walletAfter").textContent=money(wallet.balance-amount);
}
document.getElementById("confirmAllocationPlan").addEventListener("click",confirmPlan);
async function confirmPlan(){
 const btn=document.getElementById("confirmAllocationPlan");btn.disabled=true;
 try{
  await OptiSaveAPI.createPlan({type:"allocation",planName:reviewPlan.planName,purpose:reviewPlan.purpose,amount:Number(reviewPlan.amount),allocationPercent:Number(reviewPlan.allocationPercent),duration:Number(reviewPlan.duration),allocationFrequency:reviewPlan.allocationFrequency||"daily",startMode:reviewPlan.startMode||"now",startDate:reviewPlan.startDate,excludeWeekend:!!reviewPlan.excludeWeekend});
  sessionStorage.removeItem("allocationPlanReview");alert("Lock & Allocation Plan Created Successfully!");location.href="active-locked-plans.html";
 }catch(e){alert(e.message||"Unable to create plan.");btn.disabled=false}
}
function goBackToAllocationPlan(){history.back()}
