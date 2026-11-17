const crypto=require("crypto");
const r=require("express").Router(),bcrypt=require("bcryptjs"),jwt=require("jsonwebtoken"),db=require("../db"),auth=require("../middleware/admin-auth"),broadcastEmail=require("../broadcast-email"),companyMailer=require("../company-mailer"),fincraSandbox=require("../fincra-sandbox");
const cleanText=(v,max)=>String(v||"").trim().slice(0,max);
const safeActionUrl=v=>{const x=cleanText(v,300);if(!x)return null;if(/^(?:javascript:|data:|https?:\/\/|\/\/)/i.test(x)||x.includes("\\"))return null;return /^[A-Za-z0-9._\/-]+(?:\?[A-Za-z0-9_=&%.-]*)?$/.test(x)?x:null};
const types=new Set(["info","important","reminder","promo","security","system","success","warning"]);
function audienceSql(type,ids=[]){
 const base=`SELECT u.id,u.email,u.full_name FROM users u WHERE u.status='active' AND u.email_verified=true`;
 if(type==='all')return {sql:base+' ORDER BY u.created_at DESC',params:[]};
 if(type==='registered_no_plan')return {sql:base+` AND NOT EXISTS(SELECT 1 FROM plans p WHERE p.user_id=u.id) ORDER BY u.created_at DESC`,params:[]};
 if(type==='lock_only')return {sql:base+` AND EXISTS(SELECT 1 FROM plans p WHERE p.user_id=u.id AND p.plan_type='lock' AND p.status='active') ORDER BY u.created_at DESC`,params:[]};
 if(type==='allocation')return {sql:base+` AND EXISTS(SELECT 1 FROM plans p WHERE p.user_id=u.id AND p.plan_type='allocation' AND p.status='active') ORDER BY u.created_at DESC`,params:[]};
 if(type==='daily')return {sql:base+` AND EXISTS(SELECT 1 FROM plans p WHERE p.user_id=u.id AND p.plan_type='daily' AND p.status='active') ORDER BY u.created_at DESC`,params:[]};
 if(type==='active_plan')return {sql:base+` AND EXISTS(SELECT 1 FROM plans p WHERE p.user_id=u.id AND p.status='active') ORDER BY u.created_at DESC`,params:[]};
 if(type==='matured_plan')return {sql:base+` AND EXISTS(SELECT 1 FROM plans p WHERE p.user_id=u.id AND p.status='matured') ORDER BY u.created_at DESC`,params:[]};
 if(type==='inactive_30d')return {sql:base+` AND COALESCE(u.last_login_at,u.created_at)<NOW()-INTERVAL '30 days' ORDER BY COALESCE(u.last_login_at,u.created_at) ASC`,params:[]};
 if(type==='selected'){const list=[...new Set((ids||[]).map(x=>String(x)).filter(x=>/^\d+$/.test(x)))];if(!list.length)return {sql:base+' AND FALSE',params:[]};return {sql:base+` AND u.id=ANY($1::bigint[]) ORDER BY u.created_at DESC`,params:[list]}}
 return null;
}
async function getAudience(type,ids){const q=audienceSql(type,ids);if(!q){const e=Error('Invalid broadcast audience');e.status=400;throw e}return (await db.query(q.sql,q.params)).rows}
async function deliverBroadcastEmails(broadcast,users){
 let sent=0,failed=0;
 for(let i=0;i<users.length;i+=5){
  const batch=users.slice(i,i+5);
  const results=await Promise.allSettled(batch.map(async u=>{
   const first=String(u.full_name||'Saver').trim().split(/\s+/)[0]||'Saver';
   const html=broadcastEmail.buildEmail({...broadcast,firstName:first});
   await broadcastEmail.sendEmail(u.email,broadcast.title,html);
   await db.query(`UPDATE broadcast_recipients SET email_status='sent',email_error=NULL WHERE broadcast_id=$1 AND user_id=$2`,[broadcast.id,u.id]);
  }));
  for(let j=0;j<results.length;j++){if(results[j].status==='fulfilled')sent++;else{failed++;await db.query(`UPDATE broadcast_recipients SET email_status='failed',email_error=$3 WHERE broadcast_id=$1 AND user_id=$2`,[broadcast.id,batch[j].id,String(results[j].reason?.message||'Email failed').slice(0,500)]).catch(()=>{})}}
  await db.query(`UPDATE broadcasts SET email_sent_count=$2,email_failed_count=$3,status=$4 WHERE id=$1`,[broadcast.id,sent,failed,'sending_email']).catch(()=>{});
 }
 await db.query(`UPDATE broadcasts SET email_sent_count=$2,email_failed_count=$3,status='sent' WHERE id=$1`,[broadcast.id,sent,failed]).catch(()=>{});
}

