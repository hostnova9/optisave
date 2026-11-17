# OptiSave v1.38 — Complete Test-Flow Onboarding

- Registration includes a hashed 4-digit transaction PIN.
- Account creation sends the real email OTP and opens a dedicated `verify-email.html` page.
- Verification page supports 6-digit OTP, 60-second resend cooldown, 10-minute expiry messaging, and Inbox/Spam/Junk guidance.
- Successful account activation creates the authenticated session and opens a one-time welcome experience instead of returning to login.
- Welcome experience introduces Daily Savings, Lock Only, and Lock & Allocate before entering the dashboard.
- Dashboard smart board now rotates product education, security reminders, savings encouragement, plan-state information, and notifications every 5 seconds.
- Existing financial engine, Paystack test-mode flows, KYC, wallet, transactions, notifications, admin, and exact-once safeguards are preserved.
