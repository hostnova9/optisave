/*==================================
    WALLET STATS
==================================*/

document.addEventListener("DOMContentLoaded", () => {

    loadWalletStats();

});

/*==================================
    LOAD WALLET
==================================*/

function loadWalletStats(){

    const wallet = getWallet();

    document.getElementById("walletBalance").textContent =
        "₦" + Number(wallet.balance || 0).toLocaleString();

    document.getElementById("totalDeposited").textContent =
        "₦" + Number(wallet.totalDeposited || 0).toLocaleString();

    document.getElementById("totalWithdrawn").textContent =
        "₦" + Number(wallet.totalWithdrawn || 0).toLocaleString();

    document.getElementById("totalLocked").textContent =
        "₦" + Number(wallet.totalLocked || 0).toLocaleString();

    document.getElementById("totalCredited").textContent =
        "₦" + Number(wallet.totalCredited || 0).toLocaleString();

}

/*==================================
    BACK BUTTON
==================================*/

function goBackToAvailableBalance(){

    window.location.href =
        "available-balance.html";

}