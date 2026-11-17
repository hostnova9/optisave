document.addEventListener("DOMContentLoaded",async()=>{
 const $=id=>document.getElementById(id),bind=(id,url)=>{const e=$(id);if(e)e.onclick=()=>location.href=url};
 bind("personalInfo","personal-information.html");bind("bankInfo","bank-information.html");bind("kycVerification","kyc.html");bind("security","security.html");bind("notifications","notifications.html");bind("helpSupport","help-support.html");bind("aboutApp","about-optisave.html");
 $("backBtn")?.addEventListener("click",()=>location.href="dashboard.html");
 $("logoutBtn")?.addEventListener("click",()=>{if(confirm("Are you sure you want to logout?"))OptiSaveAPI.logout()});
 try{
   const d=await OptiSaveAPI.profile(),u=d.profile||{},k=d.kyc||{};
   $("userName").textContent=u.full_name||"OptiSave User";
   $("userId").textContent="OPT-"+String(u.id||"").padStart(6,"0");

   const status=String(k.normalized_status||k.status||"not_submitted").toLowerCase();
   const menuBadge=$("kycMenuStatus");
   if(menuBadge){menuBadge.textContent=status==="verified"?"Verified":status==="verification_in_progress"?"In Progress":status==="under_review"?"Under Review":status==="action_required"?"Action Required":"Not Submitted";}
   const badge=$("kycStatus");
   badge.className="kyc-status";
   if(status==="verified"){
     badge.classList.add("verified");
     badge.innerHTML='<i class="fa-solid fa-circle-check"></i> Verified';
   }else if(status==="verification_in_progress"){
     badge.classList.add("pending");
     badge.innerHTML='<i class="fa-solid fa-hourglass-half"></i> Verification in progress';
   }else if(status==="under_review"||status==="submitted"){
     badge.classList.add("pending");
     badge.innerHTML='<i class="fa-solid fa-magnifying-glass"></i> Under Review';
   }else if(status==="action_required"){
     badge.classList.add("pending");
     badge.innerHTML='<i class="fa-solid fa-triangle-exclamation"></i> Action Required';
   }else{
     badge.classList.add("pending");
     badge.innerHTML='<i class="fa-solid fa-circle-info"></i> Not Submitted';
   }
 }catch(e){console.error(e)}
});
