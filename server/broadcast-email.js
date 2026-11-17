const htmlEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeBase=()=>String(process.env.APP_BASE_URL||'https://myoptisave.site').replace(/\/+$/,'');
function buildEmail({title,subtitle,message,type,actionLabel,actionUrl,firstName}){
 const base=safeBase(),logo=base+'/images/optisave-broadcast-logo.png',href=actionUrl?base+'/'+String(actionUrl).replace(/^\/+/, ''):'';
 const typeLabel=({important:'IMPORTANT',reminder:'REMINDER',promo:'UPDATE',security:'SECURITY',system:'SYSTEM',success:'UPDATE',warning:'IMPORTANT',info:'OPTISAVE UPDATE'})[type]||'OPTISAVE UPDATE';
 const cta=href&&actionLabel?`<div style="margin-top:26px"><a href="${htmlEscape(href)}" style="display:inline-block;background:#1269e8;color:#fff;text-decoration:none;padding:13px 20px;border-radius:12px;font-weight:800">${htmlEscape(actionLabel)}</a></div>`:'';
 return `<!doctype html><html><body style="margin:0;background:#eef6ff;font-family:Arial,sans-serif;color:#102b4a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;background:#eef6ff"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 14px 42px rgba(18,70,120,.13)"><tr><td style="padding:24px 28px;background:linear-gradient(135deg,#071a4b,#1269e8);color:white"><table width="100%"><tr><td width="74"><img src="${htmlEscape(logo)}" alt="OptiSave" width="62" height="62" style="display:block;border-radius:16px;object-fit:cover"></td><td><div style="font-size:28px;font-weight:900">OptiSave</div><div style="font-size:13px;opacity:.86;margin-top:3px">Save Better. Live Better.</div></td></tr></table></td></tr><tr><td style="padding:34px 30px"><div style="display:inline-block;background:#eaf3ff;color:#1269e8;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:900;letter-spacing:.06em">${htmlEscape(typeLabel)}</div><h1 style="font-size:25px;line-height:1.2;margin:16px 0 7px;color:#102b4a">${htmlEscape(title)}</h1>${subtitle?`<div style="font-size:15px;color:#58708c;font-weight:700;margin-bottom:18px">${htmlEscape(subtitle)}</div>`:''}<p style="font-size:15px;line-height:1.72;color:#536a82;margin:0">Hello ${htmlEscape(firstName||'Saver')},<br><br>${htmlEscape(message).replace(/\n/g,'<br>')}</p>${cta}</td></tr><tr><td style="padding:20px 30px;background:#f7fbff;border-top:1px solid #e8f0f8;color:#71869b;font-size:12px;line-height:1.6;text-align:center">OptiSave Digital Solutions Ltd · RC 9899018<br><a href="${base}" style="color:#1269e8">myoptisave.site</a> · support@myoptisave.site</td></tr></table></td></tr></table></body></html>`;
}
async function sendEmail(to,subject,html,options={}){
 const key=String(process.env.RESEND_API_KEY||'').trim(),from=String(process.env.COMPANY_EMAIL_FROM||process.env.BROADCAST_EMAIL_FROM||process.env.AUTH_EMAIL_FROM||process.env.EMAIL_FROM||'').trim();
 if(!key||!from){const e=Error('Email delivery is not configured');e.code='EMAIL_NOT_CONFIGURED';throw e}
 const toList=(Array.isArray(to)?to:[to]).map(x=>String(x||'').trim()).filter(Boolean);
 const payload={from,to:toList,subject,html};
 if(Array.isArray(options.cc)&&options.cc.length)payload.cc=options.cc;
 if(Array.isArray(options.bcc)&&options.bcc.length)payload.bcc=options.bcc;
 if(Array.isArray(options.attachments)&&options.attachments.length)payload.attachments=options.attachments;
 if(options.replyTo)payload.reply_to=options.replyTo;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
 let x;
 try{x=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal})}
 catch(err){if(err?.name==='AbortError')throw Error('Email provider timed out after 18 seconds. Please try again once and check Render logs if it repeats.');throw Error('Unable to reach the email provider: '+String(err?.message||err))}
 finally{clearTimeout(timer)}
 const raw=await x.text().catch(()=>"");let data={};try{data=raw?JSON.parse(raw):{}}catch(_){data={}}
 if(!x.ok){let detail='';try{detail=data?.message||data?.error?.message||data?.name||''}catch(_){};throw Error('Email provider rejected the message'+(detail?': '+String(detail).slice(0,260):(raw?': '+raw.slice(0,260):'')))}
 return data;
}
const configured=()=>!!(String(process.env.RESEND_API_KEY||'').trim()&&String(process.env.COMPANY_EMAIL_FROM||process.env.BROADCAST_EMAIL_FROM||process.env.AUTH_EMAIL_FROM||process.env.EMAIL_FROM||'').trim());
module.exports={buildEmail,sendEmail,emailConfigured:configured};
