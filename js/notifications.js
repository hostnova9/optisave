document.addEventListener("DOMContentLoaded",async()=>{
 const $=id=>document.getElementById(id);let items=[];
 async function load(){
  try{
   const [n,s]=await Promise.all([OptiSaveAPI.notifications(),OptiSaveAPI.settings()]);items=n.notifications||[];const p=s.notificationPreferences||{};
   ["moneyAlerts","savingAlerts","reminderAlerts"].forEach(id=>{$(id).checked=p[id]!==false;$(id).onchange=savePrefs});render();
  }catch(e){$("noticeItems").innerHTML=`<div class="notice-empty"><h3>Unable to load notifications</h3><p>${e.message||""}</p></div>`}
 }
 async function savePrefs(){const p={};["moneyAlerts","savingAlerts","reminderAlerts"].forEach(x=>p[x]=$(x).checked);try{await OptiSaveAPI.saveNotificationPreferences(p)}catch(e){alert(e.message)}}
 function render(){const u=items.filter(n=>!n.is_read).length;$("noticeCount").textContent=u?`${u} unread`:"You're all caught up";$("noticeItems").innerHTML=items.length?items.map(n=>`<article class="notice-row ${n.is_read?"":"unread"} ${n.type||"info"}" data-id="${n.id}" data-url="${n.action_url||""}"><div class="notice-icon"><i class="fa-solid ${n.type==="success"?"fa-check":n.type==="warning"?"fa-triangle-exclamation":n.type==="error"?"fa-xmark":"fa-bell"}"></i></div><div><h3>${n.title}</h3><p>${n.message}</p><small>${n.created_at?new Date(n.created_at).toLocaleString():"Just now"}</small></div><span class="dot"></span></article>`).join(""):`<div class="notice-empty"><i class="fa-regular fa-bell"></i><h3>No notifications yet</h3><p>Your OptiSave activity will appear here.</p></div>`;document.querySelectorAll(".notice-row").forEach(x=>x.onclick=async()=>{await OptiSaveAPI.markNotificationRead(x.dataset.id);if(x.dataset.url)location.href=x.dataset.url;else load()})}
 $("markRead").onclick=async()=>{await OptiSaveAPI.markAllNotificationsRead();await load()};await load();
});