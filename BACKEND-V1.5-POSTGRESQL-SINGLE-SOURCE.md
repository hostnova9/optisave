# OptiSave Backend v1.5 — PostgreSQL Single Source of Truth

Financial/account state is now database-native. `storage.js` no longer stores wallet, plans, transactions or notifications in localStorage. It is a read-only in-memory compatibility facade hydrated from authenticated PostgreSQL APIs.

## PostgreSQL
- wallet and wallet totals
- Lock Only / Lock & Allocation / Daily Saving plan creation
- plans
- transactions
- notifications + read state
- notification preferences
- profile
- KYC metadata/status
- verified bank metadata
- development reset

## Reset
Admin Reset Test Data now calls `/api/dev/reset` and atomically clears the current authenticated test account's wallet totals, plans, transactions and notifications in PostgreSQL. It only exists in development mode.

## Bell
Dashboard notification bell and Notifications page fetch PostgreSQL directly. Deposit, development withdrawal and plan creation create database notifications with transaction/plan destinations.

## Browser storage that remains
Authentication currently stores the JWT/session token in localStorage/sessionStorage. Security prototype pages (trusted-device/login-activity preferences) still use browser storage because they are not money/account ledger state. These should be migrated with the later secure-cookie/session security pass.

## Important
Run `npm run db:init` after upgrading.
The browser must use the localhost server, never `file://`.
