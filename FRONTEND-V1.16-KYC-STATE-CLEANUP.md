# OptiSave v1.16 — KYC State & Production Flow Cleanup

- KYC forms and provider verification are collapsed by default on every visit.
- Pending/submitted users see a status summary instead of an open form.
- Manage KYC is the only control that opens verification details.
- Starting provider verification immediately closes the panel and shows Pending.
- Submitted, verification-in-progress, review-required and verified states are locked against document resubmission.
- Rejected KYC is presented as Needs update with an Edit KYC action.
- Status labels are normalized for not submitted, pending, review required, verified and needs update.
- The Paystack test-bank option from v1.15 is retained.
