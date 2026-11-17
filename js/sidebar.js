/*==================================================
                OPTISAVE SIDEBAR
                Version 1.0
===================================================*/

document.addEventListener("DOMContentLoaded", () => {

    /*==========================================
                ELEMENTS
    ==========================================*/

    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("overlay");
    const menuBtn = document.getElementById("menuBtn");
    const logoutBtn = document.getElementById("logoutBtn");


    /* Personalized circular sidebar header */
    const helloEl=document.getElementById("sidebarHello");
    const clockEl=document.getElementById("sidebarDateTime");
    const lastEl=document.getElementById("sidebarLastLogin");
    const avatarEl=document.getElementById("sidebarAvatar");
    const fmtDate=d=>new Intl.DateTimeFormat(undefined,{weekday:"short",day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"}).format(d);
    function tickSidebarClock(){ if(clockEl) clockEl.textContent=fmtDate(new Date()); }
    function renderIdentity(user){
        const full=String(user?.fullName||user?.full_name||"").trim();
        const parts=full.split(/\s+/).filter(Boolean),first=parts[0]||"there";
        if(helloEl) helloEl.textContent=`Hello, ${first} 👋`;
        if(avatarEl) avatarEl.textContent=(parts.length>1?(parts[0][0]+parts[parts.length-1][0]):first.slice(0,2)).toUpperCase();
        const previous=user?.previousLoginAt||user?.previous_login_at;
        if(lastEl) lastEl.textContent=previous?`Last login: ${fmtDate(new Date(previous))}`:"Last login: First sign in";
    }
    tickSidebarClock();
    if(clockEl) setInterval(tickSidebarClock,30000);
    const cached=window.OptiSaveAPI?.currentUser?.(); if(cached) renderIdentity(cached);
    if((helloEl||lastEl)&&window.OptiSaveAPI){
        window.OptiSaveAPI.me().then(({user})=>renderIdentity(user)).catch(async()=>{
            try{const r=await window.OptiSaveAPI.profile();renderIdentity(r.profile)}catch(_){}
        });
    }

    /*==========================================
                OPEN SIDEBAR
    ==========================================*/

    function openSidebar(){

        sidebar.classList.add("active");
        overlay.classList.add("active");

        document.body.style.overflow = "hidden";

    }

    /*==========================================
                CLOSE SIDEBAR
    ==========================================*/

    function closeSidebar(){

        sidebar.classList.remove("active");
        overlay.classList.remove("active");

        document.body.style.overflow = "auto";

    }

    /*==========================================
                MENU BUTTON
    ==========================================*/

    if(menuBtn){

        menuBtn.addEventListener("click", openSidebar);

    }

    /*==========================================
                CLICK OVERLAY
    ==========================================*/

    if(overlay){

        overlay.addEventListener("click", closeSidebar);

    }

    /*==========================================
                ESC KEY
    ==========================================*/

    document.addEventListener("keydown", function(e){

        if(e.key === "Escape"){

            closeSidebar();

        }

    });

    /*==========================================
                SWIPE CLOSE (Mobile Ready)
    ==========================================*/

    let startX = 0;

    sidebar.addEventListener("touchstart", function(e){

        startX = e.touches[0].clientX;

    });

    sidebar.addEventListener("touchmove", function(e){

        let moveX = e.touches[0].clientX;

        if(startX - moveX > 80){

            closeSidebar();

        }

    });

    /*==========================================
                ACTIVE MENU
    ==========================================*/

    const currentPage = window.location.pathname.split("/").pop();

    const links = document.querySelectorAll(".sidebar-menu a");

    links.forEach(link => {

        const href = link.getAttribute("href");

        if(href === currentPage){

            link.classList.add("active");

        }

    });

    /*==========================================
                LOGOUT
    ==========================================*/

    if(logoutBtn){

        logoutBtn.addEventListener("click", function(){

            const answer = confirm(
                "Are you sure you want to logout?"
            );

            if(answer){

                if(window.OptiSaveAPI){ window.OptiSaveAPI.logout(); return; }
                window.location.href = "index.html";

            }

        });

    }

});