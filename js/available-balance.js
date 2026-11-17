/* OptiSave Available Balance — PostgreSQL state is the only financial source. */
const money=n=>"₦"+Number(n||0).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2});
const setText=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
let availableLoadInFlight=null;
async function loadAvailableBalance(){
 if(availableLoadInFlight)return availableLoadInFlight;
 availableLoadInFlight=(async()=>{
  try{
   const d=await OptiSaveAPI.state();
   const w=d.wallet||{},plans=d.plans||[],t=d.transactions||[],summary=d.financialSummary||{};
   const available=Number(w.available_balance??w.balance??0);
   const active=plans.filter(p=>String(p.status||"").toLowerCase()==="active");
   // Every visible Available figure is assigned from this exact same value.
   const formatted=money(available);
   ["walletBalance","availableBalance","availableFunds"].forEach(id=>setText(id,formatted));
   setText("totalDeposited",money(w.total_deposited??w.totalDeposited));
   setText("totalWithdrawn",money(w.total_withdrawn??w.totalWithdrawn));
   setText("totalLocked",money(w.total_locked??w.totalLocked));
   setText("activePlans",String(summary.activePlanCount??active.length));
   const c=document.getElementById("transactionList");
   if(c)c.innerHTML=t.slice(0,5).map(x=>`<div class="transaction-item"><div class="transaction-left"><div><div class="transaction-title">${esc(x.type||"Transaction")}</div><div class="transaction-date">${new Date(x.created_at||x.createdAt).toLocaleString()}</div></div></div><strong>${String(x.direction).toLowerCase()==="credit"?"+":"-"}${money(x.amount)}</strong></div>`).join("");
  }catch(e){console.error("Available balance state:",e)}
  finally{availableLoadInFlight=null}
 })();
 return availableLoadInFlight;
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
document.addEventListener("DOMContentLoaded",loadAvailableBalance);
window.addEventListener("focus",loadAvailableBalance);
window.addEventListener("pageshow",loadAvailableBalance);
document.addEventListener("optisave:state",()=>{const w=typeof getWallet==="function"?getWallet():null;if(w)["walletBalance","availableBalance","availableFunds"].forEach(id=>setText(id,money(w.balance)));});
