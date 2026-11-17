/*==================================
    OPTISAVE NAVIGATION
==================================*/

function goBack() {

    if (window.history.length > 1) {

        window.history.back();

    } else {

        window.location.href = "dashboard.html";

    }

}

function goDashboard() {

    window.location.href = "dashboard.html";

}

function goAvailableBalance() {

    window.location.href = "available-balance.html";

}

function goCreatePlan() {

    window.location.href = "create-plan.html";

}