const sign=a=>jwt.sign({sub:String(a.id),email:a.email,role:a.role,scope:"admin",sv:Number(a.session_version||0)},process.env.JWT_SECRET,{expiresIn:process.env.ADMIN_JWT_EXPIRES_IN||"8h"});
r.post("/login",async(req,res,next)=>{try{const {email,password}=req.body||{},q=await db.query("SELECT * FROM admins WHERE email=LOWER($1) LIMIT 1",[String(email||"").trim()]),a=q.rows[0];if(!a||!(await bcrypt.compare(String(password||""),a.password_hash)))return res.status(401).json({error:"Invalid admin email or password"});if(a.status!=="active")return res.status(403).json({error:"Admin account is disabled"});await db.query("UPDATE admins SET last_login_at=NOW() WHERE id=$1",[a.id]);res.json({token:sign(a),admin:{id:String(a.id),email:a.email,fullName:a.full_name,role:a.role,mustChangePassword:!!a.must_change_password}})}catch(e){next(e)}});
r.use(auth);
r.get('/me',async(req,res)=>res.json({admin:{id:req.admin.sub,email:req.admin.email,full_name:req.admin.fullName,role:req.admin.role,must_change_password:req.admin.mustChangePassword}}));

const allow=(...roles)=>(req,res,next)=>roles.includes(req.admin.role)?next():res.status(403).json({error:'This action requires a higher administrator permission'});
const owner=allow('super_admin');
const mailStaff=allow('super_admin','support_agent','personal_assistant');
const validateEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||''));
async function activity(actor,target,action){await db.query('INSERT INTO admin_activity(actor_admin_id,target_admin_id,action) VALUES($1,$2,$3)',[actor,target,action]);}

r.post('/change-password',async(req,res,next)=>{try{
 const current=String(req.body?.currentPassword||''),replacement=String(req.body?.newPassword||'');
 if(replacement.length<12||replacement.length>160)return res.status(400).json({error:'Use a new password of 12–160 characters'});
 const record=(await db.query('SELECT password_hash FROM admins WHERE id=$1',[req.admin.sub])).rows[0];
 if(!record||!(await bcrypt.compare(current,record.password_hash)))return res.status(401).json({error:'Current password is incorrect'});
 if(current===replacement)return res.status(400).json({error:'Choose a different password'});
 const hash=await bcrypt.hash(replacement,12);
 await db.query('UPDATE admins SET password_hash=$2,must_change_password=FALSE,session_version=session_version+1,updated_at=NOW() WHERE id=$1',[req.admin.sub,hash]);
 await activity(req.admin.sub,req.admin.sub,'password_changed');
 res.json({ok:true,loginRequired:true});
}catch(e){next(e)}});
// Freshly-created staff cannot use admin features until they set a private password.
r.use((req,res,next)=>req.admin.mustChangePassword?res.status(403).json({error:'Change your initial password before continuing'}):next());

