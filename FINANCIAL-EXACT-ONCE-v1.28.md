# OptiSave v1.28 — Daily Savings Exact-Once Repair

- Daily Saving contributions now use a canonical PostgreSQL reference: `DAILY_<planId>_EVENT_<n>`.
- The scheduler never debits or increases saved balance when that event already exists.
- Immediate Start Now contribution is EVENT_1; the scheduler continues from EVENT_2.
- `db:init` safely reconciles older same-plan/same-day duplicate Daily Saving debits: earliest debit is retained, later duplicates are marked reversed and refunded once.
- Duplicate contribution notifications linked to reversed transactions are removed and one correction notification is created.
- Plan creation notification no longer repeats the first contribution as though it were another deduction.
- Allocation and Available Balance fixes from v1.27 are preserved.
