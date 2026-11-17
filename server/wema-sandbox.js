const crypto=require('crypto');
const db=require('./db');

const clean=(v,max=500)=>String(v??'').trim().slice(0,max);
const truthy=v=>['1','true','yes','on'].includes(String(v||'').trim().toLowerCase());
const safeBaseUrl=()=>{
  const raw=clean(process.env.WEMA_API_BASE_URL||'https://apiplayground.alat.ng',1200).replace(/\/+$/,'');
  try{const u=new URL(raw);if(u.protocol!=='https:')return '';return u.toString().replace(/\/$/,'')}catch(_){return ''}
};
const config=()=>({
  enabled:truthy(process.env.WEMA_SANDBOX_ENABLED),
  baseUrl:safeBaseUrl(),
  walletKey:clean(process.env.WEMA_API_KEY,1000),
  accessKey:clean(process.env.WEMA_ACCESS_KEY||process.env.WEMA_API_KEY,1000),
  walletHeader:clean(process.env.WEMA_API_KEY_HEADER||'x-api-key',100),
  accessHeader:clean(process.env.WEMA_ACCESS_HEADER||'access',100),
  subscriptionKey:clean(process.env.WEMA_SUBSCRIPTION_KEY,1000),
  subscriptionHeader:clean(process.env.WEMA_SUBSCRIPTION_HEADER||'Ocp-Apim-Subscription-Key',100),
  channelId:clean(process.env.WEMA_CHANNEL_ID,200),
  timeoutMs:Math.min(Math.max(Number(process.env.WEMA_REQUEST_TIMEOUT_MS||20000),3000),45000),
  appBaseUrl:clean(process.env.APP_BASE_URL||'',1200).replace(/\/+$/,'')
});
function publicConfig(){const c=config();return {
  enabled:c.enabled,baseUrl:c.baseUrl,baseUrlConfigured:!!c.baseUrl,walletKeyConfigured:!!c.walletKey,accessKeyConfigured:!!c.accessKey,subscriptionKeyConfigured:!!c.subscriptionKey,channelIdConfigured:!!c.channelId,
  walletHeader:c.walletHeader,accessHeader:c.accessHeader,subscriptionHeader:c.subscriptionHeader,channelId:c.channelId||null,timeoutMs:c.timeoutMs,
  bvnStep1Endpoint:`${c.baseUrl||'https://apiplayground.alat.ng'}/account-creation/api/CustomerAccount/PostPartnershipAccountCreationWithBvn`,
  callbacks:c.appBaseUrl?{
    wallet:`${c.appBaseUrl}/api/webhooks/wema/wallet`,
    transaction:`${c.appBaseUrl}/api/webhooks/wema/transaction`,
    authorize:`${c.appBaseUrl}/api/webhooks/wema/authorize`
  }:null
}}
function assertReady(kind='wallet'){
  const c=config();
  if(!c.enabled){const e=Error('Wema Sandbox Lab is disabled. Set WEMA_SANDBOX_ENABLED=true.');e.status=400;throw e}
  if(!c.baseUrl){const e=Error('WEMA_API_BASE_URL is missing or invalid. Copy the sandbox API base URL assigned by Wema.');e.status=400;throw e}
  if(kind==='wallet'&&!c.walletKey){const e=Error('WEMA_API_KEY is not configured.');e.status=400;throw e}
  if(kind==='access'&&!c.accessKey){const e=Error('WEMA_ACCESS_KEY (or WEMA_API_KEY fallback) is not configured.');e.status=400;throw e}
  return c;
}
function safePath(path){const p=String(path||'');if(!p.startsWith('/')||p.includes('..')||p.includes('\\')||/\r|\n/.test(p)){const e=Error('Invalid Wema API path');e.status=400;throw e}return p}
function redact(v,depth=0){
  if(depth>8)return '[depth-limit]';
  if(Array.isArray(v))return v.slice(0,80).map(x=>redact(x,depth+1));
  if(v&&typeof v==='object'){
    const out={};for(const [k,val] of Object.entries(v)){
      const key=String(k).toLowerCase();
      if(/(?:nin|bvn|otp|securityinfo|password|secret|token|api.?key|subscription.?key)/i.test(key))out[k]='[REDACTED]';
      else if(/phone/i.test(key)&&typeof val==='string')out[k]=val.length>4?'***'+val.slice(-4):'***';
      else out[k]=redact(val,depth+1);
    }return out;
  }
  if(typeof v==='string'&&v.length>4000)return v.slice(0,4000)+'…';
  return v;
}
async function log({action,ok,httpStatus=null,latencyMs=null,response=null,error=null,adminId=null,eventType='request'}){
  try{await db.query(`INSERT INTO wema_sandbox_logs(admin_id,event_type,action,ok,http_status,latency_ms,response_json,error_text) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[adminId||null,eventType,clean(action,100),!!ok,httpStatus==null?null:Number(httpStatus),latencyMs==null?null:Number(latencyMs),response==null?null:JSON.stringify(redact(response)),error?clean(error,2000):null])}catch(e){console.error('[WEMA_LOG_FAILED]',e.message)}
}
async function request({kind='wallet',path,method='GET',body,action,adminId}){
  const c=assertReady(kind),url=c.baseUrl+safePath(path),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),c.timeoutMs),started=Date.now();
  const headers={'Accept':'application/json'};
  const key=kind==='access'?c.accessKey:c.walletKey,headerName=kind==='access'?c.accessHeader:c.walletHeader;
  headers[headerName]=key;
  if(c.subscriptionKey)headers[c.subscriptionHeader]=c.subscriptionKey;
  if(body!==undefined)headers['Content-Type']='application/json';
  try{
    const resp=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
    const text=await resp.text();let data;try{data=text?JSON.parse(text):{}}catch(_){data={raw:text.slice(0,8000)}}
    const latencyMs=Date.now()-started;
    await log({action,ok:resp.ok,httpStatus:resp.status,latencyMs,response:data,adminId});
    if(!resp.ok){const msg=data?.errorMessage||data?.message||data?.error||`Wema returned HTTP ${resp.status}`;const e=Error(String(msg));e.status=502;e.providerStatus=resp.status;e.providerData=redact(data);throw e}
    return {ok:true,status:resp.status,latencyMs,data:redact(data)};
  }catch(e){
    if(e?.providerStatus)throw e;
    const msg=e?.name==='AbortError'?`Wema request timed out after ${Math.round(c.timeoutMs/1000)} seconds.`:String(e?.message||e);
    await log({action,ok:false,latencyMs:Date.now()-started,error:msg,adminId});
    const err=Error(msg);err.status=502;throw err;
  }finally{clearTimeout(timer)}
}
async function saveAuthorization(reference,securityInfo){
  const ref=clean(reference,180);if(!ref||!securityInfo)return;
  const hash=crypto.createHash('sha256').update(String(securityInfo)).digest('hex');
  await db.query(`INSERT INTO wema_sandbox_auth(transaction_reference,security_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 minutes') ON CONFLICT(transaction_reference) DO UPDATE SET security_hash=$2,expires_at=NOW()+INTERVAL '30 minutes',used_at=NULL,created_at=NOW()`,[ref,hash]);
}
async function authorize(reference,securityInfo){
  const ref=clean(reference,180),hash=crypto.createHash('sha256').update(String(securityInfo||'')).digest('hex');
  if(!ref||!securityInfo)return false;
  const q=await db.query(`SELECT security_hash,expires_at,used_at FROM wema_sandbox_auth WHERE transaction_reference=$1 LIMIT 1`,[ref]),row=q.rows[0];
  if(!row||row.used_at||new Date(row.expires_at).getTime()<Date.now())return false;
  const a=Buffer.from(hash),b=Buffer.from(String(row.security_hash||''));if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return false;
  await db.query(`UPDATE wema_sandbox_auth SET used_at=NOW() WHERE transaction_reference=$1`,[ref]);return true;
}
function validAccount(v){const x=clean(v,30);return /^\d{8,16}$/.test(x)?x:null}
function validBankCode(v){const x=clean(v,20);return /^[A-Za-z0-9_-]{2,12}$/.test(x)?x:null}
function validRef(v){const x=clean(v,180);return /^[A-Za-z0-9._:-]{6,180}$/.test(x)?x:null}
function validEmail(v){const x=clean(v,180).toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)?x:null}
function validPhone(v){const x=clean(v,30).replace(/[\s()+-]/g,'');return /^\d{10,15}$/.test(x)?x:null}
function validBvn(v){const x=clean(v,20).replace(/\D/g,'');return /^\d{11}$/.test(x)?x:null}
async function run(action,input={},adminId=null){
  const c=config();
  if(action==='bvn_account_create'){
    const phoneNumber=validPhone(input.phoneNumber),email=validEmail(input.email),bvn=validBvn(input.bvn);
    if(!phoneNumber||!email||!bvn){const e=Error('Enter a valid phone number, email address and 11-digit BVN for the Wema BVN sandbox request.');e.status=400;throw e}
    return request({kind:'wallet',method:'POST',path:'/account-creation/api/CustomerAccount/PostPartnershipAccountCreationWithBvn',body:{phoneNumber,email,bvn},action,adminId});
  }
  if(action==='banks')return request({kind:'access',path:'/debit-wallet/api/Shared/GetAllBanks',action,adminId});
  if(action==='nip_charges')return request({kind:'access',path:'/debit-wallet/api/Shared/GetNIPCharges',action,adminId});
  if(action==='wallet_lookup'){
    const account=validAccount(input.accountNumber);if(!account){const e=Error('Enter a valid wallet/account number.');e.status=400;throw e}
    return request({kind:'wallet',path:`/ws-acct-mgt/api/AccountMaintenance/CustomerAccount/GetAccountV2/accountNumber/${encodeURIComponent(account)}`,action,adminId});
  }
  if(action==='source_name'){
    const account=validAccount(input.accountNumber);if(!account){const e=Error('Enter a valid source wallet/account number.');e.status=400;throw e}
    return request({kind:'access',method:'POST',path:`/debit-wallet/api/Shared/AccountNameEnquiry/Wallet/${encodeURIComponent(account)}`,action,adminId});
  }
  if(action==='destination_name'){
    const account=validAccount(input.accountNumber),bank=validBankCode(input.bankCode);if(!account||!bank){const e=Error('Enter a valid destination account number and bank code.');e.status=400;throw e}
    const q=c.channelId?`?channelId=${encodeURIComponent(c.channelId)}`:'';
    return request({kind:'access',path:`/debit-wallet/api/Shared/AccountNameEnquiry/${encodeURIComponent(bank)}/${encodeURIComponent(account)}${q}`,action,adminId});
  }
  if(action==='wallet_create'){
    if(!input.payload||typeof input.payload!=='object'||Array.isArray(input.payload)){const e=Error('Wallet request payload must be a JSON object copied from Wema Playground.');e.status=400;throw e}
    return request({kind:'wallet',method:'POST',path:'/wallet-creation/api/CustomerAccount/GenerateWalletAccountForPartnerships/Request',body:input.payload,action,adminId});
  }
  if(action==='wallet_otp'){
    const otp=clean(input.otp,20),trackingId=clean(input.trackingId,250),phoneNumber=clean(input.phoneNumber,30);if(!otp||!trackingId||!phoneNumber){const e=Error('OTP, tracking ID and phone number are required.');e.status=400;throw e}
    return request({kind:'wallet',method:'POST',path:'/wallet-creation/api/CustomerAccount/GenerateWalletAccountForPartnershipsV2/otp',body:{otp,trackingId,phoneNumber},action,adminId});
  }
  if(action==='wallet_history'){
    if(!input.payload||typeof input.payload!=='object'||Array.isArray(input.payload)){const e=Error('Transaction-history payload must be a JSON object.');e.status=400;throw e}
    return request({kind:'wallet',method:'POST',path:'/ws-acct-mgt/api/AccountMaintenance/CustomerAccount/transhistoryV2',body:input.payload,action,adminId});
  }
  if(action==='debit_transfer'){
    if(!input.payload||typeof input.payload!=='object'||Array.isArray(input.payload)){const e=Error('Transfer payload must be a JSON object.');e.status=400;throw e}
    const payload={...input.payload},reference=validRef(payload.transactionReference);if(!reference){const e=Error('Your transfer JSON must include a transactionReference (6–180 letters/numbers/._:-).');e.status=400;throw e}
    const securityInfo=crypto.randomBytes(24).toString('hex');payload.securityInfo=securityInfo;if(c.channelId&&!payload.channelId)payload.channelId=c.channelId;await saveAuthorization(reference,securityInfo);
    return request({kind:'access',method:'POST',path:'/debit-wallet/api/Shared/ProcessClientTransfer',body:payload,action,adminId});
  }
  const e=Error('Unsupported Wema sandbox action.');e.status=404;throw e;
}
async function logs(limit=80){const n=Math.min(Math.max(Number(limit)||80,1),200);const q=await db.query(`SELECT id,event_type,action,ok,http_status,latency_ms,response_json,error_text,created_at FROM wema_sandbox_logs ORDER BY created_at DESC LIMIT $1`,[n]);return q.rows}
async function readiness(){
  const rows=(await db.query(`SELECT action,BOOL_OR(ok) AS passed FROM wema_sandbox_logs WHERE created_at>NOW()-INTERVAL '30 days' GROUP BY action`)).rows;
  const map=Object.fromEntries(rows.map(r=>[r.action,!!r.passed]));
  const c=publicConfig();return {configuration:{baseUrl:c.baseUrlConfigured,walletKey:c.walletKeyConfigured,accessKey:c.accessKeyConfigured,subscriptionKey:c.subscriptionKeyConfigured,channelId:c.channelIdConfigured},tests:{connection:!!map.banks,bvnAccountCreate:!!map.bvn_account_create,walletCreate:!!map.wallet_create,walletOtp:!!map.wallet_otp,walletLookup:!!map.wallet_lookup,destinationEnquiry:!!map.destination_name,debitTransfer:!!map.debit_transfer,walletCallback:!!map.wallet_callback,transactionCallback:!!map.transaction_callback,authorizationCallback:!!map.authorization_callback}};
}
module.exports={publicConfig,run,logs,readiness,log,authorize,redact};
