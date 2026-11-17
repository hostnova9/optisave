# OptiSave Backend v1.1 — Real Authentication

This build connects the existing registration/login UI to the PostgreSQL backend. User account pages now require a valid authenticated session. Registration creates the user, wallet, KYC profile and welcome notification in PostgreSQL.

# OptiSave Backend v1

Included: Express, PostgreSQL schema, bcrypt password hashing, JWT auth, per-user wallet, plans, transactions, notifications, bank-account and KYC records.

## Setup
1. Install Node.js 20+ and PostgreSQL.
2. Copy `.env.example` to `.env` and set DATABASE_URL and a long JWT_SECRET.
3. Run `npm install`.
4. Run `npm run db:init`.
5. Run `npm start`.
6. Open `http://localhost:3000`.

API: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me, GET /api/wallet, GET /api/plans, GET /api/plans/:id, GET /api/transactions, GET /api/notifications, GET /api/health.

Backend v1 intentionally does not yet move money or savings scheduling from localStorage. Backend v2 will add atomic server-side wallet/plan operations and the scheduler. KYC image upload and real bank resolution are not live yet.


## v1.1 test
1. Run `npm run db:init` (safe to re-run).
2. Run `npm start`.
3. Open the server URL (for example `http://localhost:30006/register.html`). Do not open the HTML file directly.
4. Create a new account, then log in.
5. Confirm dashboard opens. Log out and confirm protected pages redirect to login.

Important: wallet/plans still use the legacy browser engine in this build. Real money movement is the next migration stage.
