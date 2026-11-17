/* v1.72: permission-aware section switching + independently scrolling sidebar */
(()=>{
 const sidebar=document.getElementById('adminSidebar');
 const topTitle=document.querySelector('.admin-topbar h1'),topSub=document.querySelector('.admin-topbar p');
 const sections=[...document.querySelectorAll('.admin-section')];
 const links=[...document.querySelectorAll('.admin-sidebar nav a[href^="#"]')];
 let allowed=new Set();
 function openSection(id,{updateHash=false}={}){
  if(!allowed.has(id))id=allowed.has('overview')?'overview':allowed.has('customerDirectory')?'customerDirectory':allowed.has('companyMailer')?'companyMailer':'accountSettings';
  sections.forEach(s=>s.classList.toggle('active-section',s.id===id&&allowed.has(id)));
  links.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+id));
  const sec=document.getElementById(id),h=sec?.querySelector('.section-heading h2'),p=sec?.querySelector('.section-heading p');
  if(topTitle)topTitle.textContent=h?.textContent||'Admin Dashboard';
  if(topSub)topSub.textContent=p?.textContent||'OptiSave management console';
  sidebar?.classList.remove('open');window.scrollTo({top:0,behavior:'instant'});
  if(updateHash&&location.hash!=='#'+id)history.pushState(null,'','#'+id);
 }
 links.forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const id=a.getAttribute('href').slice(1);if(allowed.has(id))openSection(id,{updateHash:true})}));
 window.addEventListener('popstate',()=>openSection((location.hash||'#overview').slice(1)));
 window.addEventListener('hashchange',()=>openSection((location.hash||'#overview').slice(1)));
 Promise.resolve(window.adminReady).then(data=>{allowed=data.allowed;openSection((location.hash||'#overview').slice(1))});
 window.addEventListener('optisave-force-password',()=>{allowed=new Set(['accountSettings']);openSection('accountSettings')});
})();
