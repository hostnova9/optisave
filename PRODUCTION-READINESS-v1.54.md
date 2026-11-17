# OptiSave v1.54 — Financial Ledger, Exact-Once Actions & Scheduler Recovery

This build hardens the existing v1.53 savings flow without changing the confirmed weekend, Daily Savings, or allocation rules.

## 1. Financial ledger

A new `financial_ledger` table records financial actions separately from the customer-facing transaction feed. New runtime money movements capture:

- user, wallet, plan and transaction IDs
- entry type and direction
- amount
- available balance before/after
- locked balance before/after
- a unique ledger idempotency key
- event metadata and timestamp

Existing historical transactions are backfilled safely at startup. Historical rows do not invent before/after balances; those snapshot fields remain null. New runtime movements record real snapshots.

Covered runtime flows include plan funding, Daily Savings deductions, allocation releases, maturity releases, emergency access, Daily Savings early access, Paystack deposits, withdrawal reservation/refund/settlement, allocation conversion, and development wallet movements.

## 2. Exact-once financial requests

The browser now attaches a stable idempotency key to financial POST requests. It keeps the same key across an unknown network/server failure so retrying cannot create a second financial action.

Server-side `idempotency_requests` protects:

- new plan creation
- withdrawals
- emergency access
- Daily Savings early access
- Lock Only → Allocation conversion
- development wallet movements

The scheduler and provider webhooks continue to use unique transaction references plus row locks. The financial ledger adds a second unique guard for each logical balance movement.

Withdrawal reservations are also fail-safe around uncertain gateway responses: a network/5xx/timeout outcome is **not** automatically refunded because the provider may already have accepted the transfer. The money stays reserved and is flagged for reconciliation until a final provider webhook/status is known. Only a definitive provider rejection is refunded immediately. This prevents a timeout from creating money in both the OptiSave wallet and the banking rail.

## 3. Scheduler recovery

The financial engine now:

- repairs plan schedules before the first run
- performs a larger catch-up pass at startup
- processes due plans in safe batches
- relies on the existing plan-row locks and event references for exact-once execution
- persists last start/completion/success/error counters in `financial_engine_state`

Daily Savings still defaults missed eligible dates rather than silently charging them later. Allocation events that should already have been released are caught up in chronological order.

## 4. Runtime migration

`npm start` now applies the idempotent `schema.sql` before opening the HTTP listener. Replacing the project folder therefore creates the v1.54 safety tables automatically. Running `npm run db:init` remains supported for the older reconciliation routines.

## 5. Financial audit

`GET /api/financial-audit` now reports:

- wallet locked amount vs active-plan locked amount
- ledger entry count
- number of new ledger entries with balance snapshots
- financial transactions missing a ledger record
- financial-engine health/status
- reserved withdrawals and withdrawals requiring provider reconciliation

`GET /api/financial-engine/status` exposes the scheduler's latest recovery/run state for troubleshooting.

## 6. Verification

Run:

```bash
npm run test:readiness
```

Then start OptiSave and test one of each flow using development funds before a real gateway is connected.

### Recommended manual recovery test

1. Create a Daily Savings plan with Exclude Weekends ON.
2. Stop the server before an eligible 05:00 event.
3. Leave it stopped past 05:00.
4. Start the server again.
5. Confirm the missed eligible day is either collected (if still open and funded) or correctly becomes Defaulted after its close; it must not double debit.
6. Repeat with a Lock & Allocation plan and confirm due allocation releases catch up once each.
7. Open `/api/financial-audit` while logged in and confirm `ok: true` and `transactionsMissingLedger: 0`.
