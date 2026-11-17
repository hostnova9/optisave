# OptiSave v1.22 — Financial State Reconciliation

- `/api/state` now returns one PostgreSQL financial summary for active plan counts and plan categories.
- Available Balance renders available balance, locked balance and active plan count from the same backend snapshot.
- Allocation Center, Daily Saving Center and Plan Details wait for the PostgreSQL state snapshot before rendering.
- Active Locked Plans uses the wallet's authoritative `total_locked` value for its total, preventing a different page-specific locked-total formula.
- No browser financial mutation was reintroduced; financial actions remain server-side.
