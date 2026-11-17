let plan=null,events=[],scheduleRows=[],circleLimit=0;
const $=id=>document.getElementById(id),money=n=>'₦'+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
function lagosYMD(value=new Date()){const d=new Date(value);return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
function addYMD(ymd,days){const [y,m,d]=String(ymd).split('-').map(Number),x=new Date(Date.UTC(y,m-1,d+days));return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,'0')}-${String(x.getUTCDate()).padStart(2,'0')}`}
function ymdFromScheduleDate(v){if(!v)return'';const s=String(v);return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):lagosYMD(v)}
const lagosDate=d=>new Intl.DateTimeFormat('en-NG',{timeZone:'Africa/Lagos',day:'numeric',month:'short',year:'numeric'}).format(new Date(d));
function ymdLabel(ymd){return new Intl.DateTimeFormat('en-NG',{timeZone:'Africa/Lagos',weekday:'short',day:'numeric'}).format(new Date(`${ymd}T12:00:00+01:00`))}
function baseCircleLimit(){return window.matchMedia('(max-width:520px)').matches?12:24}

document.addEventListener('DOMContentLoaded',async()=>{
 circleLimit=baseCircleLimit();
 $('circleMore')?.addEventListener('click',()=>{const base=baseCircleLimit();if(circleLimit>=scheduleRows.length){circleLimit=base}else circleLimit=Math.min(scheduleRows.length,circleLimit+base);renderCircles()});
 await refresh();setInterval(tick,1000);setInterval(refresh,30000);
});
async function refresh(){
 if(typeof optisaveStateReady==='function')await optisaveStateReady();
 if(typeof refreshOptiSaveState==='function')await refreshOptiSaveState();
 const ps=(getPlans()||[]).filter(p=>p.type==='daily'&&String(p.status||'').toLowerCase()==='active');
 if(plan)plan=ps.find(p=>String(p.id)===String(plan.id))||ps[0]||null;else plan=ps[0]||null;
 if(!plan){$('empty').hidden=false;$('content').hidden=true;return}
 $('empty').hidden=true;$('content').hidden=false;
 try{const payload=await OptiSaveAPI.dailyEvents(plan.id);events=payload.events||[];scheduleRows=payload.schedule||[]}catch(e){console.warn('Daily events',e);events=[];scheduleRows=[]}
 render();
}
function render(){
 const saved=Number(plan.savedAmount||0),target=Number(plan.totalTarget||plan.totalAmount||0),paid=Number(plan.completedDays||0),duration=Math.max(1,Number(plan.duration||1)),defaults=Number(plan.defaultedDays||events.filter(e=>e.status==='defaulted').length||0),processed=Math.max(Number(plan.processedDays||0),paid+defaults),remaining=Math.max(0,duration-processed),pct=Math.min(100,Math.round(processed/duration*100));
 $('nextAmount').textContent=money(plan.dailyAmount);$('planName').textContent=plan.planName||'Daily Savings';$('saved').textContent=money(saved);$('target').textContent=money(target);$('paidDays').textContent=paid;$('defaultedDays').textContent=defaults;$('remainingDays').textContent=remaining;$('weekends').textContent=plan.excludeWeekend?'Excluded':'Included';$('progressText').textContent=pct+'%';$('bar').style.width=pct+'%';$('nextDate').textContent=plan.nextDebitDate?lagosDate(plan.nextDebitDate):'—';
 const today=lagosYMD(),todayRow=scheduleRows.find(e=>ymdFromScheduleDate(e.schedule_date)===today),due=todayRow?.status==='due';
 $('paymentStatus').textContent=due?'Due — waiting for funds':plan.nextDebitDate?'Scheduled':'Completed';$('paymentStatus').classList.toggle('due',due);$('windowText').textContent=due?'Open until midnight':plan.nextDebitDate?'Opens 5:00 AM':'Plan complete';$('nextLabel').textContent=due?"TODAY'S CONTRIBUTION":'NEXT CONTRIBUTION';$('countLabel').textContent=due?'DAY CLOSES IN':'NEXT CONTRIBUTION IN';
 $('warning').hidden=!due;if(due)$('warningText').textContent='Add '+money(plan.dailyAmount)+' before midnight. OptiSave checks automatically; if unpaid at midnight, today is recorded as Defaulted.';
 renderCircles();renderHistory();tick();
}
function renderCircles(){
 const rows=scheduleRows||[],today=lagosYMD();
 if(!rows.length){$('dayCircles').innerHTML='<div class="history-empty">The server schedule will appear here.</div>';$('circleSummary').textContent='';$('circleMore').hidden=true;return}
 const paid=rows.filter(r=>r.status==='paid').length,defaults=rows.filter(r=>r.status==='defaulted').length,due=rows.filter(r=>r.status==='due').length;
 let focus=rows.findIndex(r=>ymdFromScheduleDate(r.schedule_date)===today);if(focus<0)focus=rows.findIndex(r=>['due','upcoming','processing'].includes(String(r.status)));if(focus<0)focus=Math.max(0,rows.length-1);
 const base=baseCircleLimit();if(circleLimit<base)circleLimit=base;
 let start=Math.max(0,focus-3),end=Math.min(rows.length,start+circleLimit);if(end===rows.length)start=Math.max(0,end-circleLimit);
 const visible=rows.slice(start,end);
 $('dayCircles').innerHTML=visible.map(r=>{const ymd=ymdFromScheduleDate(r.schedule_date),status=String(r.status||'upcoming'),current=ymd===today?' current':'',day=String(Number(ymd.slice(8,10))),title=status==='paid'?'Paid':status==='defaulted'?'Defaulted':status==='due'?'Payment Due':status==='processing'?'Syncing':'Upcoming';return `<div class="saving-day ${status}${current}" title="${ymd} • ${title}"><div class="circle">${day}</div><small>${ymdLabel(ymd)}</small></div>`}).join('');
 $('circleSummary').textContent=`${paid} paid • ${defaults} defaulted${due?' • '+due+' due':''}`;
 const more=$('circleMore');more.hidden=rows.length<=base;more.textContent=circleLimit>=rows.length?'Show fewer':`View more (${Math.min(rows.length,end)}/${rows.length})`;
}
function renderHistory(){
 const box=$('history'),rows=[...events].sort((a,b)=>String(b.schedule_date).localeCompare(String(a.schedule_date)));$('historyCount').textContent=rows.length?rows.length+' recorded':'';
 if(!rows.length){box.innerHTML='<div class="history-empty">No contribution days recorded yet.</div>';return}
 box.innerHTML=rows.map(e=>{const status=String(e.status||'due'),label=status==='paid'?'Paid':status==='defaulted'?'Defaulted':'Payment Due',icon=status==='paid'?'fa-check':status==='defaulted'?'fa-xmark':'fa-clock',when=status==='paid'&&e.paid_at?'Paid '+new Date(e.paid_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):status==='defaulted'?'Closed at midnight':'Waiting for wallet funds';return `<div class="day-row ${status}"><span class="day-icon"><i class="fas ${icon}"></i></span><div><b>${lagosDate(e.due_at)}</b><small>${when}</small></div><strong>${label}</strong></div>`}).join('')
}
function tick(){
 if(!plan?.nextDebitDate){$('countdown').textContent='Completed';return}
 const now=new Date(),today=lagosYMD(now),todayRow=scheduleRows.find(e=>ymdFromScheduleDate(e.schedule_date)===today),due=todayRow?.status==='due';let target=new Date(plan.nextDebitDate);
 if(due)target=new Date(`${addYMD(today,1)}T00:00:00+01:00`);
 const diff=target-now;if(diff<=0){$('countdown').textContent='Checking…';return}
 const d=Math.floor(diff/86400000),h=Math.floor(diff%86400000/3600000),m=Math.floor(diff%3600000/60000),s=Math.floor(diff%60000/1000);$('countdown').textContent=(d?d+'d ':'')+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')
}
