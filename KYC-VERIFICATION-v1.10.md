# OptiSave v1.10 KYC verification foundation

This build separates bank-account resolution from identity verification.

- Paystack bank resolve supplies the bank-registered account name.
- The backend normalizes and compares that name to the OptiSave profile name and stores a match result/score.
- KYC submission becomes submitted or review_required.
- Admin KYC Review displays masked ID, profile name, resolved bank account name, match result and status.
- Admin approval is blocked when the bank-name match is not positive.
- Approval/rejection creates a user notification.
- Full BVN/NIN is not added to ordinary database metadata in this build.

Important: a bank-name match is not itself proof of identity. Paystack's Nigerian Customer Identification endpoint can validate BVN + bank account + bank code + names asynchronously, but live validation depends on Paystack availability/account eligibility and webhook configuration. That live provider step should be added before treating KYC as fully automated in production.
