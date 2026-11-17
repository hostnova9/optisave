require("dotenv").config();const express=require("express"),cors=require("cors"),path=require("path"),fs=require("fs"),db=require("./db"),crypto=require("crypto");if(!process.env.JWT_SECRET)throw Error("JWT_SECRET is required");if (db.kind === 'pglite' && String(process.env.PAYMENT_MODE || 'test').toLowerCase() !== 'test') {
 throw new Error('Local PGlite mode permits PAYMENT_MODE=test only');
}
const app=express();app.disable("x-powered-by");app.use(cors());
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
app.use("/api/webhooks/fincra",express.raw({type:"application/json",limit:"1mb"}),require("./routes/fincra-webhooks"));app.use("/api/admin/mailer",express.json({limit:"10mb"}));app.use(express.json({limit:"1mb"}));app.get("/api/health",async(req,res)=>{try{await db.query("SELECT 1");res.json({ok:true,database:"connected",time:new Date().toISOString()})}catch(e){res.status(503).json({ok:false,database:"unavailable"})}});app.use("/api/auth",require("./routes/auth"));app.use("/api/admin",require("./routes/admin"));app.use("/api",require("./routes/account"));// Keep private files out of HTTP, even if a Cloudflare Tunnel is attached.
app.use((req,res,next)=>{
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const urlPath = req.path.replace(/\\/g,'/');
  const publicPage = /^\/(?:[a-z0-9_-]+\.html|favicon\.ico)?$/i.test(urlPath);
  const publicAsset = /^\/(?:css|js|images)\/(?!.*(?:\.\.|\/\.))[a-z0-9_./%+-]+\.(?:css|js|png|jpg|jpeg|svg|webp|gif|ico|woff|woff2|ttf|json)$/i.test(urlPath);
  if (!publicPage && !publicAsset) return res.sendStatus(404);
  next();
});
app.use(express.static(path.join(__dirname,".."),{setHeaders:(res,file)=>{if(/\.(?:html|js|css)$/i.test(String(file))){res.setHeader("Cache-Control","no-store, max-age=0");res.setHeader("Pragma","no-cache");res.setHeader("Expires","0");}}}));app.get("/",(_,res)=>res.sendFile(path.join(__dirname,"..","login.html")));app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:process.env.NODE_ENV==="development"?err.message:"Server error"})});const financialEngine=require("./financial-engine"),paymentMode=require("./payment-mode");const port=Number(process.env.PORT||3000);
(async()=>{
 try{
  const paymentConfig=paymentMode.validateConfiguration();
  console.log(`Payments: ${paymentConfig.mode.toUpperCase()} mode (${paymentConfig.keyKind} Paystack key)`);
  // Lightweight idempotent runtime migration: new safety tables/columns exist even when an
  // operator replaces the project folder and starts it without manually running db:init.
  await db.query(fs.readFileSync(path.join(__dirname,"schema.sql"),"utf8"));
  // For a brand-new local-only test database, create the configured admin.
  if (db.kind === 'pglite') {
    const exists = await db.query('SELECT id FROM admins LIMIT 1');
    if (exists.rowCount === 0 && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash(String(process.env.ADMIN_PASSWORD), 12);
      await db.query("INSERT INTO admins(email,password_hash,full_name,role,status) VALUES($1,$2,$3,'super_admin','active') ON CONFLICT(email) DO NOTHING", [
        process.env.ADMIN_EMAIL.toLowerCase(),hash,process.env.ADMIN_NAME || 'OptiSave Local Administrator'
      ]);
      console.log('Fresh local administrator initialized.');
    }
  }
  const host = db.kind === 'pglite' ? '127.0.0.1' : '0.0.0.0';
  const server = app.listen(port,host,()=>{
    console.log(`OptiSave running on http://localhost:${port} (${db.kind})`);
    financialEngine.start();
  });
  if (db.kind === 'pglite') {
    const shutdown = async () => {
      console.log('Closing OptiSave local database safely...');
      server.close(async () => {
        try { console.log('Portable backup:', await db.backup()); await db.close(); console.log('Local database closed. Safe to copy OptiSave.'); process.exit(0); }
        catch (e) { console.error('Shutdown error:',e); process.exit(1); }
      });
    };
    process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
  }
 }catch(e){console.error("OptiSave startup migration failed:",e.message);process.exit(1)}
})();