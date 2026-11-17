/* ==========================================
   ELEMENTS
========================================== */

const confirmModal =
document.getElementById("confirmModal");

const confirmTitle =
document.getElementById("confirmTitle");

const confirmMessage =
document.getElementById("confirmMessage");

const confirmCancel =
document.getElementById("confirmCancel");

const confirmContinue =
document.getElementById("confirmContinue");

const backBtn = document.getElementById("backBtn");

const changePassword = document.getElementById("changePassword");
const passwordModal = document.getElementById("passwordModal");
const closePasswordModal = document.getElementById("closePasswordModal");
const updatePassword = document.getElementById("updatePassword");

const changePin = document.getElementById("changePin");
const pinModal = document.getElementById("pinModal");
const closePinModal = document.getElementById("closePinModal");
const updatePin = document.getElementById("updatePin");

const biometricToggle = document.getElementById("biometricToggle");
const twoFactorToggle = document.getElementById("twoFactorToggle");

const trustedDevices = document.getElementById("trustedDevices");
const loginActivity = document.getElementById("loginActivity");

const deleteAccountBtn = document.getElementById("deleteAccountBtn");

const toast = document.getElementById("toast");

let confirmAction = "";

/* ==========================================
   TOAST
========================================== */

function showToast(message){

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(()=>{

        toast.classList.remove("show");

    },3000);

}

let confirmCallback = null;

function openConfirmModal(title, message, callback){

    confirmTitle.textContent = title;

    confirmMessage.textContent = message;

    confirmCallback = callback;

    confirmModal.style.display = "flex";

}

confirmCancel.addEventListener("click", () => {

    confirmModal.style.display = "none";

});

confirmModal.addEventListener("click", (e) => {

    if(e.target === confirmModal){

        confirmModal.style.display = "none";

    }

});


confirmContinue.addEventListener("click", () => {

    confirmModal.style.display = "none";

    if(confirmAction){

        confirmAction();

    }

});

/* ==========================================
   BACK
========================================== */

backBtn.addEventListener("click",()=>{

    window.location.href="dashboard.html";

});


/* ==========================================
   PASSWORD MODAL
========================================== */

changePassword.addEventListener("click",()=>{

    passwordModal.style.display="flex";

});

closePasswordModal.addEventListener("click",()=>{

    passwordModal.style.display="none";

});


updatePassword.addEventListener("click",()=>{

    const current=document.getElementById("currentPassword").value.trim();

    const newPass=document.getElementById("newPassword").value.trim();

    const confirm=document.getElementById("confirmPassword").value.trim();


    if(current===""){

        alert("Enter your current password.");

        return;

    }

    if(newPass.length<8){

        alert("Password must be at least 8 characters.");

        return;

    }

    if(newPass!==confirm){

        alert("Passwords do not match.");

        return;

    }

    passwordModal.style.display="none";

    document.getElementById("currentPassword").value="";
    document.getElementById("newPassword").value="";
    document.getElementById("confirmPassword").value="";

    showToast("Password updated successfully.");

});


/* ==========================================
   PIN MODAL
========================================== */

changePin.addEventListener("click",()=>{

    pinModal.style.display="flex";

});

closePinModal.addEventListener("click",()=>{

    pinModal.style.display="none";

});


updatePin.addEventListener("click",()=>{

    const current=document.getElementById("currentPin").value.trim();

    const newPin=document.getElementById("newPin").value.trim();

    const confirm=document.getElementById("confirmPin").value.trim();


    if(current.length!==4){

        alert("Current PIN must be 4 digits.");

        return;

    }

    if(newPin.length!==4){

        alert("New PIN must be 4 digits.");

        return;

    }

    if(newPin!==confirm){

        alert("PIN does not match.");

        return;

    }

    pinModal.style.display="none";

    document.getElementById("currentPin").value="";
    document.getElementById("newPin").value="";
    document.getElementById("confirmPin").value="";

    showToast("Transaction PIN updated.");

});


/* ==========================================
   BIOMETRIC
========================================== */

biometricToggle.checked =
localStorage.getItem("biometric")==="true";


biometricToggle.addEventListener("change",()=>{

    localStorage.setItem(
        "biometric",
        biometricToggle.checked
    );

    showToast(

        biometricToggle.checked
        ? "Biometric Login Enabled"
        : "Biometric Login Disabled"

    );

});


/* ==========================================
   TWO FACTOR
========================================== */

twoFactorToggle.checked =
localStorage.getItem("twoFactor")==="true";


twoFactorToggle.addEventListener("change",()=>{

    localStorage.setItem(
        "twoFactor",
        twoFactorToggle.checked
    );

    showToast(

        twoFactorToggle.checked
        ? "Two-Factor Authentication Enabled"
        : "Two-Factor Authentication Disabled"

    );

});


/* ==========================================
   TRUSTED DEVICES
========================================== */

trustedDevices.addEventListener("click",()=>{

    window.location.href="trusted-devices.html";

});


/* ==========================================
   LOGIN ACTIVITY
========================================== */

loginActivity.addEventListener("click",()=>{

    window.location.href="login-activity.html";

});


/* ==========================================
   DELETE ACCOUNT
========================================== */

deleteAccountBtn.addEventListener("click",()=>{

    openConfirmModal(

        "Delete Account",

        "This action will permanently remove your OptiSave account. Do you want to continue?",

        () => {

            showToast("Delete Account verification coming next.");

        }

    );

});


/* ==========================================
   CLOSE MODAL WHEN CLICKING OUTSIDE
========================================== */

window.addEventListener("click",(e)=>{

    if(e.target===passwordModal){

        passwordModal.style.display="none";

    }

    if(e.target===pinModal){

        pinModal.style.display="none";

    }

});