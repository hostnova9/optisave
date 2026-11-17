# OptiSave v1.8 — Notification Bell Fix

Root cause: PostgreSQL was correctly receiving deposit and plan-created notification rows, but the v1.7 cleanup accidentally removed the notification API methods from `js/api.js`. The dashboard bell therefore could not fetch them.

Fixed:
- `OptiSaveAPI.notifications()`
- mark one notification read
- mark all notifications read
- notification preferences API methods
- existing PostgreSQL deposit, withdrawal and plan-created notifications remain intact

Existing notifications already stored in PostgreSQL should appear after upgrading; you do not need to recreate them.

Run:
npm install
npm run db:init
npm start
Then hard-refresh the dashboard (Ctrl+F5).
