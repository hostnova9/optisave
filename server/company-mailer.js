const broadcastEmail=require('./broadcast-email');

const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hex=(v,fallback)=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v):fallback;
const baseUrl=()=>String(process.env.APP_BASE_URL||'https://myoptisave.site').replace(/\/+$/,'');
const absUrl=v=>{const x=String(v||'').trim();if(!x)return '';if(/^https:\/\//i.test(x))return x;if(/^http:\/\//i.test(x))return x;return baseUrl()+'/'+x.replace(/^\/+/, '')};
const safeHttpUrl=v=>{const x=String(v||'').trim();if(!x)return '';try{const u=new URL(x);return ['http:','https:'].includes(u.protocol)?u.toString():''}catch(_){return ''}};

function paragraphs(text){
 const safe=escapeHtml(String(text||'').trim());
 if(!safe)return '';
 return safe.split(/\n{2,}/).map(p=>`<p style="margin:0 0 16px;font-size:15px;line-height:1.72;color:#4f6478">${p.replace(/\n/g,'<br>')}</p>`).join('');
}

function layoutTheme(layout,brand){
 const primary=hex(brand.primary_color,'#071a4b'),accent=hex(brand.accent_color,'#1269e8');
 if(layout==='partnership') return {primary,accent,label:'PARTNERSHIP',header:`linear-gradient(135deg,${primary},${accent})`,soft:'#eef6ff'};
 if(layout==='investor') return {primary:'#0a2540',accent:'#17a673',label:'BUSINESS UPDATE',header:'linear-gradient(135deg,#0a2540,#147d64)',soft:'#effaf6'};
 if(layout==='support') return {primary:'#173653',accent:'#1769c2',label:'CUSTOMER SUPPORT',header:'linear-gradient(135deg,#173653,#1769c2)',soft:'#f2f8ff'};
 if(layout==='formal') return {primary:'#102b4a',accent:'#2f6fb4',label:'OFFICIAL CORRESPONDENCE',header:'linear-gradient(135deg,#102b4a,#244f79)',soft:'#f2f5f8'};
 return {primary,accent,label:'OPTISAVE',header:`linear-gradient(135deg,${primary},${accent})`,soft:'#eef6ff'};
}

function buildCompanyEmail({subject,title,greeting,body,layout='formal',ctaLabel,ctaUrl,brand={}}){
 const theme=layoutTheme(layout,brand),company=brand.company_name||'OptiSave Digital Solutions Ltd',rc=brand.rc_number||'9899018',support=brand.support_email||'support@myoptisave.site',website=safeHttpUrl(brand.website)||baseUrl(),tagline=brand.tagline||'Save Better. Live Better.',sender=brand.sender_name||'Adesokan Samson',senderTitle=brand.sender_title||'Director',logo=absUrl(brand.logo_url||'images/optisave-broadcast-logo.png');
 const cta=safeHttpUrl(ctaUrl)&&ctaLabel?`<div style="margin:24px 0 2px"><a href="${escapeHtml(safeHttpUrl(ctaUrl))}" style="display:inline-block;background:${theme.accent};color:#fff;text-decoration:none;padding:13px 19px;border-radius:11px;font-weight:800">${escapeHtml(ctaLabel)}</a></div>`:'';
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:${theme.soft};font-family:Arial,Helvetica,sans-serif;color:#102b4a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${theme.soft};padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 16px 44px rgba(18,55,90,.12)">
 <tr><td style="padding:24px 30px;background:${theme.header};color:#fff"><table width="100%" cellspacing="0" cellpadding="0"><tr><td width="72"><img src="${escapeHtml(logo)}" alt="OptiSave" width="60" height="60" style="display:block;border-radius:15px;object-fit:cover;border:1px solid rgba(255,255,255,.18)"></td><td><div style="font-size:26px;font-weight:900;letter-spacing:-.02em">OptiSave</div><div style="font-size:12px;opacity:.84;margin-top:3px">${escapeHtml(tagline)}</div></td><td align="right" style="font-size:10px;font-weight:800;letter-spacing:.06em;opacity:.86">${escapeHtml(theme.label)}</td></tr></table></td></tr>
 <tr><td style="padding:34px 32px 26px"><div style="font-size:12px;color:${theme.accent};font-weight:900;letter-spacing:.07em;text-transform:uppercase;margin-bottom:12px">${escapeHtml(company)}</div><h1 style="font-size:25px;line-height:1.25;margin:0 0 22px;color:${theme.primary}">${escapeHtml(title||subject)}</h1>${greeting?`<p style="margin:0 0 18px;font-size:15px;color:#4f6478">${escapeHtml(greeting)}</p>`:''}${paragraphs(body)}${cta}<div style="margin-top:30px;padding-top:20px;border-top:1px solid #e7eef4;color:#4f6478;font-size:14px;line-height:1.6"><strong style="color:${theme.primary}">${escapeHtml(sender)}</strong><br>${escapeHtml(senderTitle)}<br>${escapeHtml(company)}</div></td></tr>
 <tr><td style="padding:19px 28px;background:#f8fbfd;border-top:1px solid #e7eef4;text-align:center;color:#73879a;font-size:11px;line-height:1.7"><strong style="color:${theme.primary}">${escapeHtml(company)}</strong> · RC ${escapeHtml(rc)}<br><a href="${escapeHtml(website)}" style="color:${theme.accent};text-decoration:none">${escapeHtml(website.replace(/^https?:\/\//,''))}</a> · <a href="mailto:${escapeHtml(support)}" style="color:${theme.accent};text-decoration:none">${escapeHtml(support)}</a><br><span style="font-size:10px">Official business correspondence from OptiSave.</span></td></tr>
 </table></td></tr></table></body></html>`;
}

async function sendCompanyEmail({to,cc,bcc,subject,html,attachments}){
 return broadcastEmail.sendEmail(to,subject,html,{cc,bcc,attachments});
}

module.exports={buildCompanyEmail,sendCompanyEmail,safeHttpUrl,baseUrl};
