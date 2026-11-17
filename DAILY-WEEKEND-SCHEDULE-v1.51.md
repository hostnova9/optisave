# OptiSave v1.51 — Weekend Schedule + Daily Status Fix

This build fixes the Daily Savings and Lock & Allocation schedule path around excluded weekends and missed server cycles.

## Weekend scheduling
- `Africa/Lagos` is the canonical scheduling timezone.
- When **Exclude Weekends** is enabled, Saturday and Sunday never become saving/release events.
- Friday after the 5:00 AM window advances to **Monday 5:00 AM**, not Tuesday.
- A plan created on Saturday or Sunday advances to **Monday 5:00 AM**.
- The dashboard now trusts PostgreSQL `next_event_at` directly for Daily Savings and no longer adds an extra browser-side day.
- An initialization repair corrects untouched first events that were previously pushed one day too far.

## No skipped eligible days
- Daily Savings catches up all missed eligible dates in one scheduler pass after downtime.
- Missed Daily Savings dates are closed as **Defaulted** and are never charged later.
- Lock & Allocation catches up due releases in one scheduler pass instead of waiting one minute per missed release.
- Exact-once transaction references and notification event keys remain in place.

## Daily Savings identity
- The selected saving goal is now the plan name itself.
- Existing legacy rows created exactly as “<goal> Saving” + “<goal>” are normalized to the single goal/plan name on server startup.
- Daily Savings no longer creates a second customer-facing plan/purpose event stream.
- One plan has one schedule and one contribution-day ledger.

## Contribution status circles
Daily Saving Center now shows one circle per eligible saving day:
- Green — Paid
- Orange — Due
- Red — Defaulted
- Blue — Upcoming

Excluded weekend dates are not shown or counted.

## Notifications
- Daily default notifications render with a red error indicator in the dashboard bell and Notifications page.
- 5 AM, noon and 6 PM reminders remain attached to the same contribution day rather than creating separate saving events.
