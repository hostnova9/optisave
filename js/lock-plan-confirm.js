/*==================================
OPTISAVE LOCK CONFIRMATION
==================================*/

let planData = null;

/*==================================
PAGE LOAD
==================================*/

document.addEventListener("DOMContentLoaded",()=>{

    loadReview();

});

/*==================================
LOAD REVIEW
==================================*/

function loadReview(){

    planData = JSON.parse(
        sessionStorage.getItem("lockPlanReview")
    );

    if(!planData){

        window.location.href="lock-plan.html";

        return;

    }

    const wallet = getWallet();

    document.getElementById("reviewPlanName").textContent =
        planData.planName;

    document.getElementById("reviewPurpose").textContent =
        planData.purpose;

    document.getElementById("reviewAmount").textContent =
        "₦"+Number(planData.amount).toLocaleString();

    document.getElementById("reviewDuration").textContent =
        planData.duration+" Days";

    document.getElementById("reviewMaturity").textContent =
        new Date(planData.maturityDate)
        .toLocaleDateString();

    document.getElementById("walletBefore").textContent =
        "₦"+wallet.balance.toLocaleString();

    document.getElementById("walletLock").textContent =
        "₦"+Number(planData.amount).toLocaleString();

    document.getElementById("walletAfter").textContent =
        "₦"+(wallet.balance-planData.amount).toLocaleString();

}

/*==================================
CONFIRM PLAN
==================================*/

document
.getElementById("confirmLockPlan")
.addEventListener("click",confirmLockPlan);

async function confirmLockPlan(){
    const btn=document.getElementById("confirmLockPlan"); btn.disabled=true;
    try{
      await OptiSaveAPI.createPlan({type:"lock",planName:planData.planName,purpose:planData.purpose,amount:Number(planData.amount),duration:Number(planData.duration),startMode:"now",startDate:new Date().toISOString()});
      sessionStorage.removeItem("lockPlanReview");
      alert("Lock Plan Created Successfully!");
      window.location.href="active-locked-plans.html";
    }catch(e){alert(e.message||"Unable to create lock plan.");btn.disabled=false;}
}

/*==================================
BACK
==================================*/

function goBackToLockPlan(){

    history.back();

}