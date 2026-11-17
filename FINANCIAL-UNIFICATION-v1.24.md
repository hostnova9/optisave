# OptiSave v1.24 — Unified Financial Flow

This build was rebuilt from the user-supplied `OptiSave.zip` master, not from the reduced v1.23 package.

## One source of truth
Financial balances, plan progress, schedules, transactions and notifications are PostgreSQL-backed. Browser storage remains only for authentication/session and non-financial UI preferences.

## Fixed
- Daily Saving: immediate contribution is recorded once, never as a ₦0 transaction.
- Daily Saving: after an immediate contribution, the next 5 AM event advances to the next eligible saving day, preventing duplicate same-day deductions.
- Daily Saving scheduler: every successful deduction creates a transaction and a notification in the same SQL transaction.
- Insufficient Daily Saving funds: one warning notification per due date; the event remains pending instead of silently disappearing.
- Allocation Center: removed a call to a missing `normalizeAllocationPlan()` function that stopped the page before values could render.
- Allocation releases: server uses canonical event amount/count, updates wallet + plan + transaction + notification atomically.
- Available Balance: top wallet card now uses the actual `walletBalance` element (previous code updated a nonexistent ID).
- Daily Saving Center: `next_event_at` is treated as a full timestamp; it no longer appends a second `T05:00:00` to an ISO timestamp.
- Canonical schedule columns added: `schedule_total_events`, `schedule_completed_events`, `event_amount`, `last_event_at`.
- `npm run db:init` backfills these fields for existing Daily/Allocation plans without moving money.
- `/api/financial-audit` provides a read-only reconciliation of wallet locked funds vs active plan locked funds.

## Atomic event pattern
Each successful scheduled money event is one PostgreSQL transaction containing:
1. wallet change
2. plan progress change
3. transaction ledger row
4. user notification

Unique transaction references prevent the scheduler from recording the same due event twice.

## Existing Daily Saving repair
`npm run db:init` also links/creates a notification for older completed `Daily Saving` ledger transactions that moved a positive amount but came from a build that did not record a corresponding saving notification. This repair creates notifications only; it does not debit the wallet again.
