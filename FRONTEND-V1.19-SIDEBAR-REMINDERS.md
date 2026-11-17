# OptiSave v1.19 — Personalized Sidebar & Daily Savings Reminders

- Dashboard sidebar now greets the signed-in user by first name.
- Sidebar shows live device date/time and the previous successful login timestamp from PostgreSQL.
- User login history now tracks `last_login_at` and `previous_login_at`.
- Daily Savings creation includes an optional reminder time.
- Users can download an `.ics` recurring calendar reminder after creating a Daily Savings plan.
- Weekend exclusion is reflected in the calendar recurrence.
- Reminder preferences are stored in the plan metadata for later server/push reminder work.

The calendar file does not grant OptiSave access to the user's calendar. The user explicitly opens/imports it on their device.
