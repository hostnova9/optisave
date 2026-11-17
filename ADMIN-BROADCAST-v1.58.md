# OptiSave v1.58 — Branded Admin Broadcast & User Segmentation

## What was added

The Admin Console now has a **Communications** section for sending official OptiSave messages to multiple users without manually contacting them one-by-one.

### Supported audiences
- All active, verified users
- Registered users with no savings plan yet
- Active Lock Only users
- Active Lock & Allocation users
- Active Daily Savings users
- Users with any active plan
- Users with matured plans
- Users inactive for 30+ days
- Individually selected users (search by name, email or phone)

### Branded delivery
Every admin broadcast creates an in-app notification with:
- OptiSave logo and branded banner
- Message type (Update, Important, Reminder, Promo, Security or System)
- Title and optional subtitle
- Message body
- Optional OptiSave action button
- Unread/read tracking

The Admin Console includes a live preview before sending and a final OptiSave-styled confirmation modal.

### Optional email delivery
If Resend is configured, the same broadcast can also be delivered by email using an OptiSave-branded HTML email with logo, banner, company footer and action button.

Required environment variables for email broadcasts:

```env
RESEND_API_KEY=
BROADCAST_EMAIL_FROM=OptiSave <support@myoptisave.site>
APP_BASE_URL=https://myoptisave.site
```

In-app broadcasts do **not** require Resend.

### Broadcast history
Admin can review:
- broadcast title/type
- target audience
- total recipients
- number read
- email sent/failed counts
- date/time sent

## Database additions
The runtime migration creates:
- `broadcasts`
- `broadcast_recipients`
- branded broadcast fields on `notifications`

The migration runs automatically when OptiSave starts because `server/index.js` already executes `schema.sql` on startup.

## Safety
- Broadcast routes require authenticated admin access.
- Only predefined database audience segments are allowed.
- Action links are restricted to safe local OptiSave pages.
- User-generated/admin text is escaped in the user notification renderer.
- Only active, email-verified users are eligible for broadcasts.

## Existing systems preserved
The financial engine, Paystack test/pilot guard, savings schedules, KYC, transaction ledger and existing system notifications were not replaced.
