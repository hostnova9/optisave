# OptiSave v1.47 — Daily Savings Day Lifecycle

- 05:00 Africa/Lagos: an eligible contribution date opens. If the wallet is short, the date becomes Payment Due and the first reminder is created.
- The 60-second server scheduler keeps checking the wallet. If enough money becomes available before midnight, that date is collected once and marked Paid.
- 12:00: a noon reminder is created if the contribution is still due.
- 18:00: an evening reminder is created if the contribution is still due.
- 00:00: the previous date closes. If still unpaid it is marked Defaulted and receives one final notification.
- A defaulted date is never collected later. The next eligible date starts a new independent contribution cycle.
- Weekends remain excluded when the plan has Exclude Weekends enabled.
- `daily_saving_events` is the canonical day ledger with unique plan/date and plan/event constraints.
- Paid deductions use a unique plan/date transaction reference. Reminder/default notifications use unique event keys.
- Daily Saving Center shows Paid Days, Defaulted Days, Remaining Days and per-date Paid / Payment Due / Defaulted history.
