# v1.7 PostgreSQL Stability Fix

Fixes:
- Admin setup now has an explicit `npm run admin:init` command.
- Dashboard waits for PostgreSQL state before rendering, removing the temporary zero/old balance flash.
- Available Balance reads wallet + transactions directly from authenticated APIs.
- Active Plans waits for PostgreSQL hydration before rendering.
- Removed the old client-write `/api/state/wallet`, `/api/state/plans`, transaction sync and notification sync bridge routes. Browser code can no longer overwrite the PostgreSQL ledger through those compatibility endpoints.
- Financial `storage.js` remains read-only/in-memory; no financial state is persisted in localStorage.

Admin setup:
1. Put ADMIN_EMAIL and ADMIN_PASSWORD in `.env`.
2. Run `npm run db:init`.
3. Run `npm run admin:init` (prints `Admin login ready: ...`).
4. Run `npm start`.
5. Open `/admin-login.html`.

Do not share the admin password.
