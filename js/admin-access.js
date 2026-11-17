/* v1.72 Staff management and role-based navigation (server also enforces permissions). */
(()=>{
 const api=window.OptiSaveAdminAPI;
 const byId=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const roleSections={
  super_admin:['overview','users','kyc','plans','transactions','deposits','withdrawals','bankLab','broadcast','companyMailer','notifications','testing','teamAccess','customerDirectory','accountSettings'],
  support_agent:['customerDirectory','companyMailer','accountSettings'],
  personal_assistant:['companyMailer','accountSettings']
 };
 const show=(id,msg,isError=false)=>{const el=byId(id);if(!el)return;el.hidden=false;el.classList.toggle('error',isError);el.textContent=msg;};
 const tellOnce=(id,prefix,password)=>{
  const el=byId(id);el.hidden=false;el.classList.remove('error');el.replaceChildren();
  const top=document.createElement('strong');top.textContent=prefix;
  const paragraph=document.createElement('p');paragraph.textContent='Temporary password (shown once):';
  const code=document.createElement('code');code.textContent=password;code.style.cssText='display:block;overflow-wrap:anywhere;user-select:all;margin:8px 0;font-weight:800';
  const help=document.createElement('small');help.textContent='Copy privately now. The employee must change it after signing in. This panel will disappear on refresh.';
  el.append(top,paragraph,code,help);
 };
 const staffForm=byId('createStaffForm'),pwForm=byId('changeAdminPassword');
 async function loadStaff(){
  try{
   const d=await api.staff(),a=d.staff||[];
   byId('staffTable').innerHTML=a.length?`<table class="admin-table"><thead><tr><th>Name</th><th>Work email</th><th>Role</th><th>Status</th><th>Last login</th><th>Manage</th></tr></thead><tbody>${a.map(x=>`<tr><td>${esc(x.full_name)}</td><td>${esc(x.email)}</td><td>${x.role==='support_agent'?'Customer Care':'Personal Assistant'}</td><td>${esc(x.status)}</td><td>${x.last_login_at?new Date(x.last_login_at).toLocaleString():'—'}</td><td><div class="team-actions"><button class="secondary-admin-btn" data-staff-id="${esc(x.id)}" data-staff-action="${x.status==='active'?'disabled':'active'}">${x.status==='active'?'Disable':'Enable'}</button><button class="secondary-admin-btn" data-staff-id="${esc(x.id)}" data-staff-action="reset">Reset Login</button></div></td></tr>`).join('')}</tbody></table>`:'<div class="empty-admin">No sub-administrators yet.</div>';
   byId('staffTable').querySelectorAll('[data-staff-action]').forEach(btn=>btn.addEventListener('click',async()=>{
    const id=btn.dataset.staffId,action=btn.dataset.staffAction;
    const msg=action==='reset'?'Generate a new temporary password and log this employee out?':`Are you sure you want to ${action==='active'?'enable':'disable'} this employee?`;
    if(!confirm(msg))return;
    btn.disabled=true;
    try{
      if(action==='reset'){const d=await api.resetStaffPassword(id);tellOnce('teamFeedback','New temporary login created for '+d.staff.email,d.temporaryPassword)}
      else{await api.updateStaff(id,action);show('teamFeedback','Staff access updated; existing login sessions are revoked.');}
      await loadStaff();
    }catch(e){show('teamFeedback',e.message,true)}finally{btn.disabled=false}
   }));
  }catch(e){byId('staffTable').textContent='Unable to load the team: '+e.message;}
 }
 staffForm?.addEventListener('submit',async e=>{
  e.preventDefault();const btn=staffForm.querySelector('button[type=submit]');btn.disabled=true;
  try{const data=Object.fromEntries(new FormData(staffForm));const result=await api.createStaff(data);tellOnce('teamFeedback','Staff account generated for '+result.staff.email,result.temporaryPassword);staffForm.reset();await loadStaff()}
  catch(err){show('teamFeedback',err.message,true)}finally{btn.disabled=false}
 });
 byId('refreshStaff')?.addEventListener('click',loadStaff);
 pwForm?.addEventListener('submit',async e=>{
  e.preventDefault();const data=Object.fromEntries(new FormData(pwForm));
  if(data.newPassword!==data.confirmPassword)return show('passwordFeedback','The new passwords do not match.',true);
  try{await api.changePassword(data.currentPassword,data.newPassword);show('passwordFeedback','Password changed. Sign in again.');setTimeout(()=>api.logout(),900)}
  catch(err){show('passwordFeedback',err.message,true)}
 });
 function menuFor(role,{initialPassword=false}={}){
  const allowed=new Set(roleSections[role]||[]);
  document.querySelectorAll('.admin-sidebar nav a[href^="#"]').forEach(link=>{
   const id=link.getAttribute('href').slice(1);link.hidden=!allowed.has(id);
  });
  document.querySelectorAll('main .admin-section').forEach(section=>section.hidden=!allowed.has(section.id));
  document.querySelectorAll('.admin-nav-label').forEach(label=>{
   let next=label.nextElementSibling,any=false;
   while(next&&!next.classList.contains('admin-nav-label')){if(next.matches('a')&&!next.hidden)any=true;next=next.nextElementSibling;}
   label.hidden=!any;
  });
  if(role!=='super_admin')byId('saveMailerBrand')?.closest('.brand-settings-panel')?.setAttribute('hidden','');
  const badge=document.querySelector('.admin-badge');if(badge)badge.textContent=role==='super_admin'?'Owner / Testing':role==='support_agent'?'Customer Care':'Personal Assistant';
  byId('adminLogout')?.addEventListener('click',()=>api.logout());
  if(!initialPassword&&role==='super_admin')loadStaff();
  if(!initialPassword&&role==='support_agent')loadCustomers('');
  return allowed;
 }
 let timer;
 async function loadCustomers(q){
  try{
   const data=await api.customerDirectory(q),rows=data.customers||[];
   byId('supportCustomers').innerHTML=rows.length?`<table class="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Registered</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${esc(c.full_name)}</td><td>${esc(c.email)}</td><td>${esc(c.phone||'—')}</td><td>${esc(c.status)}</td><td>${c.created_at?new Date(c.created_at).toLocaleDateString():'—'}</td></tr>`).join('')}</tbody></table>`:'<div class="empty-admin">No matching customers.</div>';
  }catch(e){byId('supportCustomers').textContent=e.message}
 }
 byId('supportCustomerSearch')?.addEventListener('input',e=>{clearTimeout(timer);timer=setTimeout(()=>loadCustomers(e.target.value.trim()),280)});
 window.adminReady=api.me().then(d=>{
  const role=d.admin?.role||'';
  const allowed=menuFor(role,{initialPassword:!!d.admin?.must_change_password});
  window.OptiSaveAdminRole=role;
  window.dispatchEvent(new CustomEvent('optisave-admin-ready',{detail:{role,allowed}}));
  if(d.admin?.must_change_password){
   document.querySelectorAll('.admin-sidebar nav a[href^="#"]').forEach(el=>el.hidden=el.getAttribute('href')!=='#accountSettings');
   document.querySelectorAll('main .admin-section').forEach(el=>el.hidden=el.id!=='accountSettings');
   window.dispatchEvent(new CustomEvent('optisave-force-password'));
   alert('For security, change your temporary password before using OptiSave.');
   return {role,allowed:new Set(['accountSettings']),initialPassword:true};
  }
  return {role,allowed,initialPassword:false};
 }).catch(()=>{location.replace('admin-login.html');return {role:'',allowed:new Set()}});
})();
