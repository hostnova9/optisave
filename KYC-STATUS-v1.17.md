# OptiSave v1.17 — Unified KYC Status

The Profile page now uses the same KYC state rules as the KYC page.

- `not_submitted` -> Not Submitted
- `submitted`, `verification_in_progress`, or provider `pending` -> Pending
- `review_required` or provider `failed` -> Needs Review
- `rejected` -> Needs Update
- `verified` or provider `verified` -> Verified

Provider status is used as a safety fallback so a Paystack verification that is already in progress can never be displayed as Not Submitted on the Profile page.
