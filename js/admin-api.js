/* OptiSave v1.69 Admin API - bounded requests so the mailer can never spin forever */
(()=>{
 const K="optisave_admin_token";
 async function request(path,o={}){
  const timeoutMs=Number(o.timeoutMs||20000),opts={...o};delete opts.timeoutMs;
  const h={"Content-Type":"application/json",...(opts.headers||{})},token=sessionStorage.getItem(K);if(token)h.Authorization="Bearer "+token;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  let r;
  try{r=await fetch(path,{...opts,headers:h,signal:controller.signal})}
  catch(e){if(e?.name==='AbortError')throw Error(`Request timed out after ${Math.round(timeoutMs/1000)} seconds. Do not resend yet; check Sent Company Mail or Render logs first.`);throw e}
  finally{clearTimeout(timer)}
  const d=await r.json().catch(()=>({}));
  if(!r.ok){if(r.status===401&&path!=="/api/admin/login")sessionStorage.removeItem(K);throw Error(d.error||"Admin request failed")}
  return d;
 }
 window.OptiSaveAdminAPI={
  token:()=>sessionStorage.getItem(K),
  login:async(email,password)=>{const d=await request("/api/admin/login",{method:"POST",body:JSON.stringify({email,password})});sessionStorage.setItem(K,d.token);return d},
  me:()=>request("/api/admin/me"),
  staff:()=>request('/api/admin/staff'),
  createStaff:payload=>request('/api/admin/staff',{method:'POST',body:JSON.stringify(payload)}),
  updateStaff:(id,status)=>request('/api/admin/staff/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({status})}),
  resetStaffPassword:id=>request('/api/admin/staff/'+encodeURIComponent(id)+'/reset-password',{method:'POST'}),
  customerDirectory:q=>request('/api/admin/staff/customers?q='+encodeURIComponent(q||'')),
  changePassword:(currentPassword,newPassword)=>request('/api/admin/change-password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})}),overview:()=>request("/api/admin/overview",{timeoutMs:30000}),reviewKyc:(id,action,reason)=>request("/api/admin/kyc/"+encodeURIComponent(id)+"/review",{method:"POST",body:JSON.stringify({action,reason})}),
  broadcastConfig:()=>request("/api/admin/broadcast/config"),broadcastUsers:(search="")=>request("/api/admin/broadcast/users?search="+encodeURIComponent(search)),broadcastPreview:(audienceType,selectedUserIds=[])=>request("/api/admin/broadcast/preview",{method:"POST",body:JSON.stringify({audienceType,selectedUserIds})}),broadcastHistory:()=>request("/api/admin/broadcast/history"),sendBroadcast:(payload)=>request("/api/admin/broadcast/send",{method:"POST",body:JSON.stringify(payload),timeoutMs:30000}),
  mailerConfig:()=>request("/api/admin/mailer/config"),mailerHistory:()=>request("/api/admin/mailer/history"),
  sendCompanyMail:(payload)=>request("/api/admin/mailer/send",{method:"POST",body:JSON.stringify(payload),timeoutMs:32000}),
  sendCompanyMailTest:(payload)=>request("/api/admin/mailer/test",{method:"POST",body:JSON.stringify(payload),timeoutMs:32000}),
  mailerContacts:()=>request("/api/admin/mailer/contacts"),saveMailerContact:(payload)=>request("/api/admin/mailer/contacts",{method:"POST",body:JSON.stringify(payload)}),updateMailerContact:(id,payload)=>request("/api/admin/mailer/contacts/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify(payload)}),saveMailerBrand:(payload)=>request("/api/admin/mailer/brand",{method:"PUT",body:JSON.stringify(payload)}),
  fincraConfig:()=>request("/api/admin/fincra/config"),fincraLogs:(limit=80)=>request("/api/admin/fincra/logs?limit="+encodeURIComponent(limit)),fincraRun:(action,payload={})=>request("/api/admin/fincra/run/"+encodeURIComponent(action),{method:"POST",body:JSON.stringify(payload),timeoutMs:45000}),
  resetUser:(id)=>request("/api/admin/dev/reset-user/"+encodeURIComponent(id),{method:"POST",body:JSON.stringify({confirm:"RESET"})}),logout:()=>{sessionStorage.removeItem(K);location.replace("admin-login.html")}
 };
})();
