# OptiSave v1.53 — Smart Schedule & Mobile Flow

## Confirmed product rules implemented

### Daily Savings
- Start Now on an eligible weekday after 5:00 AM starts that saving day immediately.
- If wallet funds are sufficient, the contribution is collected once immediately.
- If funds are insufficient, the same saving day becomes Due immediately, is rechecked until midnight, and defaults only at day close.
- Before 5:00 AM, the first contribution waits for that day's 5:00 AM window.
- With Exclude Weekends enabled, Saturday and Sunday create no contribution day, no default and no deduction. The next saving day is Monday at 5:00 AM.
- Missed eligible dates are reconciled by the server ledger rather than silently skipped.
- The Daily Saving Center uses the server-generated schedule and recorded daily_saving_events as its source of truth.
- Mobile shows a compact relevant circle window with View more instead of rendering a long plan all at once.

### Lock & Allocation
- The full lock amount is debited once when the plan is created.
- Allocation never releases immediately at plan creation; first release is the next eligible Lagos 5:00 AM.
- Weekend countdowns use the exact creation timestamp, so only the real hours remaining to Monday 5:00 AM are shown.
- Release Frequency is selectable: Daily or Weekly.
- Weekly schedules stay on the same weekday after the first eligible 5:00 AM anchor (for example Monday -> Monday).
- Excluded weekends do not create allocation release events.
- Release counts and release amounts are calculated by the server against the real maturity timestamp.
- The final scheduled allocation release absorbs rounding remainder so the allocation pool reaches exactly zero.
- Allocation activity is matched by plan_id, not by plan-name text.

### Lock-only conversion to allocation
- 50% conversion can now choose Daily or Weekly frequency.
- The server caps the conversion schedule to the plan's existing maturity.

## Scheduling authority
The PostgreSQL plan row (`next_event_at`) and Daily Savings day ledger are authoritative. Browser pages display those timestamps/statuses and do not independently move a correct Monday event to Tuesday.
