/* OptiSave Daily Savings — Lagos calendar is the single scheduling calendar. */
let selectedGoal="", selectedDays=0;
const $=id=>document.getElementById(id);
const money=n=>"₦"+Number(n||0).toLocaleString();

function lagosYMD(value=new Date()){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
}
function addYMD(ymd,days){
  const [y,m,d]=ymd.split('-').map(Number),x=new Date(Date.UTC(y,m-1,d+days));
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,'0')}-${String(x.getUTCDate()).padStart(2,'0')}`;
}
function weekdayYMD(ymd){const [y,m,d]=ymd.split('-').map(Number);return new Date(Date.UTC(y,m-1,d,12)).getUTCDay();}
function isWeekendYMD(ymd){const day=weekdayYMD(ymd);return day===0||day===6;}
function firstEligibleYMD(ymd,exclude){while(exclude&&isWeekendYMD(ymd))ymd=addYMD(ymd,1);return ymd;}
function nextEligibleYMD(ymd,exclude){ymd=addYMD(ymd,1);return firstEligibleYMD(ymd,exclude);}
function lagosFive(ymd){return new Date(`${ymd}T05:00:00+01:00`);}
function firstSavingYMD(startISO,exclude,mode,now=new Date()){
  let ymd=firstEligibleYMD(startISO,exclude);
  if(mode==='later'){
    let d=lagosFive(ymd);
    while(d<=now){ymd=nextEligibleYMD(ymd,exclude);d=lagosFive(ymd);}
  }
  return ymd;
}
function completionYMD(startISO,days,exclude){
  if(!startISO||days<=0)return null;
  let ymd=firstEligibleYMD(startISO,exclude),count=1;
  while(count<days){ymd=nextEligibleYMD(ymd,exclude);count++;}
  return ymd;
}
function displayYMD(ymd){return ymd?new Date(`${ymd}T12:00:00+01:00`).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'--';}

 document.addEventListener("DOMContentLoaded",()=>{
  const today=lagosYMD(); $("startDate").value=today; $("startDate").min=today;
  document.querySelectorAll('input[name="startMode"]').forEach(r=>r.onchange=()=>{
    const later=document.querySelector('input[name="startMode"]:checked').value==="later";
    $("scheduledStartWrap").hidden=!later;
    document.querySelectorAll(".start-option").forEach(x=>x.classList.toggle("active",x.querySelector("input").checked));
    update();
  });
  document.querySelectorAll(".goal-chip").forEach(btn=>btn.onclick=()=>{document.querySelectorAll(".goal-chip").forEach(x=>x.classList.remove("active"));btn.classList.add("active");selectedGoal=btn.textContent.trim();$("customGoal").value="";update();});
  document.querySelectorAll(".duration-btn").forEach(btn=>btn.onclick=()=>{document.querySelectorAll(".duration-btn").forEach(x=>x.classList.remove("active"));btn.classList.add("active");selectedDays=Number(btn.dataset.days);$("customDuration").value="";update();});
  $("dailyAmount").oninput=update;$("startDate").onchange=update;$("excludeWeekend").onchange=update;$("reminderEnabled").onchange=()=>{$("reminderOptions").hidden=!$("reminderEnabled").checked;};
  $("customGoal").oninput=e=>{if(e.target.value.trim()){selectedGoal=e.target.value.trim();document.querySelectorAll(".goal-chip").forEach(x=>x.classList.remove("active"));}update();};
  $("customDuration").oninput=e=>{if(e.target.value){selectedDays=Math.max(0,Math.floor(Number(e.target.value)));document.querySelectorAll(".duration-btn").forEach(x=>x.classList.remove("active"));}update();};
  $("createDailySavingBtn").onclick=createPlan;update();
});
function startMode(){return document.querySelector('input[name="startMode"]:checked')?.value||"now";}
function update(){
 const amount=Number($("dailyAmount").value)||0,exclude=$("excludeWeekend").checked;
 const mode=startMode(),start=mode==="now"?lagosYMD():$("startDate").value,first=start?firstSavingYMD(start,exclude,mode):null;
 $("summaryGoal").textContent=selectedGoal||"Not Selected";$("summaryDailyAmount").textContent=money(amount);
 $("summaryDuration").textContent=selectedDays?selectedDays+" Saving Days":"0 Days";$("summaryTotal").textContent=money(amount*selectedDays);
 const end=completionYMD(first,selectedDays,exclude);$("summaryEndDate").textContent=displayYMD(end);
}

async function createPlan(){
 const amount=Number($("dailyAmount").value),exclude=$("excludeWeekend").checked,mode=startMode();
 const today=lagosYMD(),start=mode==="now"?today:$("startDate").value;
 if(!selectedGoal)return alert("Please select or enter a saving goal.");
 if(!(amount>0))return alert("Enter a valid daily amount.");
 if(!(selectedDays>0))return alert("Select a valid saving duration.");
 if(!start)return alert("Select a start date.");
 if(mode==="later"&&start<today)return alert("Choose today or a future start date.");
 const firstYMD=firstSavingYMD(start,exclude,mode),first=lagosFive(firstYMD);
 const btn=$("createDailySavingBtn");btn.disabled=true;
 try{
   const reminderEnabled=$("reminderEnabled").checked, reminderTime=$("reminderTime").value||"19:00", addCalendar=reminderEnabled&&$("addCalendar").checked;
   // The goal is the plan identity. Purpose is not recorded as a second customer-facing
   // event, which keeps Daily Savings to one plan -> one schedule -> one event stream.
   const result=await OptiSaveAPI.createPlan({type:"daily",planName:selectedGoal,purpose:"",goal:selectedGoal,dailyAmount:amount,duration:selectedDays,totalTarget:amount*selectedDays,startMode:mode,startDate:start,nextDebitDate:first.toISOString(),excludeWeekend:exclude,reminderEnabled,reminderTime,calendarReminder:addCalendar});
   if(addCalendar) downloadCalendarReminder({goal:selectedGoal,amount,days:selectedDays,start:firstYMD,excludeWeekend:exclude,time:reminderTime,planId:result?.plan?.id});
   alert(addCalendar?"Daily Saving Plan Created. Open the downloaded calendar reminder to add it to your device calendar.":"Daily Saving Plan Created Successfully.");
   location.href="dashboard.html";
 }catch(e){alert(e.message||"Unable to create Daily Saving plan.");btn.disabled=false;}
}

function icsEscape(v){return String(v||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\n/g,"\\n");}
function icsLocal(dateISO,time){return String(dateISO).replace(/-/g,"")+"T"+String(time||"19:00").replace(":","")+"00";}
function downloadCalendarReminder({goal,amount,days,start,excludeWeekend,time,planId}){
 const uid=`optisave-${planId||Date.now()}@myoptisave.site`;
 const byday=excludeWeekend?";BYDAY=MO,TU,WE,TH,FR":"";
 const title=`OptiSave: Save ${money(amount)} today`;
 const description=`Daily saving reminder for ${goal}. Today's planned saving amount is ${money(amount)}. Open OptiSave to complete or review your saving.`;
 const now=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
 const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//OptiSave//Daily Savings Reminder//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT",`UID:${uid}`,`DTSTAMP:${now}`,`DTSTART:${icsLocal(start,time)}`,`RRULE:FREQ=DAILY${byday};COUNT=${days}`,`SUMMARY:${icsEscape(title)}`,`DESCRIPTION:${icsEscape(description)}`,"BEGIN:VALARM","TRIGGER:-PT10M","ACTION:DISPLAY",`DESCRIPTION:${icsEscape(title)}`,"END:VALARM","END:VEVENT","END:VCALENDAR"].join("\r\n");
 const blob=new Blob([ics],{type:"text/calendar;charset=utf-8"}),a=document.createElement("a");
 a.href=URL.createObjectURL(blob);a.download=`OptiSave-${String(goal||"Daily-Saving").replace(/[^a-z0-9]+/gi,"-")}-Reminder.ics`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
