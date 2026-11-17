# OptiSave Backend v1.3 — Unified PostgreSQL State

This build removes the split-brain behavior where Wallet could show a PostgreSQL balance while Dashboard/Available Balance/plan pages still showed stale browser data.

## Architecture
- PostgreSQL is the persistent account store.
- On every authenticated page load, `storage.js` hydrates its compatibility cache from `/api/state`.
- Existing synchronous UI controllers read that hydrated cache.
- Wallet and plan mutations are queued back to authenticated PostgreSQL endpoints.
- Transactions and notifications are mirrored to PostgreSQL.
- All state endpoints are scoped to the authenticated user ID from the JWT.

The localStorage values now act as a compatibility cache, not the durable account record.

## Money-flow corrections included
- Lock & Allocation maturity returns BOTH remaining locked principal and any allocation that was never released.
- Emergency withdrawal no longer destroys unreleased allocation; releases stop, but unreleased allocation remains until maturity.
- Removed the duplicate Emergency Withdrawal ledger entry caused by `creditWallet()` plus a second transaction.
- Available Balance recognizes database-normalized active statuses.

## Development test order
1. Start server and log in via localhost.
2. Deposit development money.
3. Verify Dashboard, Available Balance and Wallet show the same amount.
4. Create Lock Only and verify one deduction.
5. Create Lock & Allocation and verify one deduction only.
6. Create Daily Saving and verify its contribution.
7. Refresh and log out/in between steps: values must return from PostgreSQL.
8. Check Transaction History after every step.

## Still intentionally not production-ready
The 5 AM scheduler still executes through the compatibility savings engine when the application is active. A dedicated server worker is the next migration. Real payment-provider deposit/withdrawal is also not enabled yet.
