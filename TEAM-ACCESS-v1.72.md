# OptiSave v1.72 — Admin sidebar and staff accounts (local testing)

## What's new
- Admin left navigation scrolls independently from the page, including on small screens. The brand and Logout remain visible.
- The owner can open **Team Access**, create separate logins for Customer Care and Personal Assistant, disable/reactivate them, or reset an employee's password.
- Temporary passwords are random and displayed just once in the owner panel; employees must change them at first login.
- Current roles are enforced by server APIs (hiding a menu item alone is NOT the security mechanism).

## Roles
- **Owner / super_admin:** existing complete admin dashboard, financial data, KYC, integrations, broadcasts, test resets, and team management.
- **Customer Care / support_agent:** customer contact directory (name, email, phone, status), company outbound mailer, sent-email history, company contacts, and their own password change.
- **Personal Assistant / personal_assistant:** company outbound mailer, sent-email history, company contacts, and their own password change.

Staff cannot use finance/transaction/KYC admin APIs, reset user data, manage teammates, or change company sender branding. Staff may send company emails, so only give access to trusted employees. Outbound mail and stored contact management are implemented; a two-way customer support ticket/incoming-email inbox has **not** yet been built.

## Installing without losing current data
1. Stop OptiSave cleanly (Ctrl+C) and wait for the local PGlite database to close.
2. Create a separate offline backup of the ENTIRE current OptiSave folder, especially `.env`, `database/optisave-pglite/`, and `database/backups/`.
3. Extract the patch ZIP. Copy its **files and folders** into your existing OptiSave folder, replacing same-named files. Do **not** delete or replace `.env`, `database/`, or your test registrations.
4. Run `npm start`. Existing data is migrated by the application's startup schema process.
5. Sign in to admin, choose **Team Access**, and generate one staff account for testing. Test an employee login in another private-browser session.

Run only against a testing installation, with simulated deposits. Before public availability, use Cloudflare Access, replace any exposed owner passwords/API secrets, and audit security and financial controls.

## Technical notes
- `server/schema.sql` adds `admins.must_change_password`, `admins.session_version`, and a small staff activity log table (`admin_activity`).
- Staff management routes: `GET/POST /api/admin/staff`, `PATCH /api/admin/staff/:id`, `POST /api/admin/staff/:id/reset-password` (owner only).
- Password change: `POST /api/admin/change-password` (current admin account).
- Safe customer listing: `GET /api/admin/staff/customers` (Customer Care + Owner only).
- Every authenticated API request rechecks the current database role, status, and session version so disabling employees/resetting passwords revokes existing tokens.
- Admin email remains via the existing Resend configuration; these changes do not modify Paystack deposits, PGlite storage, saving schedules, wallet logic, or user login.
