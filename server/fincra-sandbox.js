const crypto=require('crypto');
const db=require('./db');
let runtimeBusinessId='';

const clean=(v,max=1000)=>String(v??'').trim().slice(0,max);
const truthy=v=>['1','true','yes','on'].includes(String(v||'').trim().toLowerCase());
const config=()=>{
  const raw=clean(process.env.FINCRA_SANDBOX_BASE_URL||'https://sandboxapi.fincra.com',1200).replace(/\/+$/,'');
  let baseUrl='';
  try{const u=new URL(raw);if(u.protocol==='https:'&&u.hostname==='sandboxapi.fincra.com')baseUrl=u.toString().replace(/\/$/,'')}catch(_){ }
  return {
    enabled:truthy(process.env.FINCRA_SANDBOX_ENABLED),
    baseUrl,
    secretKey:clean(process.env.FINCRA_SANDBOX_SECRET_KEY,1600),
    publicKey:clean(process.env.FINCRA_SANDBOX_PUBLIC_KEY,1600),
    webhookKey:clean(process.env.FINCRA_SANDBOX_WEBHOOK_KEY,2000),
    businessId:clean(process.env.FINCRA_SANDBOX_BUSINESS_ID,180),
    timeoutMs:Math.min(Math.max(Number(process.env.FINCRA_REQUEST_TIMEOUT_MS||20000),3000),45000),
    payoutMax:Math.min(Math.max(Number(process.env.FINCRA_SANDBOX_PAYOUT_MAX||5000),100),1000000),
    appBaseUrl:clean(process.env.APP_BASE_URL||'',1200).replace(/\/+$/,'')
  };
};
function publicConfig(){const c=config();return {
  enabled:c.enabled,baseUrl:c.baseUrl||'https://sandboxapi.fincra.com',secretKeyConfigured:!!c.secretKey,publicKeyConfigured:!!c.publicKey,webhookKeyConfigured:!!c.webhookKey,businessIdConfigured:!!(c.businessId||runtimeBusinessId),businessId:c.businessId||runtimeBusinessId||null,timeoutMs:c.timeoutMs,payoutMax:c.payoutMax,
  endpoints:{businessProfile:'/profile/business/me',banks:'/core/banks',temporaryVirtualAccount:'/profile/virtual-accounts/transfer',permanentVirtualAccount:'/profile/virtual-accounts/requests',resolveAccount:'/core/accounts/resolve',payout:'/disbursements/payouts'},
  webhookUrl:c.appBaseUrl?`${c.appBaseUrl}/api/webhooks/fincra`:null
};}
function assertReady(){const c=config();if(!c.enabled){const e=Error('Fincra Sandbox Lab is disabled. Set FINCRA_SANDBOX_ENABLED=true.');e.status=400;throw e}if(!c.baseUrl){const e=Error('Fincra sandbox base URL must be https://sandboxapi.fincra.com.');e.status=400;throw e}if(!c.secretKey){const e=Error('FINCRA_SANDBOX_SECRET_KEY is not configured.');e.status=400;throw e}return c}
function safePath(path){const p=String(path||'');if(!p.startsWith('/')||p.includes('..')||p.includes('\\')||/\r|\n/.test(p)){const e=Error('Invalid Fincra API path');e.status=400;throw e}return p}
function redact(v,depth=0){if(depth>8)return '[depth-limit]';if(Array.isArray(v))return v.slice(0,100).map(x=>redact(x,depth+1));if(v&&typeof v==='object'){const out={};for(const [k,val] of Object.entries(v)){const key=String(k).toLowerCase();if(/(?:secret|token|api.?key|webhook.?key|bvn|nin|password|pin)/i.test(key))out[k]='[REDACTED]';else if(/accountnumber/i.test(key)&&typeof val==='string'&&val.length>4)out[k]='***'+val.slice(-4);else out[k]=redact(val,depth+1)}return out}if(typeof v==='string'&&v.length>5000)return v.slice(0,5000)+'…';return v}
async function log({action,ok,httpStatus=null,latencyMs=null,response=null,error=null,adminId=null,eventType='request',signatureValid=null}){try{await db.query(`INSERT INTO fincra_sandbox_logs(admin_id,event_type,action,ok,http_status,latency_ms,response_json,error_text,signature_valid) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[adminId||null,eventType,clean(action,100),!!ok,httpStatus==null?null:Number(httpStatus),latencyMs==null?null:Number(latencyMs),response==null?null:JSON.stringify(redact(response)),error?clean(error,2000):null,signatureValid])}catch(e){console.error('[FINCRA_LOG_FAILED]',e.message)}}
async function request({path,method='GET',body,query,action,adminId}){const c=assertReady();let url=c.baseUrl+safePath(path);if(query&&Object.keys(query).length){const sp=new URLSearchParams();for(const [k,v] of Object.entries(query)){if(v!==undefined&&v!==null&&String(v)!=='')sp.set(k,String(v))}url+='?'+sp.toString()}const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),c.timeoutMs),started=Date.now();const headers={'Accept':'application/json','api-key':c.secretKey};if(c.publicKey)headers['x-pub-key']=c.publicKey;if(body!==undefined)headers['Content-Type']='application/json';try{const resp=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});const text=await resp.text();let data;try{data=text?JSON.parse(text):{}}catch(_){data={raw:text.slice(0,8000)}}const latencyMs=Date.now()-started;await log({action,ok:resp.ok,httpStatus:resp.status,latencyMs,response:data,adminId});if(!resp.ok){const msg=data?.message||data?.error||`Fincra returned HTTP ${resp.status}`;const e=Error(String(msg));e.status=502;e.providerStatus=resp.status;e.providerData=redact(data);throw e}return {ok:true,status:resp.status,latencyMs,data:redact(data)}}catch(e){if(e?.providerStatus)throw e;const msg=e?.name==='AbortError'?`Fincra request timed out after ${Math.round(c.timeoutMs/1000)} seconds.`:String(e?.message||e);await log({action,ok:false,latencyMs:Date.now()-started,error:msg,adminId});const err=Error(msg);err.status=502;throw err}finally{clearTimeout(timer)}}

function findBusinessId(data){
  const d=data?.data??data?.result??data;
  const id=d?._id||d?.id||d?.business?._id||d?.business?.id||data?._id||data?.id;
  return id?clean(id,180):'';
}
async function detectBusinessId(adminId=null){
  if(config().businessId)return config().businessId;
  if(runtimeBusinessId)return runtimeBusinessId;
  const r=await request({path:'/profile/business/me',action:'business_profile',adminId});
  runtimeBusinessId=findBusinessId(r.data)||'';
  return runtimeBusinessId;
}

const validRef=v=>{const x=clean(v,120);return /^[A-Za-z0-9._:-]{3,120}$/.test(x)?x:null};
const validAmount=v=>{const n=Number(v);return Number.isFinite(n)&&n>0?n:null};
const validAccount=v=>{const x=clean(v,30).replace(/\s/g,'');return /^\d{10}$/.test(x)?x:null};
const validBankCode=v=>{const x=clean(v,30);return /^[A-Za-z0-9_-]{2,20}$/.test(x)?x:null};
async function run(action,input={},adminId=null){const c=config();
  if(action==='business_profile'){const r=await request({path:'/profile/business/me',action,adminId});runtimeBusinessId=findBusinessId(r.data)||runtimeBusinessId;return {...r,businessId:runtimeBusinessId||null};}
  if(action==='list_banks'){return request({path:'/core/banks',query:{country:'NG',currency:'NGN',paymentDestination:'bank_account'},action,adminId});}
  if(action==='list_payouts'){const businessId=c.businessId||runtimeBusinessId||await detectBusinessId(adminId);if(!businessId){const e=Error('Fincra did not return a Business ID. Add FINCRA_SANDBOX_BUSINESS_ID manually.');e.status=400;throw e}return request({path:'/disbursements/payouts',query:{business:businessId,perPage:5},action,adminId});}
  if(action==='temporary_virtual_account'){const amount=validAmount(input.amount),expiresAt=Math.floor(Number(input.expiresAt||30)),merchantReference=validRef(input.merchantReference);if(!amount||!Number.isFinite(expiresAt)||expiresAt<1||expiresAt>1440||!merchantReference){const e=Error('Enter a valid amount, expiry (1-1440 minutes), and merchant reference.');e.status=400;throw e}const body={amount:String(amount),expiresAt:String(expiresAt),merchantReference};if(input.channel)body.channel=clean(input.channel,40);return request({method:'POST',path:'/profile/virtual-accounts/transfer',body,action,adminId});}
  if(action==='permanent_virtual_account'){if(!input.payload||typeof input.payload!=='object'||Array.isArray(input.payload)){const e=Error('Permanent virtual account payload must be a JSON object copied from Fincra documentation.');e.status=400;throw e}return request({method:'POST',path:'/profile/virtual-accounts/requests',body:input.payload,action,adminId});}
  if(action==='resolve_account'){const accountNumber=validAccount(input.accountNumber),bankCode=validBankCode(input.bankCode);if(!accountNumber||!bankCode){const e=Error('Enter a valid 10-digit NUBAN account number and bank code.');e.status=400;throw e}return request({method:'POST',path:'/core/accounts/resolve',body:{accountNumber,bankCode,currency:'NGN',type:'bank_account'},action,adminId});}
  if(action==='payout'){if(!input.payload||typeof input.payload!=='object'||Array.isArray(input.payload)){const e=Error('Payout payload must be a JSON object.');e.status=400;throw e}const p={...input.payload};p.business=p.business||c.businessId||runtimeBusinessId||await detectBusinessId(adminId);const amount=validAmount(p.amount);if(!p.business){const e=Error('Add FINCRA_SANDBOX_BUSINESS_ID or include business in the payout payload.');e.status=400;throw e}if(!amount||amount>c.payoutMax){const e=Error(`Sandbox payout amount must be between ₦0.01 and ₦${c.payoutMax.toLocaleString()}.`);e.status=400;throw e}if(String(p.sourceCurrency||'').toUpperCase()!=='NGN'||String(p.destinationCurrency||'').toUpperCase()!=='NGN'||String(p.paymentDestination||'')!=='bank_account'){const e=Error('This OptiSave lab only permits NGN-to-NGN bank_account sandbox payouts.');e.status=400;throw e}if(!validRef(p.customerReference)){const e=Error('Use a unique customerReference containing letters/numbers/dash/underscore only.');e.status=400;throw e}return request({method:'POST',path:'/disbursements/payouts',body:p,action,adminId});}
  const e=Error('Unknown Fincra sandbox action');e.status=404;throw e;
}
async function logs(limit=80){const n=Math.min(Math.max(Number(limit||80),1),200);return (await db.query(`SELECT id,event_type,action,ok,http_status,latency_ms,response_json,error_text,signature_valid,created_at FROM fincra_sandbox_logs ORDER BY id DESC LIMIT $1`,[n])).rows}
async function readiness(){const q=await db.query(`SELECT action,BOOL_OR(ok) AS passed,MAX(created_at) AS last_at FROM fincra_sandbox_logs WHERE created_at>NOW()-INTERVAL '30 days' GROUP BY action`);const m=Object.fromEntries(q.rows.map(x=>[x.action,{passed:x.passed,lastAt:x.last_at}]));return {connection:m.business_profile||m.list_payouts||null,banks:m.list_banks||null,temporaryVirtualAccount:m.temporary_virtual_account||null,permanentVirtualAccount:m.permanent_virtual_account||null,resolveAccount:m.resolve_account||null,payout:m.payout||null,webhook:m.webhook||null}}
function validateWebhook(rawBody,signature){const c=config();if(!c.webhookKey||!signature)return false;const body=Buffer.isBuffer(rawBody)?rawBody:Buffer.from(String(rawBody||''));const expected=crypto.createHmac('sha512',c.webhookKey).update(body).digest('hex');const a=Buffer.from(String(signature).trim()),b=Buffer.from(expected);return a.length===b.length&&crypto.timingSafeEqual(a,b)}
module.exports={publicConfig,run,logs,readiness,log,validateWebhook,redact,config};