r.get('/staff',owner,async(req,res,next)=>{try{
 const q=await db.query("SELECT id,email,full_name,role,status,last_login_at,created_at FROM admins WHERE role<>'super_admin' ORDER BY created_at DESC");
 res.json({staff:q.rows});
}catch(e){next(e)}});
r.post('/staff',owner,async(req,res,next)=>{try{
 const email=String(req.body?.email||'').trim().toLowerCase(),fullName=cleanText(req.body?.fullName,180),role=String(req.body?.role||'');
 if(!validateEmail(email)||email.length>255||!fullName||!['support_agent','personal_assistant'].includes(role))return res.status(400).json({error:'Provide name, valid email, and an allowed staff role'});
 const password=crypto.randomBytes(24).toString('base64url');
 const hash=await bcrypt.hash(password,12);
 const q=await db.query("INSERT INTO admins(email,password_hash,full_name,role,status,must_change_password) VALUES($1,$2,$3,$4,'active',TRUE) RETURNING id,email,full_name,role,status",[email,hash,fullName,role]);
 await activity(req.admin.sub,q.rows[0].id,'staff_created');
 res.status(201).json({staff:q.rows[0],temporaryPassword:password});
}catch(e){if(e.code==='23505')return res.status(409).json({error:'An administrator with this email already exists'});next(e)}});
r.patch('/staff/:id',owner,async(req,res,next)=>{try{
 if(!/^\d+$/.test(String(req.params.id)))return res.status(400).json({error:'Invalid staff ID'});
 const status=String(req.body?.status||'');
 if(!['active','disabled'].includes(status))return res.status(400).json({error:'Choose active or disabled'});
 const q=await db.query("UPDATE admins SET status=$2,session_version=session_version+1,updated_at=NOW() WHERE id=$1 AND role IN ('support_agent','personal_assistant') RETURNING id,full_name,email,role,status",[req.params.id,status]);
 if(!q.rows[0])return res.status(404).json({error:'Staff member not found'});
 await activity(req.admin.sub,req.params.id,status==='active'?'staff_enabled':'staff_disabled');res.json({staff:q.rows[0]});
}catch(e){next(e)}});
r.post('/staff/:id/reset-password',owner,async(req,res,next)=>{try{
 if(!/^\d+$/.test(String(req.params.id)))return res.status(400).json({error:'Invalid staff ID'});
 const password=crypto.randomBytes(24).toString('base64url'),hash=await bcrypt.hash(password,12);
 const q=await db.query("UPDATE admins SET password_hash=$2,must_change_password=TRUE,session_version=session_version+1,updated_at=NOW() WHERE id=$1 AND role IN ('support_agent','personal_assistant') RETURNING id,email",[req.params.id,hash]);
 if(!q.rows[0])return res.status(404).json({error:'Staff member not found'});
 await activity(req.admin.sub,req.params.id,'staff_password_reset');res.json({staff:q.rows[0],temporaryPassword:password});
}catch(e){next(e)}});
r.get('/staff/customers',allow('super_admin','support_agent'),async(req,res,next)=>{try{
 const search=cleanText(req.query?.q,90).toLowerCase();
 const q=await db.query("SELECT id,full_name,email,phone,status,created_at FROM users WHERE $1='' OR LOWER(full_name) LIKE $2 OR LOWER(email) LIKE $2 ORDER BY created_at DESC LIMIT 100",[search,'%'+search+'%']);
 res.json({customers:q.rows});
}catch(e){next(e)}});

// Permissions enforced by the API, not just hidden navigation links.
r.use('/overview',owner);
r.use('/kyc',owner);
r.use('/broadcast',owner);
r.use('/fincra',owner);
r.use('/dev',owner);
r.use('/mailer',mailStaff);
r.use('/mailer/brand',owner);
r.use('/mailer/contacts/:id', (req,res,next)=> req.method==='DELETE' ? owner(req,res,next) : next());

r.get("/overview",async(req,res,next)=>{try{
 const [users,plans,tx,notes,kyc]=await Promise.all([
  db.query(`SELECT u.id,u.email,u.full_name,u.phone,u.status,u.created_at,w.available_balance,w.total_locked FROM users u LEFT JOIN wallets w ON w.user_id=u.id ORDER BY u.created_at DESC`),
  db.query("SELECT * FROM plans ORDER BY created_at DESC"),
  db.query("SELECT * FROM transactions ORDER BY created_at DESC LIMIT 500"),
  db.query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 300"),
  db.query(`SELECT k.*,u.full_name,u.email,b.bank_name,b.account_name,b.account_number_last4 FROM kyc_profiles k JOIN users u ON u.id=k.user_id LEFT JOIN bank_accounts b ON b.user_id=k.user_id AND b.is_primary=true ORDER BY k.updated_at DESC`)
 ]);res.json({users:users.rows,plans:plans.rows,transactions:tx.rows,notifications:notes.rows,kyc:kyc.rows});
}catch(e){next(e)}});

r.post("/kyc/:userId/review",async(req,res,next)=>{try{const action=String(req.body.action||"").toLowerCase(),reason=String(req.body.reason||"").trim();if(!["approve","reject"].includes(action))return res.status(400).json({error:"Invalid review action"});const q=await db.query("SELECT * FROM kyc_profiles WHERE user_id=$1",[req.params.userId]),k=q.rows[0];if(!k)return res.status(404).json({error:"KYC not found"});if(action==="approve"&&k.bank_name_match!==true)return res.status(400).json({error:"Cannot approve automatically: verified bank name does not match the user's profile name. Review/correct the identity details first."});const status=action==="approve"?"verified":"rejected";await db.query("UPDATE kyc_profiles SET status=$1,review_reason=$2,verified_at=CASE WHEN $1='verified' THEN NOW() ELSE NULL END,reviewed_at=NOW(),reviewed_by=$3,updated_at=NOW() WHERE user_id=$4",[status,reason||null,req.admin.sub,req.params.userId]);await db.query("INSERT INTO notifications(user_id,title,message,type,action_url) VALUES($1,$2,$3,$4,'kyc.html')",[req.params.userId,status==="verified"?"Identity verified":"KYC review update",status==="verified"?"Your identity and bank-name review has been approved.":(reason||"Your KYC needs attention."),status==="verified"?"success":"warning"]);res.json({ok:true,status})}catch(e){next(e)}});


