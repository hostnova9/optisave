# OptiSave v1.50 — Daily Savings Lifecycle

Built from the supplied v1.49 master.

- One customer-facing Daily Savings contribution stream; separate “Daily Savings created” notices are removed.
- 5:00 AM Africa/Lagos: contribution becomes due and the first insufficient-funds notice is sent when needed.
- The scheduler keeps checking the wallet every cycle and collects exactly once as soon as funds are sufficient.
- 12:00 PM: reminder if still due.
- 6:00 PM: reminder if still due.
- Midnight: final Defaulted notice and the previous day is closed permanently.
- No catch-up debit for a defaulted day. The next eligible date starts independently.
- One `daily_saving_events` row per plan + Lagos date is the canonical Paid / Due / Defaulted history.
- Logout continues to clear the customer session and return to `index.html` (the OptiSave homepage).
