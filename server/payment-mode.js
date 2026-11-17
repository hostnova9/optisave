const VALID_MODES=new Set(['test','pilot','live']);

function mode(){
  const raw=String(process.env.PAYMENT_MODE||'test').trim().toLowerCase();
  return VALID_MODES.has(raw)?raw:'test';
}

function secretKey(){return String(process.env.PAYSTACK_SECRET_KEY||'').trim()}
function keyKind(){const key=secretKey();if(key.startsWith('sk_test_'))return 'test';if(key.startsWith('sk_live_'))return 'live';return key?'unknown':'missing'}
function allowlist(){return String(process.env.LIVE_PAYMENT_ALLOWLIST||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)}
function positiveLimit(name,fallback){const n=Number(process.env[name]);return Number.isFinite(n)&&n>0?Math.round(n*100)/100:fallback}
function depositMax(){return positiveLimit('LIVE_DEPOSIT_MAX',5000)}
function withdrawalMax(){return positiveLimit('LIVE_WITHDRAWAL_MAX',5000)}

function validateConfiguration(){
  const m=mode(),kind=keyKind();
  if(m==='test'&&kind==='live') throw new Error('PAYMENT_MODE=test cannot run with a live Paystack secret key. Set PAYMENT_MODE=pilot first.');
  if((m==='pilot'||m==='live')&&kind!=='live') throw new Error(`PAYMENT_MODE=${m} requires a Paystack live secret key (sk_live_...).`);
  if(m==='pilot'&&allowlist().length===0) throw new Error('PAYMENT_MODE=pilot requires LIVE_PAYMENT_ALLOWLIST with at least one OptiSave account email.');
  if(m!=='test'&&String(process.env.ENABLE_DEV_WALLET||'').toLowerCase()==='true') console.warn('Live payment mode: development wallet endpoints are force-disabled even though ENABLE_DEV_WALLET=true.');
  return {mode:m,keyKind:kind};
}

async function userEmail(db,userId){
  const u=(await db.query('SELECT email FROM users WHERE id=$1',[userId])).rows[0];
  return String(u?.email||'').trim().toLowerCase();
}

async function statusForUser(db,userId){
  const m=mode(),email=await userEmail(db,userId);
  const isPilot=m==='pilot';
  const allowed=m==='test'||m==='live'||(isPilot&&allowlist().includes(email));
  return {
    provider:'paystack',
    mode:m,
    canUsePayments:allowed,
    controlledPilot:isPilot,
    depositMax:isPilot?depositMax():null,
    withdrawalMax:isPilot?withdrawalMax():null,
    notice:m==='pilot'
      ?(allowed?'Controlled live pilot is active for this account. Real-money limits apply.':'Live payments are currently in a controlled pilot and are not enabled for this account.')
      :(m==='test'?'Paystack test mode is active. No real money is moved.':'Live payments are active.')
  };
}

function accessError(message,status=403){return Object.assign(new Error(message),{status})}

async function assertPaymentAccess(db,userId,action,amount){
  const s=await statusForUser(db,userId);
  if(!s.canUsePayments) throw accessError('Live payments are currently in controlled testing and are not enabled for this account.');
  const value=Number(amount||0);
  if(s.mode==='pilot'&&action==='deposit'&&value>s.depositMax) throw accessError(`Controlled pilot deposit limit is ₦${Number(s.depositMax).toLocaleString('en-NG')}.`,400);
  if(s.mode==='pilot'&&action==='withdrawal'&&value>s.withdrawalMax) throw accessError(`Controlled pilot withdrawal limit is ₦${Number(s.withdrawalMax).toLocaleString('en-NG')}.`,400);
  return s;
}

async function assertProviderWriteAccess(db,userId){
  const s=await statusForUser(db,userId);
  if(s.mode==='pilot'&&!s.canUsePayments) throw accessError('Live Paystack setup is currently limited to the controlled pilot account.');
  return s;
}

module.exports={mode,keyKind,allowlist,depositMax,withdrawalMax,validateConfiguration,statusForUser,assertPaymentAccess,assertProviderWriteAccess};