r.get("/broadcast/config",async(req,res)=>{res.json({emailConfigured:broadcastEmail.emailConfigured(),audiences:[
 {id:"all",label:"All active users"},{id:"registered_no_plan",label:"Registered but no plan"},{id:"lock_only",label:"Lock Only users"},{id:"allocation",label:"Lock & Allocation users"},{id:"daily",label:"Daily Savings users"},{id:"active_plan",label:"Any active plan"},{id:"matured_plan",label:"Matured plan users"},{id:"inactive_30d",label:"Inactive for 30+ days"},{id:"selected",label:"Selected users"}
]})});
r.get("/broadcast/users",async(req,res,next)=>{try{const search=cleanText(req.query.search,120);const like='%'+search.toLowerCase()+'%';const q=await db.query(`SELECT u.id,u.email,u.full_name,u.phone,u.last_login_at,u.created_at,
 EXISTS(SELECT 1 FROM plans p WHERE p.user_id=u.id AND p.plan_type='lock' AND p.status='active') AS has_lock,
 EXISTS(SELECT 1 FROM plans p WHERE p.user_id=u.id AND p.plan_type='allocation' AND p.status='active') AS has_allocation,
 EXISTS(SELECT 1 FROM plans p WHERE p.user_id=u.id AND p.plan_type='daily' AND p.status='active') AS has_daily,
 EXISTS(SELECT 1 FROM plans p WHERE p.user_id=u.id AND p.status='active') AS has_active_plan
 FROM users u WHERE u.status='active' AND u.email_verified=true AND ($1='' OR LOWER(u.full_name) LIKE $2 OR LOWER(u.email) LIKE $2 OR COALESCE(u.phone,'') LIKE $3) ORDER BY u.created_at DESC LIMIT 100`,[search,like,'%'+search+'%']);res.json({users:q.rows})}catch(e){next(e)}});
r.post("/broadcast/preview",async(req,res,next)=>{try{const type=cleanText(req.body.audienceType,40),users=await getAudience(type,req.body.selectedUserIds);res.json({recipientCount:users.length,sample:users.slice(0,8)})}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}});
r.get("/broadcast/history",async(req,res,next)=>{try{const q=await db.query(`SELECT b.*,a.full_name AS admin_name,
 (SELECT COUNT(*)::int FROM broadcast_recipients br JOIN notifications n ON n.id=br.notification_id WHERE br.broadcast_id=b.id AND n.is_read=true) AS read_count
 FROM broadcasts b LEFT JOIN admins a ON a.id=b.admin_id ORDER BY b.created_at DESC LIMIT 100`);res.json({broadcasts:q.rows})}catch(e){next(e)}});
