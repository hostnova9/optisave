# OptiSave v1.32 — KYC Withdrawal Bank Sync

- KYC bank details now seed the user's primary withdrawal bank record during provider verification.
- Raw BVN and full bank account number are still not stored by OptiSave.
- Paystack transfer-recipient creation is attempted while the account number is present in the KYC request.
- `customeridentification.success` marks the same primary bank account verified and ready for withdrawal when a recipient code exists.
- `customeridentification.failed` leaves the destination unverified.
- Bank Information displays the KYC-linked account and its withdrawal readiness.
- Paystack Test Bank (007) is available in Bank Information while test mode is being used.

Existing users whose KYC was verified before v1.32 must run KYC provider verification once more because the old system deliberately did not retain the full account number needed to create a transfer recipient.
