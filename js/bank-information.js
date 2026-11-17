document.addEventListener("DOMContentLoaded",async()=>{
 let savedBank=null;
 const $=id=>document.getElementById(id);let resolved="",resolvedNumber="",timer=null,banks=[];
 function toast(s){const t=$("toast");t.textContent=s;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
 async function loadBanks(){
   try{
     const data=await OptiSaveAPI.banks();banks=data.banks||[];
     $("bankName").innerHTML='<option value="">Select bank</option><option value="007" data-name="Paystack Test Bank">Paystack Test Bank — Code 007 (Test Mode)</option>'+banks.filter(b=>String(b.code)!=="007").map(b=>`<option value="${b.code}" data-name="${String(b.name).replace(/"/g,"&quot;")}">${b.name}</option>`).join("");
   }catch(e){$("resolvedName").textContent=e.message||"Bank provider unavailable";$("resolveStatus").textContent="Configure PAYSTACK_SECRET_KEY on the backend.";}
 }
 async function loadSaved(){
   try{const {bankAccount:b}=await OptiSaveAPI.bankAccount();if(!b)return;savedBank=b;
     $("bankView").hidden=false;$("bankForm").hidden=true;$("savedBankName").textContent=b.bank_name;$("savedAccountName").textContent=b.account_name;$("savedAccountNumber").textContent="••••••"+b.account_number_last4;$("bankViewStatus").textContent=b.is_verified?(b.withdrawal_ready?"Verified • Ready for withdrawal":"Verified • Recipient setup required"):"Verification in progress";
     if(b.is_verified&&!b.withdrawal_ready){$("recipientSetup").hidden=false;$("editBank").hidden=true;}
   }catch(e){console.error(e)}
 }
 async function resolveAccount(){
   const code=$("bankName").value,n=$("accountNumber").value.replace(/\D/g,"");$("accountNumber").value=n;resolved="";resolvedNumber="";$("saveBank").disabled=true;
   if(!code||n.length!==10){$("resolvedName").textContent="Enter your bank and 10-digit account number";$("resolveStatus").textContent="The name will appear automatically after verification.";return;}
   $("resolvedName").textContent="Checking account…";$("resolveStatus").textContent="Resolving securely through the backend";
   try{const data=await OptiSaveAPI.resolveBank(code,n);resolved=String(data.accountName||"").trim();resolvedNumber=n;if(!resolved)throw Error("Account name was not returned");$("resolvedName").textContent=resolved;$("resolveStatus").textContent="Account name verified";$("saveBank").disabled=false;}
   catch(e){$("resolvedName").textContent="Unable to verify this account";$("resolveStatus").textContent=e.message||"Check the bank/account number and try again.";}
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(resolveAccount,500)}
 $("bankName").onchange=schedule;$("accountNumber").oninput=schedule;
 $("editBank").onclick=()=>{$("bankView").hidden=true;$("bankForm").hidden=false;$("cancelBank").hidden=false;};
 $("cancelBank").onclick=()=>location.reload();
 $("recipientAccountNumber").oninput=()=>{$("recipientAccountNumber").value=$("recipientAccountNumber").value.replace(/\D/g,"").slice(0,10)};
 $("prepareRecipient").onclick=async()=>{const n=$("recipientAccountNumber").value.replace(/\D/g,"");if(n.length!==10)return alert("Enter the same 10-digit account number used during KYC.");const btn=$("prepareRecipient");btn.disabled=true;btn.textContent="Preparing…";try{const pin=prompt("Enter your 4-digit transaction PIN:");if(!pin)throw Error("Transaction PIN is required");await OptiSaveAPI.prepareBankRecipient({accountNumber:n,pin});toast("Withdrawal account is ready");setTimeout(()=>location.reload(),700)}catch(err){alert(err.message||"Unable to prepare withdrawal account");btn.disabled=false;btn.textContent="Complete Withdrawal Setup";}};
 $("bankForm").onsubmit=async e=>{e.preventDefault();if(!resolved||resolvedNumber!==$("accountNumber").value)return alert("Resolve the account again before saving.");const opt=$("bankName").selectedOptions[0];const btn=$("saveBank");btn.disabled=true;try{const pin=prompt("Enter your 4-digit transaction PIN to change bank information:");if(!pin)throw Error("Transaction PIN is required");await OptiSaveAPI.saveBankAccount({bankName:opt.dataset.name||opt.textContent,bankCode:$("bankName").value,accountNumber:resolvedNumber,accountName:resolved,pin});toast("Verified bank information saved to PostgreSQL");setTimeout(()=>location.reload(),600)}catch(err){alert(err.message||"Unable to save bank account");btn.disabled=false;}};
 await loadBanks();await loadSaved();
});