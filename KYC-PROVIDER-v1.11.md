# v1.11 Paystack provider verification

Flow:
1. User completes profile, bank resolution and KYC submission.
2. User explicitly enters BVN for a verification request. OptiSave sends it to Paystack over the server API and does not store the raw BVN.
3. OptiSave creates/fetches a Paystack customer and starts POST /customer/{customer_code}/identification.
4. KYC becomes verification_in_progress.
5. Paystack sends customeridentification.success or customeridentification.failed to /api/webhooks/paystack.
6. The webhook validates x-paystack-signature with HMAC-SHA512 using PAYSTACK_SECRET_KEY before changing PostgreSQL.
7. Success -> verified; failure -> review_required. User receives a notification.

Setup:
- Run npm run db:init after upgrading.
- Configure the Paystack dashboard webhook URL as https://YOUR_PUBLIC_DOMAIN/api/webhooks/paystack.
- localhost cannot receive Paystack webhooks unless exposed by a secure public tunnel.
- Test credentials are documented by Paystack for integration tests; live customer validation requires live eligibility/keys.
