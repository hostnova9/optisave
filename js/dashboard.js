/* =========================================================
   OPTISAVE DASHBOARD
   Rebuilt dashboard controller
   - Reads plans from storage.js
   - Shows real Lock & Allocation countdown
   - Shows real daily allocation amount
   - Shows allocation remaining/progress
   - Uses the same 5:00 AM cycle as the storage engine
   - Removes demo dashboard values
========================================================= */

(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", async function () {

        /* =====================================================
           ELEMENTS
        ===================================================== */

        const profileBtn = document.getElementById("profileBtn");
        const headerProfileAvatar = document.getElementById("headerProfileAvatar");
        const welcomeFirstName = document.getElementById("welcomeFirstName");
        const notificationBtn = document.getElementById("notificationBtn");
        const loadingScreen = document.getElementById("loadingScreen");
        const toast = document.getElementById("toast");
        const toastMessage = document.getElementById("toastMessage");

        const walletCard = document.getElementById("walletCard");
        const plansCard = document.getElementById("plansCard");
        const countdownCard = document.getElementById("countdownCard");

        const depositBtn = document.getElementById("depositBtn");
        const createPlanBtn = document.getElementById("createPlanBtn");
        const detailsBtn = document.getElementById("detailsBtn");

        const availableBalance = document.getElementById("availableBalance");
        const availableInfo = document.getElementById("availableInfo");
        const activePlans = document.getElementById("activePlans");
        const activePlansInfo = document.getElementById("activePlansInfo");

        const allocationCardTitle = document.getElementById("allocationCardTitle");
        const allocationCountdown = document.getElementById("allocationCountdown");
        const allocationDay = document.getElementById("allocationDay");
        const allocationPlanName = document.getElementById("allocationPlanName");
        const allocationLockedAmount = document.getElementById("allocationLockedAmount");
        const allocationDailyAmount = document.getElementById("allocationDailyAmount");
        const allocationRemaining = document.getElementById("allocationRemaining");
        const allocationProgressFill = document.getElementById("allocationProgressFill");
        const allocationProgressText = document.getElementById("allocationProgressText");

        const bannerTitle = document.getElementById("bannerTitle");
        const bannerMessage = document.getElementById("bannerMessage");
        const bannerAction = document.getElementById("bannerAction");

        const plansList = document.querySelector(".plans-list");


        async function renderHeaderIdentity() {
            if (!headerProfileAvatar || !window.OptiSaveAPI || typeof window.OptiSaveAPI.profile !== "function") return;
            try {
                const response = await window.OptiSaveAPI.profile();
                const profile = response && response.profile ? response.profile : {};
                const fullName = String(profile.full_name || profile.name || "OptiSave").trim();
                const parts = fullName.split(/\s+/).filter(Boolean);
                const initials = (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || "OS").slice(0, 2)).toUpperCase();
                headerProfileAvatar.textContent = initials || "OS";
                headerProfileAvatar.setAttribute("title", fullName);
                if (welcomeFirstName) welcomeFirstName.textContent = parts[0] || "Saver";
            } catch (error) {
                console.warn("Unable to load dashboard profile identity:", error);
            }
        }

        renderHeaderIdentity();

        /* =====================================================
           HELPERS
        ===================================================== */

        const DAY_MS = 24 * 60 * 60 * 1000;
        const FIVE_AM = 5;

        function money(value) {
            const amount = Number(value || 0);
            return "₦" + amount.toLocaleString("en-NG", {
                minimumFractionDigits: amount % 1 ? 2 : 0,
                maximumFractionDigits: 2
            });
        }

        function numberValue(value) {
            const n = Number(value);
            return Number.isFinite(n) ? n : 0;
        }

        function isActive(plan) {
            return String(plan.status || "").toLowerCase() === "active";
        }

        function isAllocationPlan(plan) {
            return (
                String(plan.type || "").toLowerCase() === "allocation" ||
                String(plan.planType || "").toLowerCase() === "lock & allocation"
            );
        }

        function isDailyPlan(plan) {
            return String(plan.type || "").toLowerCase() === "daily";
        }

        function getPlansSafe() {
            try {
                return typeof getPlans === "function" ? getPlans() : [];
            } catch (error) {
                console.error("Unable to read plans:", error);
                return [];
            }
        }

        function getWalletSafe() {
            try {
                return typeof getWallet === "function"
                    ? (getWallet() || {})
                    : {};
            } catch (error) {
                console.error("Unable to read wallet:", error);
                return {};
            }
        }

        function getTransactionsSafe() {
            try {
                return typeof getTransactions === "function"
                    ? (getTransactions() || [])
                    : [];
            } catch (error) {
                console.error("Unable to read transactions:", error);
                return [];
            }
        }

        function startOfDay(date) {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            return d;
        }

        function atFiveAM(date) {
            const d = new Date(date);
            d.setHours(5, 0, 0, 0);
            return d;
        }

        function nextFiveAM(fromDate) {
            const now = new Date(fromDate);
            let next = atFiveAM(now);

            if (now >= next) {
                next.setDate(next.getDate() + 1);
            }

            return next;
        }

        function isWeekend(date) {
            const day = new Date(date).getDay();
            return day === 0 || day === 6;
        }

        function nextEligibleFiveAM(fromDate, excludeWeekend) {
            let next = nextFiveAM(fromDate);

            if (!excludeWeekend) {
                return next;
            }

            while (isWeekend(next)) {
                next.setDate(next.getDate() + 1);
            }

            return next;
        }

        function formatDuration(ms) {
            if (ms <= 0) {
                return "00:00:00";
            }

            const totalSeconds = Math.floor(ms / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            return (
                String(hours).padStart(2, "0") + ":" +
                String(minutes).padStart(2, "0") + ":" +
                String(seconds).padStart(2, "0")
            );
        }

        function formatDateTime(date) {
            return new Date(date).toLocaleString("en-NG", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
            });
        }

        function dateOnly(value) {
            if (!value) return null;
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return null;
            return startOfDay(d);
        }

        /* =====================================================
           TOAST
        ===================================================== */

        function showToast(message) {
            if (!toast || !toastMessage) return;

            toastMessage.textContent = message;
            toast.classList.add("show");

            window.setTimeout(function () {
                toast.classList.remove("show");
            }, 3000);
        }

        /* =====================================================
           NAVIGATION
        ===================================================== */

        if (walletCard) {
            walletCard.addEventListener("click", function () {
                window.location.href = "available-balance.html";
            });
        }

        if (plansCard) {
            plansCard.addEventListener("click", function () {
                window.location.href = "active-locked-plans.html";
            });
        }

        if (countdownCard) {
            countdownCard.addEventListener("click", function (event) {
                if (event.target.closest("button")) return;
                const plans = getPlans() || [];
                const hasAllocation = !!getNextAllocationPlan(plans);
                const hasDaily = !!getNextDailyPlan(plans);
                if (hasAllocation) window.location.href = "allocation-center.html";
                else if (hasDaily) window.location.href = "daily-saving-center.html";
            });
        }

        if (depositBtn) {
            depositBtn.addEventListener("click", function (event) {
                event.stopPropagation();
                window.location.href = "wallet-deposit.html";
            });
        }

        if (createPlanBtn) {
            createPlanBtn.addEventListener("click", function (event) {
                event.stopPropagation();
                window.location.href = "create-plan.html";
            });
        }

        if (detailsBtn) {
            detailsBtn.addEventListener("click", function (event) {
                event.stopPropagation();
                window.location.href = "allocation-details.html";
            });
        }

        if (profileBtn) {
            profileBtn.addEventListener("click", function () {
                window.location.href = "profile.html";
            });
        }

        const notificationPanel=document.getElementById("notificationPanel");
        const notificationList=document.getElementById("notificationList");
        const notificationBadge=document.getElementById("notificationBadge");
        const notificationSubtext=document.getElementById("notificationSubtext");
        const markAllRead=document.getElementById("markAllRead");

        async function renderNotifications(){
            if(!notificationList)return;
            try{
              // Notifications already arrive with /api/state. Avoid a second
              // network request every time the dashboard renders.
              const items=typeof getNotifications==="function"?getNotifications():[];
              const unread=items.filter(n=>!n.is_read&&!n.read).length;
              if(notificationBadge){notificationBadge.hidden=!unread;notificationBadge.textContent=unread>99?"99+":unread;}
              if(notificationSubtext)notificationSubtext.textContent=unread?unread+" unread":"You're all caught up";
              const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
              const typeLabel=t=>({important:"IMPORTANT",reminder:"REMINDER",promo:"PROMO",security:"SECURITY",system:"SYSTEM",success:"UPDATE",warning:"IMPORTANT",info:"UPDATE"}[t]||"UPDATE");
              notificationList.innerHTML=items.length?items.slice(0,15).map(n=>{const branded=!!n.broadcast_id||n.brand_style==="optisave",url=n.action_url||n.actionUrl||"",action=n.action_label||"";if(branded)return `<div class="notification-item notification-broadcast ${(n.is_read||n.read)?"":"unread"} ${esc(n.type||"info")}" data-id="${esc(n.id)}" data-url="${esc(url)}"><div class="notification-brandbar"><img src="images/optisave-broadcast-logo.png" alt="OptiSave"><div><b>OptiSave</b><span>${esc(typeLabel(n.type))}</span></div></div><div class="notification-copy"><b>${esc(n.title)}</b>${n.subtitle?`<em>${esc(n.subtitle)}</em>`:""}<p>${esc(n.message)}</p><small>${(n.created_at||n.date)?new Date(n.created_at||n.date).toLocaleString():"Just now"}</small>${action&&url?`<button class="notification-cta" type="button">${esc(action)}</button>`:""}</div></div>`;return `<div class="notification-item ${(n.is_read||n.read)?"":"unread"} ${esc(n.type||"info")}" data-id="${esc(n.id)}" data-url="${esc(url)}"><div class="notification-dot"><i class="fas ${n.type==="warning"?"fa-triangle-exclamation":n.type==="success"?"fa-check":n.type==="error"?"fa-xmark":"fa-bell"}"></i></div><div class="notification-copy"><b>${esc(n.title)}</b><p>${esc(n.message)}</p><small>${(n.created_at||n.date)?new Date(n.created_at||n.date).toLocaleString():"Just now"}</small></div></div>`}).join(""):'<div class="notification-empty">No notifications yet.</div>';
              notificationList.querySelectorAll(".notification-item").forEach(el=>el.onclick=async()=>{await OptiSaveAPI.markNotificationRead(el.dataset.id);await refreshOptiSaveState();if(el.dataset.url)location.href=el.dataset.url;else renderNotifications();});
            }catch(e){notificationList.innerHTML='<div class="notification-empty">Unable to load notifications.</div>'}
        }
        if(notificationBtn)notificationBtn.addEventListener("click",()=>{notificationPanel.hidden=!notificationPanel.hidden;renderNotifications();});
        if(markAllRead)markAllRead.addEventListener("click",async()=>{await OptiSaveAPI.markAllNotificationsRead();await refreshOptiSaveState();renderNotifications();});

        /* =====================================================
           LOADING
        ===================================================== */

        window.addEventListener("load", function () {
            window.setTimeout(function () {
                if (!loadingScreen) return;

                loadingScreen.style.opacity = "0";

                window.setTimeout(function () {
                    loadingScreen.style.display = "none";
                }, 300);
            }, 300);
        });

        /* =====================================================
           DASHBOARD SUMMARY
        ===================================================== */

        function updateWalletCard() {
            const wallet = getWalletSafe();
            const balance = numberValue(wallet.balance);

            if (availableBalance) {
                availableBalance.textContent = money(balance);
            }

            if (availableInfo) {
                availableInfo.textContent = balance > 0
                    ? "Available to withdraw."
                    : "Deposit funds or wait for your next allocation.";
            }
        }

        function updateActivePlansCard(plans) {
            const active = plans.filter(isActive);
            const allocationCount = active.filter(isAllocationPlan).length;
            const dailyCount = active.filter(isDailyPlan).length;
            const lockCount = active.filter(function (plan) {
                return !isAllocationPlan(plan) && !isDailyPlan(plan);
            }).length;

            if (activePlans) {
                activePlans.textContent = String(active.length);
            }

            if (activePlansInfo) {
                activePlansInfo.textContent =
                    lockCount + " Locked • " +
                    dailyCount + " Daily • " +
                    allocationCount + " Allocation";
            }
        }

        /* =====================================================
           ALLOCATION PERIOD CALCULATIONS
        ===================================================== */

        function getAllocationPool(plan) {
            return numberValue(
                plan.allocationAmount ||
                plan.allocatedAmount ||
                (
                    numberValue(plan.totalAmount || plan.amount) *
                    numberValue(plan.allocationPercent) / 100
                )
            );
        }

        function getLockedAmount(plan) {
            return numberValue(
                plan.remainingLocked ||
                plan.lockedAmount ||
                (
                    numberValue(plan.totalAmount || plan.amount) -
                    getAllocationPool(plan)
                )
            );
        }

        function getAllocationPeriodDays(plan) {
            return Math.max(
                1,
                Math.floor(
                    numberValue(
                        plan.allocationDays ||
                        plan.allocationDuration ||
                        plan.duration ||
                        1
                    )
                )
            );
        }

        function getAllocationStart(plan) {
            const raw =
                plan.allocationStartDate ||
                plan.startDate ||
                plan.createdAt;

            const d = raw ? new Date(raw) : new Date();

            if (Number.isNaN(d.getTime())) {
                return new Date();
            }

            return d;
        }

        function getAllocationEnd(plan) {
            const start = startOfDay(getAllocationStart(plan));
            const days = getAllocationPeriodDays(plan);
            const end = new Date(start);
            end.setDate(end.getDate() + days - 1);
            return end;
        }

        function countEligibleDays(startDate, periodDays, excludeWeekend) {
            let count = 0;
            const cursor = startOfDay(startDate);

            for (let i = 0; i < periodDays; i++) {
                if (!excludeWeekend || !isWeekend(cursor)) {
                    count++;
                }
                cursor.setDate(cursor.getDate() + 1);
            }

            return Math.max(1, count);
        }

        function getCalculatedDailyAllocation(plan) {
            const pool = getAllocationPool(plan);
            if (pool <= 0) return 0;

            const existing = numberValue(plan.dailyAllocation);

            // If the plan already has a daily amount, use it only when
            // the plan's period definition is unavailable.
            const days = getAllocationPeriodDays(plan);
            const eligibleDays = countEligibleDays(
                getAllocationStart(plan),
                days,
                Boolean(plan.excludeWeekend)
            );

            if (eligibleDays > 0) {
                return pool / eligibleDays;
            }

            return existing;
        }

        function getReleasedAllocation(plan) {
            const pool = getAllocationPool(plan);

            const explicit = numberValue(
                plan.allocationReleased ||
                plan.releasedAllocation ||
                plan.totalAllocatedReleased
            );

            if (explicit > 0) return Math.min(pool, explicit);

            if (plan.allocationRemaining !== undefined) {
                return Math.max(
                    0,
                    pool - numberValue(plan.allocationRemaining)
                );
            }

            return 0;
        }

        function getRemainingAllocation(plan) {
            const pool = getAllocationPool(plan);

            if (plan.allocationRemaining !== undefined) {
                return Math.max(
                    0,
                    Math.min(pool, numberValue(plan.allocationRemaining))
                );
            }

            return Math.max(0, pool - getReleasedAllocation(plan));
        }

        function getAllocationNextRelease(plan) {
            if (getRemainingAllocation(plan) <= 0) return null;

            // PostgreSQL next_event_at is the single source of truth. The dashboard
            // must not reconstruct a different time from createdAt/startAt.
            const canonical = plan.nextEventAt || plan.nextAllocationDate || null;
            if (!canonical) return null;
            const next = new Date(canonical);
            return Number.isNaN(next.getTime()) ? null : next;
        }

        /* =====================================================
           FIND NEXT REAL EVENT
           Allocation is preferred when it is the nearest event.
           Daily savings are also included in the 5 AM schedule.
        ===================================================== */

        function getNextAllocationPlan(plans) {
            const activeAllocationPlans = plans
                .filter(function (plan) {
                    return isActive(plan) &&
                        isAllocationPlan(plan) &&
                        getRemainingAllocation(plan) > 0;
                })
                .map(function (plan) {
                    return {
                        plan: plan,
                        next: getAllocationNextRelease(plan)
                    };
                })
                .filter(function (item) {
                    return item.next && !Number.isNaN(item.next.getTime());
                })
                .sort(function (a, b) {
                    return a.next - b.next;
                });

            return activeAllocationPlans.length
                ? activeAllocationPlans[0]
                : null;
        }

        function getNextDailyPlan(plans) {
            // PostgreSQL next_event_at is canonical for Daily Savings too. Do not
            // reconstruct 05:00 or add another day in the browser: doing that moved
            // an already-correct Monday event to Tuesday after its due window opened.
            return plans
                .filter(function (plan) {
                    return isActive(plan) && isDailyPlan(plan) && plan.nextDebitDate;
                })
                .map(function (plan) {
                    const date = new Date(plan.nextDebitDate);
                    return { plan: plan, next: date };
                })
                .filter(function (item) {
                    return !Number.isNaN(item.next.getTime());
                })
                .sort(function (a, b) {
                    return a.next - b.next;
                })[0] || null;
        }

        /* =====================================================
           NEXT ALLOCATION CARD
        ===================================================== */

        function resetAllocationCard(message) {
            if (!countdownCard) return;

            countdownCard.classList.add("no-allocation");
            countdownCard.classList.remove("processing");

            if (allocationCardTitle) {
                allocationCardTitle.textContent = "Next Allocation";
            }

            if (allocationCountdown) {
                allocationCountdown.textContent = "--:--:--";
            }

            if (allocationDay) {
                allocationDay.textContent = message;
            }

            if (allocationPlanName) {
                allocationPlanName.textContent = "—";
            }

            if (allocationLockedAmount) {
                allocationLockedAmount.textContent = money(0);
            }

            if (allocationDailyAmount) {
                allocationDailyAmount.textContent = money(0);
            }

            if (allocationRemaining) {
                allocationRemaining.textContent = money(0);
            }

            if (allocationProgressFill) {
                allocationProgressFill.style.width = "0%";
            }

            if (allocationProgressText) {
                allocationProgressText.textContent = "0% allocated";
            }
        }

        function updateNextAllocationCard(plans) {
            if (!countdownCard) return;

            const allocation = getNextAllocationPlan(plans);
            const daily = getNextDailyPlan(plans);

            // Lock & Allocation owns this card whenever one exists.
            if (allocation) {
                countdownCard.classList.remove("no-allocation","processing");
                const plan=allocation.plan,next=allocation.next,diff=next-new Date();

                if (allocationCardTitle) allocationCardTitle.textContent="Next Allocation";
                const scheduleLabel=document.getElementById("scheduleCountdownLabel");
                if(scheduleLabel) scheduleLabel.textContent="NEXT RELEASE IN";
                if (allocationCountdown) allocationCountdown.textContent=diff>0?formatDuration(diff):"Processing...";
                if (allocationDay) allocationDay.textContent="NEXT RELEASE • "+formatDateTime(next);
                if (diff<=0) countdownCard.classList.add("processing");
                return;
            }

            // With no allocation plan, Daily Savings uses the same space but
            // it is clearly a deduction/contribution, never an "allocation".
            if (daily) {
                countdownCard.classList.remove("no-allocation","processing");
                const diff=daily.next-new Date();
                if (allocationCardTitle) allocationCardTitle.textContent="Next Deduction";
                const scheduleLabel=document.getElementById("scheduleCountdownLabel");
                if(scheduleLabel) scheduleLabel.textContent="NEXT DEDUCTION IN";
                if (allocationCountdown) allocationCountdown.textContent=diff>0?formatDuration(diff):"Checking balance...";
                if (allocationDay) allocationDay.textContent="NEXT SAVING • "+formatDateTime(daily.next);
                return;
            }

            resetAllocationCard("No scheduled saving event");
        }

        /* =====================================================
           MY PLANS
        ===================================================== */

        function getPlanIcon(plan) {
            if (isAllocationPlan(plan)) return "💰";
            if (isDailyPlan(plan)) return "📅";
            return "🔒";
        }

        function getPlanStatusText(plan) {
            if (isAllocationPlan(plan)) {
                const remaining = getRemainingAllocation(plan);
                return remaining > 0
                    ? "Allocation Active"
                    : "Allocation Complete";
            }

            if (isDailyPlan(plan)) {
                return plan.pendingToday
                    ? "Payment Pending"
                    : "Daily Saving";
            }

            return "Locked Only";
        }

        function getPlanProgress(plan) {
            if (isAllocationPlan(plan)) {
                const pool = getAllocationPool(plan);
                const remaining = getRemainingAllocation(plan);

                return pool > 0
                    ? Math.min(
                        100,
                        Math.round((pool - remaining) / pool * 100)
                    )
                    : 0;
            }

            if (isDailyPlan(plan)) {
                const target = numberValue(plan.amount);
                const saved = numberValue(plan.savedAmount);
                return target > 0
                    ? Math.min(100, Math.round(saved / target * 100))
                    : 0;
            }

            const duration = numberValue(plan.duration);
            if (!duration) return 0;

            const start = dateOnly(plan.startDate || plan.createdAt);
            if (!start) return 0;

            const elapsed = Math.floor(
                (startOfDay(new Date()) - start) / DAY_MS
            );

            return Math.min(
                100,
                Math.max(0, Math.round(elapsed / duration * 100))
            );
        }

        function getPlanDaysLeft(plan) {
            const duration = numberValue(plan.duration);
            const start = dateOnly(plan.startDate || plan.createdAt);

            if (!duration || !start) return 0;

            const maturity = new Date(start);
            maturity.setDate(maturity.getDate() + duration);

            return Math.max(
                0,
                Math.ceil(
                    (startOfDay(maturity) - startOfDay(new Date())) / DAY_MS
                )
            );
        }

        function loadPlans(plans) {
            if (!plansList) return;

            plansList.innerHTML = "";

            const activePlansOnly = plans.filter(isActive);

            if (!activePlansOnly.length) {
                plansList.innerHTML = `
                    <div class="empty-plan">
                        <h3>No Active Plan</h3>
                        <p>Create your first savings plan.</p>
                    </div>
                `;
                return;
            }

            activePlansOnly.slice(0, 1).forEach(function (plan) {
                const progress = getPlanProgress(plan);
                const daysLeft = getPlanDaysLeft(plan);

                const total = numberValue(
                    plan.totalAmount ||
                    plan.amount ||
                    0
                );

                const statusClass = isAllocationPlan(plan)
                    ? "active"
                    : isDailyPlan(plan)
                        ? "active"
                        : "locked";

                const card = document.createElement("div");
                card.className = "plan-card";

                card.innerHTML = `
                    <div class="plan-top">
                        <div class="plan-info">
                            <div class="plan-icon">${getPlanIcon(plan)}</div>
                            <div>
                                <h3>${escapeHtml(plan.planName || "Savings Plan")}</h3>
                                <span>${money(total)} ${isAllocationPlan(plan) ? "Locked & Allocating" : "Saved"}</span>
                            </div>
                        </div>
                        <button class="plan-view" type="button">Manage →</button>
                    </div>

                    <div class="progress-area">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:${progress}%"></div>
                        </div>
                        <small>${progress}% Completed</small>
                    </div>

                    <div class="plan-bottom">
                        <div>
                            <strong>${daysLeft}</strong>
                            <span>Days Left</span>
                        </div>
                        <div>
                            <span class="status ${statusClass}">
                                ${getPlanStatusText(plan)}
                            </span>
                        </div>
                    </div>
                `;

                const button = card.querySelector(".plan-view");
                if (button) {
                    button.addEventListener("click", function () {
                        if (typeof setSelectedPlan === "function") {
                            setSelectedPlan(plan.id);
                        }
                        window.location.href =
                            "plan-details.html?id=" +
                            encodeURIComponent(plan.id);
                    });
                }

                plansList.appendChild(card);
            });
        }

        function escapeHtml(value) {
            return String(value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        /* =====================================================
           SMART BANNER
        ===================================================== */

        let bannerRotationIndex=0;
        let bannerRotationSignature="";

        function updateSmartBanner(plans) {
            if (!bannerTitle || !bannerMessage || !bannerAction) return;
            const active=plans.filter(isActive), allocation=active.find(isAllocationPlan), daily=active.find(isDailyPlan);
            const notices=typeof getNotifications==="function"?getNotifications().filter(n=>!n.read).slice(0,3):[];
            const slides=[
                {title:"💙 Save with purpose",message:"Explore a savings style that fits your goal. Start small, stay consistent and let your progress build over time.",label:"Explore Plans",url:"create-plan.html"},
                {title:"🐷 Build a Daily Savings habit",message:"Choose an amount and schedule that works for you, then keep your saving habit moving one eligible day at a time.",label:"Daily Savings",url:"daily-saving.html"},
                {title:"🔒 Give your goal some protection",message:"Lock Only helps you separate money from everyday spending until your chosen maturity date.",label:"Lock Savings",url:"create-plan.html"},
                {title:"📊 Lock & Allocate with a plan",message:"Set aside savings while scheduling controlled releases from an allocation portion based on your plan rules.",label:"Explore Allocation",url:"allocation-center.html"},
                {title:"🛡️ Keep your OptiSave account secure",message:"Never share your password, transaction PIN or one-time verification code with anyone.",label:"Security",url:"security1.html"},
                {title:"🎯 Your goal, your pace",message:"Review your active plans regularly and choose saving commitments that are realistic for your budget.",label:"View My Plans",url:"active-locked-plans.html"}
            ];

            notices.forEach(n=>slides.unshift({title:(n.type==="warning"?"⚠️ ":"🔔 ")+n.title,message:n.message,label:n.actionUrl?"View":"Got it",url:n.actionUrl||""}));
            if(daily)slides.push({title:"📅 "+(daily.planName||"Daily Savings"),message:daily.pendingToday?"Your daily saving is waiting for funds in your wallet.":"Your daily savings plan is active. The next contribution follows its saving schedule.",label:"View Daily Saving",url:"daily-saving-center.html"});
            if(allocation)slides.push({title:"💰 "+(allocation.planName||"Lock & Allocation"),message:money(getRemainingAllocation(allocation))+" remains in your allocation pool. Releases follow the plan schedule.",label:"View Allocation",url:"allocation-center.html"});
            if(active.some(p=>!isDailyPlan(p)&&!isAllocationPlan(p)))slides.push({title:"🔒 Locked savings active",message:"Your locked funds remain protected until their maturity or an eligible access action.",label:"View Plans",url:"active-locked-plans.html"});
            if(!slides.length)slides.push({title:"👋 Welcome to OptiSave!",message:"Fund your wallet and create your first savings plan when you're ready.",label:"Create Plan",url:"create-plan.html"});

            const sig=slides.map(x=>x.title+x.message).join("|");
            if(sig!==bannerRotationSignature){bannerRotationSignature=sig;bannerRotationIndex=0;}
            const slide=slides[bannerRotationIndex%slides.length];
            bannerTitle.textContent=slide.title;bannerMessage.textContent=slide.message;
            bannerAction.innerHTML=slide.label+' <i class="fas fa-arrow-right"></i>';
            bannerAction.onclick=()=>{if(slide.url)location.href=slide.url;};
            bannerAction.hidden=false;
            window.__optiBannerSlides=slides;
        }

        window.setInterval(function(){
            const slides=window.__optiBannerSlides||[];
            if(slides.length>1){bannerRotationIndex=(bannerRotationIndex+1)%slides.length;updateSmartBanner(getPlansSafe());}
        },5000);

        /* =====================================================
           MAIN REFRESH
        ===================================================== */

        function refreshDashboard() {
            const plans = getPlansSafe();

            // Give the storage engine a chance to process a due 5 AM event.
            try {
                if (typeof processMaturedPlans === "function") {
                    processMaturedPlans();
                }
                if (typeof processAllocationReleases === "function") {
                    processAllocationReleases();
                }
                if (typeof processDailySavings === "function") {
                    processDailySavings();
                }
            } catch (error) {
                console.error("OptiSave processing error:", error);
            }

            const refreshedPlans = getPlansSafe();

            updateWalletCard();
            updateActivePlansCard(refreshedPlans);
            updateNextAllocationCard(refreshedPlans);
            loadPlans(refreshedPlans);
            updateSmartBanner(refreshedPlans);
            if(typeof renderNotifications==='function') renderNotifications();
        }

        /* =====================================================
           GREETING
        ===================================================== */

        const greeting = document.getElementById("greeting");

        if (greeting) {
            const hour = new Date().getHours();

            greeting.textContent =
                hour < 12
                    ? "Good Morning ☀️"
                    : hour < 17
                        ? "Good Afternoon 🌤️"
                        : "Good Evening 🌙";
        }

        /* =====================================================
           START
        ===================================================== */

        if(typeof optisaveStateReady==='function') await optisaveStateReady();
        refreshDashboard();

        window.setInterval(function () {
            updateNextAllocationCard(getPlansSafe());
        }, 1000);

        // Keep the screen tied to PostgreSQL rather than an old browser snapshot.
        // Successful actions already refresh state immediately; this short visible-page
        // sync also picks up changes made by another tab/device without hammering the DB.
        let dashboardSyncBusy = false;
        async function syncDashboardState() {
            if (dashboardSyncBusy || document.hidden || typeof refreshOptiSaveState !== "function") return;
            dashboardSyncBusy = true;
            try {
                await refreshOptiSaveState();
                refreshDashboard();
            } finally {
                dashboardSyncBusy = false;
            }
        }
        document.addEventListener("visibilitychange", function () { if (!document.hidden) syncDashboardState(); });
        window.addEventListener("focus", syncDashboardState);
        window.addEventListener("pageshow", syncDashboardState);
        document.addEventListener("optisave:state", function () {
            // Render immediately whenever an API action commits and storage maps the new state.
            refreshDashboard();
        });
        window.setInterval(syncDashboardState, 5000);
    });
})();

/* OPTISAVE_OUTSIDE_NOTIFICATION_CLOSE */
document.addEventListener("click",(event)=>{
 const panel=document.getElementById("notificationPanel");
 const button=document.getElementById("notificationBtn")||document.getElementById("notificationBell");
 if(!panel||!button)return;
 if(!panel.contains(event.target)&&!button.contains(event.target)){
   panel.classList.remove("show","open","active");
   panel.hidden=true;
 }
});
