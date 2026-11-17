# OptiSave v1.13 — Paystack Webhook PostgreSQL Fix

Fixed PostgreSQL error `42P08: inconsistent types deduced for parameter $4` in the Paystack customer-identification webhook.

The KYC status parameter is now explicitly cast to `varchar` both when assigned to `kyc_profiles.status` and when evaluated for `verified_at`. No database reset is required for this fix.
