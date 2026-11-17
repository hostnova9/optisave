# OptiSave v1.52 — Weekend Remaining-Hours Scheduling

## What changed

When **Exclude Weekends** is enabled, a plan created during the weekend now uses the exact creation timestamp as its Start Now anchor.

The next eligible Daily Savings deduction or Lock & Allocation release is still **Monday at 5:00 AM Africa/Lagos**, but the countdown is simply:

`Monday 05:00 - current time`

This means OptiSave never adds a fresh 48-hour weekend after the user has already spent part of it.

Examples:

- Saturday 1:00 PM -> Monday 5:00 AM = **40 hours**
- Saturday 8:00 PM -> Monday 5:00 AM = **33 hours**
- Sunday 1:00 PM -> Monday 5:00 AM = **16 hours**
- Sunday 11:00 PM -> Monday 5:00 AM = **6 hours**

## Also corrected

- `start_at` for Start Now plans stores the real creation moment rather than 5:00 AM earlier that day.
- Lock and Lock & Allocation maturity for Start Now is measured from that exact moment.
- Scheduled/Future starts still use the selected date at 5:00 AM.
- The dashboard remains driven by the server's canonical `next_event_at` timestamp and does not rebuild or add weekend hours itself.
