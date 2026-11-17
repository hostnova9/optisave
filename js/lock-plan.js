/*==================================
OPTISAVE LOCK ONLY
==================================*/

let selectedDays = 0;

/*==================================
PAGE LOAD
==================================*/

document.addEventListener("DOMContentLoaded",async()=>{
    if(typeof optisaveStateReady==="function") await optisaveStateReady();
    if(typeof refreshOptiSaveState==="function") await refreshOptiSaveState();
    initialiseLockPlan();
});

/*==================================
INITIALISE
==================================*/

function initialiseLockPlan(){

    setupSuggestionButtons();

    setupDurationButtons();

    setupDurationSelect();

    setupInputs();

    loadWallet();

    updateSummary();

}

/*==================================
LOAD WALLET
==================================*/

function loadWallet(){

    const wallet = getWallet();

    document.getElementById("walletBalance").textContent =
        "₦" + Number(wallet.balance).toLocaleString();

}

/*==================================
PURPOSE BUTTONS
==================================*/

function setupSuggestionButtons(){

    const buttons =
        document.querySelectorAll(".suggestion-btn");

    const input =
        document.getElementById("purpose");

    buttons.forEach(button=>{

        button.addEventListener("click",()=>{

            input.value = button.textContent;

            updateSummary();

        });

    });

}

/*==================================
DURATION
==================================*/

function setupDurationButtons(){

    const buttons =
        document.querySelectorAll(".duration-btn");

    buttons.forEach(button=>{

        button.onclick=function(){

            buttons.forEach(btn=>
                btn.classList.remove("active")
            );

            this.classList.add("active");

            selectedDays =
                Number(this.dataset.days);

            document.getElementById("customDays").value="";

            updateSummary();

        };

    });

}


function setupDurationSelect(){
    const select=document.getElementById("durationSelect");
    const wrap=document.getElementById("customDurationWrap");
    const custom=document.getElementById("customDays");
    if(!select)return;
    select.addEventListener("change",()=>{
        const customMode=select.value==="custom";
        wrap.hidden=!customMode;
        document.querySelectorAll(".duration-btn").forEach(btn=>btn.classList.remove("active"));
        if(customMode){selectedDays=Number(custom.value)||0;custom.focus();}
        else {selectedDays=Number(select.value)||0;custom.value="";}
        updateSummary();
    });
}

/*==================================
INPUT EVENTS
==================================*/

function setupInputs(){

    document
    .getElementById("amount")
    .addEventListener("input",updateSummary);

    document
    .getElementById("planName")
    .addEventListener("input",updateSummary);

    document
    .getElementById("purpose")
    .addEventListener("input",updateSummary);

    document
    .getElementById("customDays")
    .addEventListener("input",function(){

        if(this.value!=""){

            selectedDays =
                Number(this.value);

            document
            .querySelectorAll(".duration-btn")
            .forEach(btn=>btn.classList.remove("active"));

        }

        const select=document.getElementById("durationSelect");
        if(select && !document.getElementById("customDurationWrap").hidden) select.value="custom";
        updateSummary();

    });

}

/*==================================
SUMMARY
==================================*/

function updateSummary(){

    const wallet =
        getWallet();

    const amount =
        Number(document.getElementById("amount").value)||0;

    const purpose =
        document.getElementById("purpose").value.trim();

    document.getElementById("summaryPurpose").textContent =
        purpose || "Not Selected";

    document.getElementById("summaryAmount").textContent =
        "₦"+amount.toLocaleString();

    document.getElementById("summaryDuration").textContent =
        selectedDays>0
        ? selectedDays+" Days"
        : "0 Days";

    if(selectedDays>0){

        const date =
            new Date();

        date.setDate(
            date.getDate()+selectedDays
        );

        document.getElementById("summaryDate").textContent =
            date.toDateString();

    }else{

        document.getElementById("summaryDate").textContent="--";

    }

    document.getElementById("balanceAfter").textContent =
        "₦"+Math.max(
            wallet.balance-amount,
            0
        ).toLocaleString();

}

/*==================================
CONTINUE
==================================*/

document
.getElementById("createLockPlan")
.addEventListener("click",continueToReview);

function continueToReview(){

    const amount =
        Number(document.getElementById("amount").value);

    const purpose =
        document.getElementById("purpose").value.trim();

    const planName =
        document.getElementById("planName").value.trim();

    if(planName===""){

        alert("Enter a plan name.");

        return;

    }

    if(purpose===""){

        alert("Select or enter a purpose.");

        return;

    }

    if(amount<=0){

        alert("Enter a valid amount.");

        return;

    }

    if(selectedDays<21){

        alert("Minimum lock duration is 21 days.");

        return;

    }

    const wallet =
        getWallet();

    if(amount>wallet.balance){

        alert("Insufficient wallet balance.");

        return;

    }

    const maturity =
        new Date();

    maturity.setDate(
        maturity.getDate()+selectedDays
    );

    sessionStorage.setItem(

        "lockPlanReview",

        JSON.stringify({

            planType:"Lock Only",

            type:"lock",

            planName,

            purpose,

            amount,

            totalAmount:amount,

            duration:selectedDays,

            maturityDate:
                maturity.toISOString(),

            status:"Active"

        })

    );

    window.location.href =
        "lock-plan-confirm.html";

}

/*==================================
BACK
==================================*/

function goBackToActivePlans(){

    window.location.href =
        "active-locked-plans.html";

}