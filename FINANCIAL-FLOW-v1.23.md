# OptiSave v1.23 — Unified Financial Flow

This build is based on the uploaded OptiSave project and audits the savings flow end-to-end.

## Canonical storage
Financial state is PostgreSQL-only. Browser local/session storage is not used for wallet balances, plans, transactions, allocation progress, or Daily Savings progress. Session storage remains only for temporary plan-review form data before confirmation.

## Main corrections
- Daily Savings no longer writes a zero-value financial transaction when no contribution was actually collected.
- Start Now Daily Savings records the first contribution exactly once when funds are available, then schedules the next eligible 5 AM event instead of scheduling the already-passed 5 AM again.
- Daily Savings next-event timestamps are treated as real PostgreSQL timestamps by the UI; the UI no longer appends a second `T05:00:00` to an ISO timestamp.
- Daily Savings duration, completed saving days, pending state, and scheduled amount now have canonical PostgreSQL columns.
- Lock & Allocation schedule count and per-release amount are calculated on the server. Weekend exclusion is applied once, not recalculated differently on each page.
- Allocation Center no longer calls the missing `normalizeAllocationPlan()` function.
- Dashboard uses PostgreSQL `next_event_at` directly for countdowns. A due event stays "Processing"/"Waiting" instead of the browser silently moving it to tomorrow.
- Lock/Allocation review pages wait for PostgreSQL state before displaying wallet balances.
- Scheduler updates canonical completed-event counters under the same SQL transaction as the money movement.
- Existing v1.22 plan metadata is safely backfilled into the new schedule columns by `npm run db:init`; the migration does not move money.

## Important
Run `npm run db:init` before `npm start` for this version.
