# OptiSave v1.21 — PostgreSQL Financial Engine

Money-moving plan actions are now server-authoritative. Browser helpers only display estimates; every action is revalidated inside a PostgreSQL transaction with row locks.

## Implemented
- Lock Only and Lock & Allocation maturity processing.
- Daily Savings scheduled deductions.
- Allocation releases from the already-locked allocation pool (no second wallet debit).
- Lock Only one-time 50% conversion into an allocation schedule.
- One-time emergency access after the halfway point for Lock Only / Lock & Allocation.
- Emergency access disables future allocation releases.
- Daily Savings one-time 50% early access after half the configured saving days.
- Unique transaction references for scheduler events and one-time actions.
- `SELECT ... FOR UPDATE` / `FOR UPDATE SKIP LOCKED` around financial processing.
- 60-second backend scheduler; pages do not need to be open for due processing.
- Development-only `POST /api/financial-engine/run` for testing due events immediately.

## Important production work still remaining
- Real Paystack deposit initialization/webhook crediting and real transfer-based withdrawals are not enabled yet.
- Current DB money columns remain NUMERIC(18,2) and the Node layer still converts values to JS Number in places. Before real-money launch, migrate financial calculations to integer kobo or a strict decimal implementation.
- Scheduler timezone policy should be explicitly configured for production rather than relying on host/runtime timezone behavior.
