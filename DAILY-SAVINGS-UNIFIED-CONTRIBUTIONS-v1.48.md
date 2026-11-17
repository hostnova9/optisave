# OptiSave v1.48 — Unified Daily Savings Contributions

Daily Savings now uses one canonical contribution-day ledger (`daily_saving_events`) per plan + eligible Lagos calendar date.

## Customer-facing lifecycle
- 5:00 AM Africa/Lagos: contribution becomes Due. If wallet has enough funds, it is collected immediately; otherwise the first insufficient-funds notification is sent.
- 5:00 AM–12:00 PM: scheduler keeps checking for funds.
- 12:00 PM: second reminder if still unpaid; checking continues.
- 6:00 PM: third reminder if still unpaid; checking continues.
- Midnight: unpaid day is closed as Defaulted and a final default notification is sent. The old date is never caught up later.
- Next eligible date starts a new independent cycle at 5:00 AM.

## Unified records
- A successful debit produces one user-facing **Daily Savings Contribution** notification and one financial transaction linked to the contribution-day row.
- The Daily Savings Center uses the same contribution-day row for Paid, Due and Defaulted status.
- Default days are not zero-value financial transactions. They remain in `daily_saving_events`, which is the canonical saving-day history.
- Start Now no longer creates both a plan-created success notification and a separate recorded notification when the first contribution is paid. The paid contribution is the success event.
- Existing historical `Daily saving recorded` / `Daily saving paid` notification titles are normalized by `npm run db:init`.
- Old zero-value `Daily Saving Default` transaction rows are removed by `npm run db:init`; they moved no money and the day ledger preserves the default history.

## Exact-once rules
- `UNIQUE(plan_id, schedule_date)` and `UNIQUE(plan_id, event_no)` prevent duplicate contribution days.
- Transaction references prevent duplicate debits.
- Notification `event_key` prevents duplicate reminders/success/default notifications.
