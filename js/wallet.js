const money=n=>"₦"+Number(n||0).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2});
document.addEventListener("DOMContentLoaded",()=>{load();setupButtons();});
async function load(){
 try{
  const [{wallet:w},{transactions:t}]=await Promise.all([OptiSaveAPI.wallet(),OptiSaveAPI.transactions()]);
  walletBalance.textContent=money(w?.available_balance);
  totalDeposited.textContent=money(w?.total_deposited);
  totalWithdrawn.textContent=money(w?.total_withdrawn);
  totalLocked.textContent=money(w?.total_locked);
  totalDaily.textContent="—"; totalAllocated.textContent="—";
  transactionList.innerHTML="";
  const arr=(t||[]).slice(0,5); emptyTransactions.style.display=arr.length?"none":"block";
  arr.forEach(x=>transactionList.appendChild(card(x)));
 }catch(e){console.error(e);alert(e.message||"Unable to load wallet.");}
}
function card(t){
 const el=document.createElement("div");el.className="transaction-card";
 const credit=String(t.direction).toLowerCase()==="credit";
 el.innerHTML=`<div class="transaction-left"><div class="transaction-icon"><i class="fas ${credit?"fa-arrow-down":"fa-arrow-up"}"></i></div><div class="transaction-info"><h4>${esc(t.type||"Transaction")}</h4><p>${esc(t.description||"OptiSave transaction")}</p></div></div><div class="transaction-amount">${credit?"+":"-"}${money(t.amount)}</div>`;
 return el;
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function setupButtons(){
 backBtn?.addEventListener("click",()=>history.back());
 depositBtn?.addEventListener("click",()=>location.href="wallet-deposit.html");
 withdrawBtn?.addEventListener("click",()=>location.href="wallet-withdraw.html");
 historyBtn?.addEventListener("click",()=>location.href="transactions.html");
 viewAllBtn?.addEventListener("click",()=>location.href="transactions.html");
}
window.addEventListener("focus",load);