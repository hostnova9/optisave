# OptiSave v1.18 — Backend KYC State Machine

KYC status is normalized by the backend and shared by Profile and KYC screens.

- `not_submitted` → Not submitted; user can submit.
- `verification_in_progress` / provider `pending` → Verification in progress; form stays collapsed/locked.
- `submitted` / `review_required` → Under review.
- provider success / `verified` → Verified.
- provider failure, rejected, failed, or stale provider request → Action required; user can re-verify/re-submit.

Additional safeguards:

- A Paystack identification request that fails immediately is persisted as `action_required` instead of leaving the account stuck in Pending.
- A provider request still pending after 15 minutes is converted to Action Required with a retry message when the profile is next loaded. A later signed success webhook can still change it to Verified.
- Re-submitting KYC clears the previous provider failure so the new attempt is not masked by an old failure state.
- Paystack success/failure webhooks remain the authoritative final provider result.
- Raw BVN is not stored in OptiSave PostgreSQL.
