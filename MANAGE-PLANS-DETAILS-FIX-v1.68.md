# OptiSave v1.68 — Manage Plans / Plan Details Fix

## Fixed
- Dashboard **My Plans → Manage** now opens the selected plan's real `plan-details.html` page.
- Added PostgreSQL-state-safe `getPlanById()` lookup after the earlier migration away from local financial state.
- Added a session-only selected plan ID for navigation fallback. No balances or financial state are stored in browser storage.
- **Active Locked Plans → View Details** now opens the same full plan details page instead of a basic alert.
- Cache-busted the affected scripts so browsers do not keep the old navigation logic.

## Unchanged
- Wallet and ledger rules
- Daily Savings schedule
- Lock / Allocation rules
- Paystack/payment integrations
- Bank sandbox integration framework

No new npm dependency is required.
