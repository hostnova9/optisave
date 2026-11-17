const LAGOS_TZ='Africa/Lagos';

function lagosYMD(value=Date.now()){
  const d=value instanceof Date?value:new Date(value);
  if(Number.isNaN(d.getTime()))return null;
  return new Intl.DateTimeFormat('en-CA',{timeZone:LAGOS_TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
}

function addYMD(ymd,days){
  const [y,m,d]=String(ymd).split('-').map(Number);
  const x=new Date(Date.UTC(y,m-1,d+Number(days||0)));
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,'0')}-${String(x.getUTCDate()).padStart(2,'0')}`;
}

function weekdayForYMD(ymd){
  const [y,m,d]=String(ymd).split('-').map(Number);
  return new Date(Date.UTC(y,m-1,d,12,0,0)).getUTCDay();
}

function isWeekendYMD(ymd){
  const day=weekdayForYMD(ymd);
  return day===0||day===6;
}

function lagosAt(ymd,hour=0,minute=0,second=0){
  return new Date(`${ymd}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:${String(second).padStart(2,'0')}+01:00`);
}

function atFive(value=Date.now()){
  const ymd=typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:lagosYMD(value);
  return ymd?lagosAt(ymd,5):null;
}

function firstEligibleYMD(startYMD,excludeWeekends){
  let ymd=startYMD;
  while(excludeWeekends&&isWeekendYMD(ymd))ymd=addYMD(ymd,1);
  return ymd;
}

function nextEligibleYMD(fromYMD,excludeWeekends){
  let ymd=addYMD(fromYMD,1);
  while(excludeWeekends&&isWeekendYMD(ymd))ymd=addYMD(ymd,1);
  return ymd;
}

function firstEligibleFive(value,excludeWeekends){
  const startYMD=typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:lagosYMD(value);
  return atFive(firstEligibleYMD(startYMD,excludeWeekends));
}

function firstFutureFive(value,excludeWeekends,now=new Date()){
  let ymd=typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:lagosYMD(value);
  ymd=firstEligibleYMD(ymd,excludeWeekends);
  let d=atFive(ymd);
  while(d<=now){
    ymd=nextEligibleYMD(ymd,excludeWeekends);
    d=atFive(ymd);
  }
  return d;
}

function nextDay(value,excludeWeekends){
  const ymd=nextEligibleYMD(lagosYMD(value),excludeWeekends);
  return atFive(ymd);
}

function normalizeFrequency(value){
  return String(value||'daily').toLowerCase()==='weekly'?'weekly':'daily';
}

function nextAllocationEvent(value,frequency='daily',excludeWeekends=false){
  const freq=normalizeFrequency(frequency);
  if(freq==='daily')return nextDay(value,excludeWeekends);
  let ymd=addYMD(lagosYMD(value),7);
  ymd=firstEligibleYMD(ymd,excludeWeekends);
  return atFive(ymd);
}

function countAllocationEvents(firstDue,maturity,frequency='daily',excludeWeekends=false){
  let due=firstDue?new Date(firstDue):null;
  const end=maturity?new Date(maturity):null;
  if(!due||Number.isNaN(due.getTime())||!end||Number.isNaN(end.getTime()))return 0;
  let count=0,guard=0;
  // Maturity is exclusive because the maturity release runs before a same-timestamp
  // allocation event in the financial engine.
  while(due<end&&guard++<10000){
    count++;
    due=nextAllocationEvent(due,frequency,excludeWeekends);
  }
  return count;
}

function countEligibleDays(start,duration,excludeWeekends){
  let ymd=lagosYMD(start),count=0;
  const total=Math.max(0,Math.floor(Number(duration||0)));
  for(let i=0;i<total;i++){
    if(!excludeWeekends||!isWeekendYMD(ymd))count++;
    ymd=addYMD(ymd,1);
  }
  return Math.max(1,count);
}

function finalSavingDate(start,count,excludeWeekends){
  let ymd=firstEligibleYMD(lagosYMD(start),excludeWeekends),done=0;
  const total=Math.max(1,Math.floor(Number(count||1)));
  while(done<total){
    done++;
    if(done<total)ymd=nextEligibleYMD(ymd,excludeWeekends);
  }
  return atFive(ymd);
}

module.exports={
  LAGOS_TZ,lagosYMD,addYMD,weekdayForYMD,isWeekendYMD,lagosAt,atFive,
  firstEligibleYMD,nextEligibleYMD,firstEligibleFive,firstFutureFive,nextDay,
  normalizeFrequency,nextAllocationEvent,countAllocationEvents,
  countEligibleDays,finalSavingDate
};
