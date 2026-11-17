let selectedDuration=0,selectedAllocation=0;
document.addEventListener("DOMContentLoaded",async()=>{
 if(typeof optisaveStateReady==="function")await optisaveStateReady();
 if(typeof refreshOptiSaveState==="function")await refreshOptiSaveState();
 setToday();setupCompactForm();setupContinueButton();updateSummary();
});
function localISODate(d=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
function addYMD(ymd,days){const [y,m,d]=String(ymd).split("-").map(Number),x=new Date(Date.UTC(y,m-1,d+Number(days||0)));return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,"0")}-${String(x.getUTCDate()).padStart(2,"0")}`}
function weekdayYMD(ymd){const [y,m,d]=String(ymd).split("-").map(Number);return new Date(Date.UTC(y,m-1,d,12)).getUTCDay()}
function isWeekendYMD(ymd){const x=weekdayYMD(ymd);return x===0||x===6}
function atFive(ymd){return new Date(`${String(ymd).slice(0,10)}T05:00:00+01:00`)}
function firstEligibleYMD(ymd,exclude){while(exclude&&isWeekendYMD(ymd))ymd=addYMD(ymd,1);return ymd}
function nextEligibleYMD(ymd,exclude){return firstEligibleYMD(addYMD(ymd,1),exclude)}
function effectiveStart(startYMD,mode,now=new Date()){
 if(mode==="now")return new Date(now);
 const requested=atFive(startYMD);return requested>now?requested:new Date(now);
}
function firstFutureFive(start,exclude,now=new Date()){
 let ymd=firstEligibleYMD(localISODate(start),exclude),d=atFive(ymd);
 while(d<=now){ymd=nextEligibleYMD(ymd,exclude);d=atFive(ymd)}
 return d;
}
function nextReleaseDate(value,frequency,exclude){
 let ymd=localISODate(value);
 if(frequency==="weekly")ymd=firstEligibleYMD(addYMD(ymd,7),exclude);else ymd=nextEligibleYMD(ymd,exclude);
 return atFive(ymd);
}
function buildSchedule(startYMD,duration,exclude,mode,frequency,now=new Date()){
 const start=effectiveStart(startYMD,mode,now),maturity=new Date(start.getTime()+Number(duration||0)*86400000),first=firstFutureFive(start,exclude,now);
 let due=first,count=0,guard=0;
 while(due<maturity&&guard++<10000){count++;due=nextReleaseDate(due,frequency,exclude)}
 return {start,maturity,first,count};
}
function setToday(){const input=document.getElementById("startDate"),today=localISODate();input.min=today;input.value=today}
function setupCompactForm(){
 const purpose=document.getElementById("purpose"),customPurpose=document.getElementById("customPurposeWrap");purpose.addEventListener("change",()=>{customPurpose.hidden=purpose.value!=="custom";updateSummary()});document.getElementById("customPurpose").addEventListener("input",updateSummary);
 const duration=document.getElementById("durationSelect"),customWrap=document.getElementById("customDurationWrap"),custom=document.getElementById("customDuration");duration.addEventListener("change",()=>{customWrap.hidden=duration.value!=="custom";selectedDuration=duration.value==="custom"?(Number(custom.value)||0):(Number(duration.value)||0);updateSummary()});custom.addEventListener("input",()=>{selectedDuration=Number(custom.value)||0;updateSummary()});
 const allocation=document.getElementById("allocationSelect");allocation.addEventListener("change",()=>{selectedAllocation=Number(allocation.value)||0;updateSummary()});
 const mode=document.getElementById("allocationStartMode"),wrap=document.getElementById("allocationScheduledStart");mode.addEventListener("change",()=>{wrap.hidden=mode.value!=="later";if(mode.value==="now")document.getElementById("startDate").value=localISODate();updateSummary()});
 ["planName","lockAmount","startDate","excludeWeekend","allocationFrequency"].forEach(id=>document.getElementById(id).addEventListener(["excludeWeekend","allocationFrequency"].includes(id)?"change":"input",updateSummary));
}
function getPurpose(){const p=document.getElementById("purpose").value;return p==="custom"?document.getElementById("customPurpose").value.trim():p.trim()}
function getAllocationStartMode(){return document.getElementById("allocationStartMode").value||"now"}
function getFrequency(){return document.getElementById("allocationFrequency").value==="weekly"?"weekly":"daily"}
function formatMoney(v){return "₦"+Number(v||0).toLocaleString(undefined,{maximumFractionDigits:2})}
function updateSummary(){
 const amount=Number(document.getElementById("lockAmount").value)||0,alloc=amount*selectedAllocation/100,locked=amount-alloc,mode=getAllocationStartMode(),startYMD=mode==="later"?document.getElementById("startDate").value:localISODate(),exclude=document.getElementById("excludeWeekend").checked,frequency=getFrequency();
 document.getElementById("sumAmount").textContent=formatMoney(amount);document.getElementById("sumAllocation").textContent=selectedAllocation?`${selectedAllocation}% • ${formatMoney(alloc)}`:"—";document.getElementById("sumLocked").textContent=selectedAllocation?formatMoney(locked):"—";document.getElementById("sumDuration").textContent=selectedDuration?`${selectedDuration} days`:"—";document.getElementById("sumFrequency").textContent=frequency==="weekly"?"Weekly":"Daily";
 if(startYMD&&selectedDuration){const sch=buildSchedule(startYMD,selectedDuration,exclude,mode,frequency);document.getElementById("sumFirst").textContent=sch.first.toLocaleDateString(undefined,{timeZone:"Africa/Lagos",day:"numeric",month:"short"})+" • 5:00 AM";document.getElementById("sumMaturity").textContent=sch.maturity.toLocaleDateString(undefined,{timeZone:"Africa/Lagos",day:"numeric",month:"short",year:"numeric"});document.getElementById("sumReleases").textContent=sch.count?`${sch.count} ${frequency==="weekly"?"weekly":"daily"}`:"—"}else document.getElementById("sumReleases").textContent="—";
 document.getElementById("summaryNote").textContent=amount&&selectedDuration&&selectedAllocation?`The full amount is locked once. The allocation pool releases ${frequency} from the server schedule; there is no second wallet deduction.`:"Choose your details to preview the plan.";
}
function setupContinueButton(){document.getElementById("continueBtn").addEventListener("click",continueToReview)}
function continueToReview(){
 const planName=document.getElementById("planName").value.trim(),purpose=getPurpose(),amount=Number(document.getElementById("lockAmount").value),startMode=getAllocationStartMode(),todayISO=localISODate(),startDate=startMode==="now"?todayISO:document.getElementById("startDate").value,excludeWeekend=document.getElementById("excludeWeekend").checked,allocationFrequency=getFrequency();
 if(!planName)return alert("Enter a plan name.");if(!purpose)return alert("Select or enter a purpose.");if(amount<=0)return alert("Enter a valid lock amount.");if(selectedDuration<21)return alert("Select a lock duration of at least 21 days.");if(startMode==="later"&&!startDate)return alert("Choose an allocation start date.");if(startMode==="later"&&startDate<todayISO)return alert("Choose today or a future allocation start date.");if(selectedAllocation<10||selectedAllocation>80)return alert("Select an allocation percentage from 10% to 80%.");
 const wallet=getWallet();if(amount>wallet.balance)return alert("Insufficient wallet balance.");
 const allocationAmount=amount*selectedAllocation/100,remainingLocked=amount-allocationAmount,schedule=buildSchedule(startDate,selectedDuration,excludeWeekend,startMode,allocationFrequency),releaseAmount=schedule.count?allocationAmount/schedule.count:0;
 if(!schedule.count)return alert("The selected duration does not contain a valid allocation release.");
 sessionStorage.setItem("allocationPlanReview",JSON.stringify({planName,purpose,amount,duration:selectedDuration,allocationPercent:selectedAllocation,allocationAmount,remainingLocked,allocationFrequency,allocationEvents:schedule.count,releaseAmount,excludeWeekend,startMode,lockImmediately:true,startDate,allocationStartDate:schedule.first.toISOString(),maturityDate:schedule.maturity.toISOString(),createdAt:new Date().toISOString()}));location.href="lock-allocation-confirm.html";
}
function goBackToActivePlans(){location.href="active-locked-plans.html"}
