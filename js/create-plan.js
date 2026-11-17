/*==================================
    CREATE PLAN
==================================*/

document.addEventListener("DOMContentLoaded", () => {

    initialiseCreatePlan();

});

/*==================================
    INITIALISE
==================================*/

function initialiseCreatePlan(){

    const cards = document.querySelectorAll(".plan-card");

    cards.forEach(card => {

        card.addEventListener("mouseenter", () => {

            card.style.transform = "translateY(-4px)";

        });

        card.addEventListener("mouseleave", () => {

            card.style.transform = "";

        });

        card.addEventListener("click", () => {

            const title =
                card.querySelector("h2").textContent;

            console.log(title + " selected");

        });

    });

}

/*==================================
    BACK BUTTON
==================================*/

function goBack(){

    window.location.href =
        "dashboard.html";

}