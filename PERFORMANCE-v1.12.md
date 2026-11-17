# OptiSave v1.12 — Dashboard performance

- Removed the full-page auth visibility block on every protected-page navigation.
- Token validation still runs in the background and invalid sessions are redirected.
- `/api/state` now uses one PostgreSQL round-trip rather than four separate queries.
- Unified-state history is bounded to 200 transactions and 100 notifications.
- Dashboard notifications now render from unified state instead of making duplicate `/api/notifications` requests during dashboard refreshes.
- Financial state remains PostgreSQL-backed; these changes do not move balances or plans into browser storage.
