# OptiSave Backend v1.6 — PostgreSQL Admin Authentication

Admin authentication is now server-side:
- `admins` PostgreSQL table
- bcrypt password hashes
- dedicated admin JWT with `scope=admin`
- protected `/api/admin/*` routes
- admin overview reads all users/plans/transactions/notifications from PostgreSQL
- development reset acts on the selected user and requires authenticated admin access
- hard-coded `admin@optisave.local / OptiSaveAdmin123!` login was removed.

## First setup
Add your own values to `.env`:
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
ADMIN_NAME=...
ADMIN_JWT_EXPIRES_IN=8h

Use a unique password of at least 10 characters. Do not send it to anyone and do not commit `.env`.

Run:
npm run db:init
npm start

`db:init` creates/updates the admin row and stores only a bcrypt hash of the password.

Admin login:
http://localhost:30006/admin-login.html

## Development reset
Select a user in the Users section before using Reset Test Data. Reset clears that user's wallet test totals, plans, transactions and notifications. It does not delete the user account.
