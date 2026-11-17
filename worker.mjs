import { httpServerHandler } from 'cloudflare:node';
import { waitUntil } from 'cloudflare:workers';
import { createPublicKey, verify } from 'node:crypto';
import makeApp from './server/app.js';
import db from './server/db.js';
import engine from './server/financial-engine.js';
import paymentMode from './server/payment-mode.js';
const app=makeApp(waitUntil);
app.listen(3000);
const http=httpServerHandler({port:3000});
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
function safeConfig(env){
 if(env.OPTISAVE_CLOUD!=='true'||env.NODE_ENV!=='production'||env.PAYMENT_MODE!=='test'||env.ENABLE_DEV_WALLET!=='false'||env.FINCRA_SANDBOX_ENABLED!=='false'||env.LOCAL_DATABASE)throw Error('Cloud demo configuration invalid');
 if(!env.JWT_SECRET||env.JWT_SECRET.length<32||!env.DATABASE_URL)throw Error('Required secrets missing');
 if(env.PAYSTACK_SECRET_KEY&&!env.PAYSTACK_SECRET_KEY.startsWith('sk_test_'))throw Error('Only Paystack test keys allowed');
 if(!env.APP_BASE_URL||new URL(env.APP_BASE_URL).protocol!=='https:')throw Error('HTTPS APP_BASE_URL required');
 paymentMode.validateConfiguration();
}
async function allowed(request,env){
 // Fail closed even if an alternate Worker URL bypasses Cloudflare Access routing.
 const issuer=String(env.CF_ACCESS_ISSUER||'').replace(/\/$/,'');
 if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(issuer)||!env.CF_ACCESS_AUD)return false;
 const token=request.headers.get('Cf-Access-Jwt-Assertion');
 if(!token||token.length>16000)return false;
 try{
  const parts=token.split('.');if(parts.length!==3)return false;
  const [head,body,sig]=parts;
  const h=JSON.parse(Buffer.from(head,'base64url').toString()),claims=JSON.parse(Buffer.from(body,'base64url').toString());
  const now=Math.floor(Date.now()/1000);
  if(h.alg!=='RS256'||!h.kid||claims.iss!==issuer||!Array.isArray(claims.aud)||!claims.aud.includes(env.CF_ACCESS_AUD)||typeof claims.exp!=='number'||claims.exp<=now||(claims.nbf&&claims.nbf>now))return false;
  const keys=await fetch(issuer+'/cdn-cgi/access/certs');if(!keys.ok)return false;
  const key=(await keys.json()).keys?.find(k=>k.kid===h.kid&&k.kty==='RSA');if(!key)return false;
  return verify('RSA-SHA256',Buffer.from(head+'.'+body),createPublicKey({key,format:'jwk'}),Buffer.from(sig,'base64url'));
 }catch{return false}
}
export default {
 async fetch(request,env,ctx){
  const path=new URL(request.url).pathname;
  if(path==='/__deployment')return json({service:'OptiSave cloud preview',mode:'test'});
  try{safeConfig(env)}catch{return json({error:'Cloud demo configuration pending'},503)}
  if(env.DEMO_ENABLED!=='true')return json({error:'Private demo is not enabled'},503);
  // No public webhook exception until a signed test webhook policy is configured and reviewed.
  if(!await allowed(request,env))return json({error:'Authorized OptiSave reviewers only'},403);
  if(path.startsWith('/api/'))return http.fetch(request,env,ctx);
  if(request.method!=='GET'&&request.method!=='HEAD')return json({error:'Method not allowed'},405);
  if(path==='/'||/^\/[a-z0-9_-]+\.html$/i.test(path)||/^\/(css|js|images)\/[a-z0-9_./%+-]+$/i.test(path)){
   let assetRequest=request;
   if(path==='/'){const url=new URL(request.url);url.pathname='/index.html';assetRequest=new Request(url,request)}
   const response=await env.ASSETS.fetch(assetRequest);const out=new Response(response.body,response);out.headers.set('Cache-Control','no-store');return out;
  }
  return json({error:'Not found'},404);
 },
 async scheduled(controller,env,ctx){
  if(env.SCHEDULER_ENABLED!=='true')return;
  safeConfig(env);
  // A transaction-level advisory lock coordinates scheduled invocations. Plan locks and
  // transaction references inside the original engine remain the financial safeguards.
  await db.withDatabase(async()=>{
   const c=await db.pool.connect();
   try{
    await c.query('BEGIN');
    const {rows}=await c.query('SELECT pg_try_advisory_xact_lock(173006) AS acquired');
    if(rows[0].acquired){await engine.run();const state=(await db.query('SELECT last_error_count FROM financial_engine_state WHERE singleton=TRUE')).rows[0];if(Number(state?.last_error_count)>0)throw Error('Financial engine reported plan errors');}
    await c.query('COMMIT');
   }catch(err){await c.query('ROLLBACK').catch(()=>{});throw err}finally{c.release()}
  });
 }
};