r.post("/broadcast/send",async(req,res,next)=>{try{
 const title=cleanText(req.body.title,180),subtitle=cleanText(req.body.subtitle,220)||null,message=cleanText(req.body.message,3000),type=types.has(String(req.body.type||''))?String(req.body.type):'info',audienceType=cleanText(req.body.audienceType,40),actionLabel=cleanText(req.body.actionLabel,80)||null;
 if(!title||!message)return res.status(400).json({error:'Message title and body are required'});
 const rawUrl=cleanText(req.body.actionUrl,300),actionUrl=rawUrl?safeActionUrl(rawUrl):null;if(rawUrl&&!actionUrl)return res.status(400).json({error:'Action link must be a safe OptiSave page such as dashboard.html or create-plan.html'});
 if((actionLabel&&!actionUrl)||(!actionLabel&&actionUrl))return res.status(400).json({error:'Action button label and action page must be provided together'});
 const users=await getAudience(audienceType,req.body.selectedUserIds);if(!users.length)return res.status(400).json({error:'No users match this audience'});
 const emailRequested=req.body.email===true;if(emailRequested&&users.length>10)return res.status(400).json({error:'Cloud demo: select at most 10 email recipients per broadcast.'});if(emailRequested&&!broadcastEmail.emailConfigured())return res.status(400).json({error:'Email sending is not configured. Add RESEND_API_KEY and BROADCAST_EMAIL_FROM, or send in-app only.'});
 const c=await db.pool.connect();let broadcast;try{await c.query('BEGIN');
  broadcast=(await c.query(`INSERT INTO broadcasts(admin_id,title,subtitle,message,message_type,audience_type,audience_filters,channels,action_label,action_url,recipient_count,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[req.admin.sub,title,subtitle,message,type,audienceType,JSON.stringify({selectedUserIds:req.body.selectedUserIds||[]}),JSON.stringify({inApp:true,email:emailRequested}),actionLabel,actionUrl,users.length,emailRequested?'sending_email':'sent'])).rows[0];
  const ids=users.map(u=>String(u.id));
  await c.query(`INSERT INTO notifications(user_id,title,subtitle,message,type,action_url,action_label,brand_style,broadcast_id) SELECT target.user_id,$2,$3,$4,$5,$6,$7,'optisave',$8 FROM unnest($1::bigint[]) AS target(user_id)`,[ids,title,subtitle,message,type,actionUrl,actionLabel,broadcast.id]);
  await c.query(`INSERT INTO broadcast_recipients(broadcast_id,user_id,notification_id,email_status) SELECT $1,n.user_id,n.id,$2 FROM notifications n WHERE n.broadcast_id=$1`,[broadcast.id,emailRequested?'pending':'not_requested']);
  await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 if(emailRequested)await deliverBroadcastEmails({id:broadcast.id,title,subtitle,message,type,actionLabel,actionUrl},users);
 res.status(201).json({ok:true,broadcastId:String(broadcast.id),recipientCount:users.length,emailQueued:emailRequested});
}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}});


// v1.59 Company Mailer: official external correspondence with branded layouts,
// attachments, saved partner contacts and sent-mail history.
const mailLayouts=new Set(['formal','partnership','investor','support','general']);
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function mailEmails(v,max=25){
 const raw=Array.isArray(v)?v:String(v||'').split(/[;,\n]/);
 const out=[...new Set(raw.map(x=>String(x||'').trim().toLowerCase()).filter(Boolean))];
 if(out.length>max){const e=Error(`A maximum of ${max} email addresses is allowed per field`);e.status=400;throw e}
 if(out.some(x=>!emailPattern.test(x)||x.length>180)){const e=Error('One or more email addresses are invalid');e.status=400;throw e}
 return out;
}
function mailAttachments(v){
 if(!Array.isArray(v)||!v.length)return {provider:[],metadata:[]};
 if(v.length>5){const e=Error('Attach a maximum of 5 files');e.status=400;throw e}
 const allowed=new Set(['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','image/png','image/jpeg','text/plain']);
 let total=0;const provider=[],metadata=[];
 for(const item of v){
  const filename=String(item?.filename||'attachment').replace(/[\\/\0]/g,'_').slice(0,160),mime=String(item?.mimeType||'application/octet-stream').toLowerCase(),content=String(item?.content||'').replace(/^data:[^;]+;base64,/, '');
  if(!allowed.has(mime)){const e=Error(`Unsupported attachment type: ${mime}`);e.status=400;throw e}
  if(!/^[A-Za-z0-9+/=\r\n]+$/.test(content)){const e=Error(`Invalid attachment data for ${filename}`);e.status=400;throw e}
  const size=Buffer.from(content,'base64').length;total+=size;
  if(size>4*1024*1024){const e=Error(`${filename} is larger than 4 MB`);e.status=400;throw e}
  provider.push({filename,content});metadata.push({filename,mimeType:mime,size});
 }
 if(total>7*1024*1024){const e=Error('Total attachment size must be 7 MB or less');e.status=400;throw e}
 return {provider,metadata};
}
async function mailBrand(){
 const q=await db.query('SELECT * FROM company_mail_brand WHERE singleton=TRUE LIMIT 1');
 return q.rows[0]||{company_name:'OptiSave Digital Solutions Ltd',rc_number:'9899018',support_email:'support@myoptisave.site',website:'https://myoptisave.site',logo_url:'images/optisave-broadcast-logo.png',tagline:'Save Better. Live Better.',sender_name:'Adesokan Samson',sender_title:'Director',primary_color:'#071a4b',accent_color:'#1269e8'};
}
r.get('/mailer/config',async(req,res,next)=>{try{res.json({emailConfigured:broadcastEmail.emailConfigured(),from:String(process.env.COMPANY_EMAIL_FROM||process.env.BROADCAST_EMAIL_FROM||process.env.AUTH_EMAIL_FROM||process.env.EMAIL_FROM||''),brand:await mailBrand(),maxAttachments:5,maxAttachmentMb:7})}catch(e){next(e)}});
r.put('/mailer/brand',async(req,res,next)=>{try{
 const b=req.body||{},color=v=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v):null;
 const company=cleanText(b.companyName,180),rc=cleanText(b.rcNumber,60),support=cleanText(b.supportEmail,180).toLowerCase(),website=cleanText(b.website,500),logo=cleanText(b.logoUrl,500),tagline=cleanText(b.tagline,180),sender=cleanText(b.senderName,180),senderTitle=cleanText(b.senderTitle,120),primary=color(b.primaryColor),accent=color(b.accentColor);
 if(!company||!rc||!emailPattern.test(support)||!companyMailer.safeHttpUrl(website)||!tagline||!sender||!senderTitle||!primary||!accent)return res.status(400).json({error:'Complete all brand fields with valid values. Website must start with http:// or https://.'});
 if(/^https?:\/\//i.test(logo)&&!companyMailer.safeHttpUrl(logo))return res.status(400).json({error:'Logo URL must be a valid http/https URL or an OptiSave-relative path.'});
 const q=await db.query(`UPDATE company_mail_brand SET company_name=$1,rc_number=$2,support_email=$3,website=$4,logo_url=$5,tagline=$6,sender_name=$7,sender_title=$8,primary_color=$9,accent_color=$10,updated_at=NOW() WHERE singleton=TRUE RETURNING *`,[company,rc,support,website,logo||'images/optisave-broadcast-logo.png',tagline,sender,senderTitle,primary,accent]);
 res.json({ok:true,brand:q.rows[0]});
}catch(e){next(e)}});
r.get('/mailer/history',async(req,res,next)=>{try{const q=await db.query(`SELECT m.*,a.full_name AS admin_name FROM company_mail_messages m LEFT JOIN admins a ON a.id=m.admin_id ORDER BY m.created_at DESC LIMIT 120`);res.json({messages:q.rows})}catch(e){next(e)}});

async function sendCompanyMail(req,res,next,isTest=false){try{
 if(!broadcastEmail.emailConfigured())return res.status(400).json({error:'Company email delivery is not configured. Add RESEND_API_KEY and COMPANY_EMAIL_FROM (or BROADCAST_EMAIL_FROM) to .env.'});
 const to=mailEmails(req.body.to,isTest?1:25),cc=mailEmails(req.body.cc||[],20),bcc=mailEmails(req.body.bcc||[],20);if(!to.length)return res.status(400).json({error:'Add at least one recipient email address.'});
 const subject=cleanText(req.body.subject,220),title=cleanText(req.body.title,220)||subject,greeting=cleanText(req.body.greeting,220),body=cleanText(req.body.body,20000),layout=mailLayouts.has(String(req.body.layout||''))?String(req.body.layout):'formal',ctaLabel=cleanText(req.body.ctaLabel,100)||null,ctaUrl=cleanText(req.body.ctaUrl,800)||null;
 const requestKey=cleanText(req.body.requestId,100);
 if(requestKey&&!/^[A-Za-z0-9._:-]{8,100}$/.test(requestKey))return res.status(400).json({error:'Invalid mail request identifier.'});
 if(!subject||!body)return res.status(400).json({error:'Subject and message body are required.'});
 if((ctaLabel&&!companyMailer.safeHttpUrl(ctaUrl))||(!ctaLabel&&ctaUrl))return res.status(400).json({error:'For a button, provide both a label and a valid http/https URL.'});
 if(requestKey){
  const previous=(await db.query(`SELECT id,status,provider_id,provider_error FROM company_mail_messages WHERE request_key=$1 LIMIT 1`,[requestKey])).rows[0];
  if(previous){
   if(previous.status==='sent')return res.status(200).json({ok:true,id:String(previous.id),providerId:previous.provider_id||null,toCount:to.length,duplicate:true,status:'sent'});
   if(previous.status==='sending')return res.status(202).json({ok:true,id:String(previous.id),toCount:to.length,duplicate:true,pending:true,status:'sending'});
   if(previous.status==='failed')return res.status(409).json({error:'This send attempt previously failed: '+String(previous.provider_error||'Email delivery failed').slice(0,500)});
  }
 }
 console.log('[COMPANY_MAILER_PHASE]',{phase:'preparing',toCount:to.length,isTest,requestKey:requestKey||null});
 const attachments=mailAttachments(req.body.attachments||[]),brand=await mailBrand(),html=companyMailer.buildCompanyEmail({subject,title,greeting,body,layout,ctaLabel,ctaUrl,brand});
 const saved=(await db.query(`INSERT INTO company_mail_messages(admin_id,to_emails,cc_emails,bcc_emails,subject,title,greeting,body_text,layout,cta_label,cta_url,attachment_metadata,status,is_test,request_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'sending',$13,$14) RETURNING *`,[req.admin.sub,JSON.stringify(to),JSON.stringify(cc),JSON.stringify(bcc),subject,title,greeting||null,body,layout,ctaLabel,ctaUrl,JSON.stringify(attachments.metadata),isTest,requestKey||null])).rows[0];
 try{
  console.log('[COMPANY_MAILER_PHASE]',{phase:'provider_request',messageId:String(saved.id),toCount:to.length,isTest});
  const result=await companyMailer.sendCompanyEmail({to,cc,bcc,subject,html,attachments:attachments.provider});
  const providerId=String(result?.id||'').slice(0,220)||null;
  console.log('[COMPANY_MAILER_PHASE]',{phase:'provider_accepted',messageId:String(saved.id),providerId,isTest});
  // Return immediately once the delivery provider has accepted the message. History/contact
  // bookkeeping runs after the response so a slow DB update cannot leave the admin modal spinning.
  res.status(201).json({ok:true,id:String(saved.id),providerId,toCount:to.length,status:'accepted'});
  setImmediate(async()=>{try{
   await db.query(`UPDATE company_mail_messages SET status='sent',provider_id=$2,provider_error=NULL,sent_at=NOW() WHERE id=$1`,[saved.id,providerId]);
   if(!isTest)await db.query(`UPDATE company_contacts SET last_contact_at=NOW(),status=CASE WHEN status='new' THEN 'contacted' ELSE status END,updated_at=NOW() WHERE LOWER(email)=ANY($1::text[])`,[to.map(x=>x.toLowerCase())]).catch(()=>{});
  }catch(e){console.error('[COMPANY_MAILER_POST_SEND_DB_FAILED]',{messageId:String(saved.id),message:String(e?.message||e)})}});
  return;
 }catch(err){const safeMessage=String(err.message||'Email failed').slice(0,1000);console.error('[COMPANY_MAILER_SEND_FAILED]',{message:safeMessage,toCount:to.length,isTest,messageId:String(saved.id)});await db.query(`UPDATE company_mail_messages SET status='failed',provider_error=$2 WHERE id=$1`,[saved.id,safeMessage]).catch(()=>{});return res.status(502).json({error:safeMessage||'Email delivery failed'});}
}catch(e){if(e?.code==='23505'&&cleanText(req.body.requestId,100)){
 try{const previous=(await db.query(`SELECT id,status,provider_id,provider_error FROM company_mail_messages WHERE request_key=$1 LIMIT 1`,[cleanText(req.body.requestId,100)])).rows[0];if(previous?.status==='sent')return res.status(200).json({ok:true,id:String(previous.id),providerId:previous.provider_id||null,toCount:mailEmails(req.body.to,isTest?1:25).length,duplicate:true,status:'sent'});if(previous)return res.status(202).json({ok:true,id:String(previous.id),toCount:mailEmails(req.body.to,isTest?1:25).length,duplicate:true,pending:true,status:previous.status});}catch(_){}
 }
 if(e.status)return res.status(e.status).json({error:e.message});next(e)}}
r.post('/mailer/send',(req,res,next)=>sendCompanyMail(req,res,next,false));
r.post('/mailer/test',(req,res,next)=>sendCompanyMail(req,res,next,true));

r.get('/mailer/contacts',async(req,res,next)=>{try{const q=await db.query(`SELECT * FROM company_contacts ORDER BY COALESCE(next_follow_up_at,'9999-12-31'::timestamptz),updated_at DESC LIMIT 250`);res.json({contacts:q.rows})}catch(e){next(e)}});
r.post('/mailer/contacts',async(req,res,next)=>{try{
 const company=cleanText(req.body.companyName,180),contact=cleanText(req.body.contactName,180)||null,email=cleanText(req.body.email,180).toLowerCase(),category=cleanText(req.body.category,60)||'bank',status=cleanText(req.body.status,40)||'new',notes=cleanText(req.body.notes,3000)||null,nextFollow=req.body.nextFollowUp?new Date(req.body.nextFollowUp):null;
 if(!company||!emailPattern.test(email))return res.status(400).json({error:'Company name and a valid email are required.'});if(nextFollow&&Number.isNaN(nextFollow.getTime()))return res.status(400).json({error:'Invalid follow-up date.'});
 const existing=(await db.query('SELECT id FROM company_contacts WHERE LOWER(email)=LOWER($1) LIMIT 1',[email])).rows[0];
 const q=existing?await db.query(`UPDATE company_contacts SET company_name=$2,contact_name=$3,category=$4,status=$5,notes=$6,next_follow_up_at=$7,updated_at=NOW() WHERE id=$1 RETURNING *`,[existing.id,company,contact,category,status,notes,nextFollow?nextFollow.toISOString():null]):await db.query(`INSERT INTO company_contacts(company_name,contact_name,email,category,status,notes,next_follow_up_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[company,contact,email,category,status,notes,nextFollow?nextFollow.toISOString():null]);res.status(201).json({ok:true,contact:q.rows[0]});
}catch(e){next(e)}});
r.patch('/mailer/contacts/:id',async(req,res,next)=>{try{
 const status=cleanText(req.body.status,40),notes=req.body.notes===undefined?undefined:cleanText(req.body.notes,3000),next=req.body.nextFollowUp===undefined?undefined:(req.body.nextFollowUp?new Date(req.body.nextFollowUp):null);if(next instanceof Date&&Number.isNaN(next.getTime()))return res.status(400).json({error:'Invalid follow-up date.'});
 const old=(await db.query('SELECT * FROM company_contacts WHERE id=$1',[req.params.id])).rows[0];if(!old)return res.status(404).json({error:'Contact not found'});
 const q=await db.query(`UPDATE company_contacts SET status=$2,notes=$3,next_follow_up_at=$4,updated_at=NOW() WHERE id=$1 RETURNING *`,[req.params.id,status||old.status,notes===undefined?old.notes:(notes||null),next===undefined?old.next_follow_up_at:(next?next.toISOString():null)]);res.json({ok:true,contact:q.rows[0]});
}catch(e){next(e)}});
r.delete('/mailer/contacts/:id',async(req,res,next)=>{try{await db.query('DELETE FROM company_contacts WHERE id=$1',[req.params.id]);res.json({ok:true})}catch(e){next(e)}});



// v1.69 Fincra Sandbox Integration Lab (admin-only; isolated from user balances).
r.get('/fincra/config',async(req,res,next)=>{try{res.json({...fincraSandbox.publicConfig(),readiness:await fincraSandbox.readiness()})}catch(e){next(e)}});
r.get('/fincra/logs',async(req,res,next)=>{try{res.json({logs:await fincraSandbox.logs(req.query.limit)})}catch(e){next(e)}});
r.post('/fincra/run/:action',async(req,res,next)=>{try{const result=await fincraSandbox.run(String(req.params.action||''),req.body||{},req.admin.sub);res.json(result)}catch(e){if(e.status)return res.status(e.status).json({error:e.message,providerStatus:e.providerStatus||null,providerData:e.providerData||null});next(e)}});
r.post("/dev/reset-user/:userId",async(req,res,next)=>{if(process.env.NODE_ENV!=="development")return res.status(404).json({error:"Not available"});if(String(req.body.confirm||"")!=="RESET")return res.status(400).json({error:"Type RESET to confirm"});const id=req.params.userId,c=await db.pool.connect();try{await c.query("BEGIN");await c.query("DELETE FROM financial_ledger WHERE user_id=$1",[id]);await c.query("DELETE FROM idempotency_requests WHERE user_id=$1",[id]);await c.query("DELETE FROM transactions WHERE user_id=$1",[id]);await c.query("DELETE FROM plans WHERE user_id=$1",[id]);await c.query("DELETE FROM notifications WHERE user_id=$1",[id]);await c.query("UPDATE wallets SET available_balance=0,total_deposited=0,total_withdrawn=0,total_locked=0,total_credited=0,updated_at=NOW() WHERE user_id=$1",[id]);await c.query("COMMIT");res.json({ok:true})}catch(e){await c.query("ROLLBACK");next(e)}finally{c.release()}});
module.exports=r;