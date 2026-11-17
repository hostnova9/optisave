(async function(){
 const form=document.getElementById("adminLoginForm"),pass=document.getElementById("adminPassword"),error=document.getElementById("adminLoginError");
 document.getElementById("togglePassword").onclick=()=>pass.type=pass.type==="password"?"text":"password";
 if(OptiSaveAdminAPI.token()){try{await OptiSaveAdminAPI.me();return location.replace("admin.html")}catch(e){}}
 form.addEventListener("submit",async e=>{e.preventDefault();error.hidden=true;const btn=form.querySelector('button[type="submit"]');btn.disabled=true;try{await OptiSaveAdminAPI.login(document.getElementById("adminEmail").value.trim(),pass.value);location.replace("admin.html")}catch(err){error.hidden=false;error.textContent=err.message}finally{btn.disabled=false}});
})();