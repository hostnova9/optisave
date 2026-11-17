const express=require('express'),crypto=require('crypto'),db=require('./db');
function makeApp(waitUntil){
const app=express(); app.disable('x-powered-by');
app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');next()});
app.use((req,res,next)=>{req.optisaveWaitUntil=waitUntil;return db.requestMiddleware(req,res,next)});
app.post("/api/webhooks/paystack",express.raw({type:"application/json",limit:"1mb"}),async(req,res)=>{
 try{
  const key=process.env.PAYSTACK_SECRET_KEY||"",sig=String(req.headers["x-paystack-signature"]||"");
  if(!key||!sig)return res.sendStatus(401);
  const expected=crypto.createHmac("sha512",key).update(req.body).digest("hex");
  const a=Buffer.from(sig),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.sendStatus(401);
  const event=JSON.parse(req.body.toString("utf8")),type=String(event.event||""),data=event.data||{};
  const payments=require("./payments");
  if(type==="charge.success") await payments.settleDeposit(data);
  if(type==="transfer.success"||type==="transfer.failed"||type==="transfer.reversed") await payments.settleTransfer(type,data);
  if(type==="customeridentification.success"||type==="customeridentification.failed"){
    const email=String(data.email||data.customer?.email||"").trim().toLowerCase(),code=String(data.customer_code||data.customer?.customer_code||"");
    // v1.33: Paystack identification webhooks do not always expose email at the same path.
    // Prefer email when present, then fall back to the provider customer code persisted when KYC started.
    let u=null;
    if(email)u=(await db.query("SELECT id FROM users WHERE LOWER(email)=$1",[email])).rows[0]||null;
    if(!u&&code)u=(await db.query("SELECT u.id FROM users u JOIN kyc_profiles k ON k.user_id=u.id WHERE k.provider_customer_code=$1 ORDER BY k.updated_at DESC LIMIT 1",[code])).rows[0]||null;
    if(u){
      const ok=type==="customeridentification.success",reason=ok?null:String(data.reason||"Identity verification failed");
      const c=await db.pool.connect();
      try{
        await c.query("BEGIN");
        await c.query(`INSERT INTO kyc_profiles(user_id,status,provider_customer_code,provider_status,provider_reason,provider_checked_at,verified_at,review_reason,updated_at)
          VALUES($1,$2,$3,$4,$5,NOW(),CASE WHEN $2::text='verified' THEN NOW() ELSE NULL END,NULL,NOW())
          ON CONFLICT(user_id) DO UPDATE SET provider_customer_code=COALESCE(NULLIF($3,''),kyc_profiles.provider_customer_code),provider_status=$4,provider_reason=$5,provider_checked_at=NOW(),status=$2,verified_at=CASE WHEN $2::text='verified' THEN COALESCE(kyc_profiles.verified_at,NOW()) ELSE NULL END,review_reason=NULL,bvn_fingerprint=CASE WHEN $2::text='verified' THEN kyc_profiles.bvn_fingerprint ELSE NULL END,bank_account_fingerprint=CASE WHEN $2::text='verified' THEN kyc_profiles.bank_account_fingerprint ELSE NULL END,updated_at=NOW()`,
          [u.id,ok?"verified":"action_required",code,ok?"verified":"failed",reason]);
        if(ok){
          await c.query("UPDATE bank_accounts SET is_verified=true WHERE user_id=$1 AND is_primary=true",[u.id]);
          const b=(await c.query("SELECT bank_name,account_name,account_number_last4,provider_recipient_code FROM bank_accounts WHERE user_id=$1 AND is_primary=true ORDER BY id DESC LIMIT 1",[u.id])).rows[0];
          if(b) await c.query("UPDATE kyc_profiles SET bank_account_name=COALESCE(NULLIF($2,''),bank_account_name),updated_at=NOW() WHERE user_id=$1",[u.id,b.account_name||null]);
        }else{
          await c.query("UPDATE bank_accounts SET is_verified=false WHERE user_id=$1 AND is_primary=true",[u.id]);
        }
        await c.query("INSERT INTO notifications(user_id,title,message,type,action_url) VALUES($1,$2,$3,$4,'kyc.html')",[u.id,ok?"Identity verified":"Identity verification action required",ok?"Your identity verification was completed successfully. Your verified bank is now linked for withdrawals.":(reason+" Open KYC to re-verify or re-upload the requested information."),ok?"success":"warning"]);
        await c.query("COMMIT");
      }catch(err){await c.query("ROLLBACK");throw err}finally{c.release()}
    }
  }
  res.sendStatus(200);
 }catch(e){console.error("Paystack webhook error",e);res.sendStatus(500)}
});
app.use("/api/webhooks/fincra",express.raw({type:"application/json",limit:"1mb"}),require("./routes/fincra-webhooks"));app.use("/api/admin/mailer",express.json({limit:"10mb"}));app.use(express.json({limit:"1mb"}));app.get("/api/health",async(req,res)=>{try{await db.query("SELECT 1");res.json({ok:true,database:"connected",time:new Date().toISOString()})}catch(e){res.status(503).json({ok:false,database:"unavailable"})}});app.use("/api/auth",require("./routes/auth"));app.use("/api/admin",require("./routes/admin"));app.use("/api",require("./routes/account"));
app.use((req,res)=>res.status(404).json({error:'Not found'}));
app.use((err,req,res,next)=>{console.error('OptiSave API error:',err.code||err.name||'Error');if(res.headersSent)return next(err);res.status(err.status===413?413:500).json({error:err.status===413?'Request too large':'Server error'})});
return app;
}
module.exports=makeApp;
