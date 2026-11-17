# OptiSave v1.36 — Authentication & Withdrawal Lifecycle

- Registration now issues a hashed, expiring email OTP.
- Login is password + email OTP. OTPs expire after 10 minutes, are one-time use, have a resend cooldown and a five-attempt limit.
- Password reset is now an email-OTP flow and invalidates existing user sessions through session versioning.
- OTP values are never stored in plaintext. In development without email configuration, the code is printed only to the server console.
- Production email delivery supports Resend with `RESEND_API_KEY` and `AUTH_EMAIL_FROM`.
- Login events are persisted in PostgreSQL.
- Withdrawal provider failures keep/refund the user's available balance and customer UI no longer exposes Paystack account/compliance configuration errors.
- Paystack transfer webhooks remain authoritative for successful, failed and reversed withdrawal settlement, with transaction row locking and idempotent notification/refund behavior.
- Admin withdrawal view now exposes customer, amount, masked destination description, status, provider status/error, reference and date.
