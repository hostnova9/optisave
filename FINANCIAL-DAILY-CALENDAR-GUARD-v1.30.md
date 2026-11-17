# OptiSave v1.30 — Daily Savings Calendar Guard

- Preserves v1.29 Paystack deposit/withdrawal work.
- Start Now contribution schedules the next contribution from the current day, not a stale/requested start date.
- Scheduler permits at most one completed Daily Saving debit per plan per Africa/Lagos calendar day.
- After a successful contribution, the next event is advanced from the current processing day to the next eligible 5:00 AM day.
- Weekend exclusion remains respected.
- db:init repairs stale due pointers for plans that already contributed today without moving money.
- Existing v1.28 EVENT_N exact-once protection remains in place.
