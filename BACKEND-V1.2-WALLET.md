# OptiSave Backend v1.2 — Database Wallet Ledger

This build moves Wallet, test Deposit, test Withdrawal and Transaction History off browser localStorage and onto the authenticated PostgreSQL wallet.

## Development switch
Add `ENABLE_DEV_WALLET=true` to `.env` while `NODE_ENV=development`.

The development deposit/withdraw endpoints are deliberately unavailable unless BOTH conditions are true. They do not process real money and must not be enabled in production.

## Test
1. `npm install`
2. `npm run db:init`
3. `npm start`
4. Login with the database-backed test user.
5. Open Wallet.
6. Use Deposit to credit a development amount.
7. Refresh/re-login: the balance persists in PostgreSQL.
8. Use Withdrawal; the backend rejects amounts above available balance.
9. Transaction History should show the same server-side ledger entries.

Plans/savings are not migrated in this build. Do not rely on the local plan engine for production money movement.
