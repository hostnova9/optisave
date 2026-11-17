# OptiSave v1.33 — KYC Withdrawal Reconciliation

- Fixes Paystack customer-identification webhook user matching by supporting both event email and persisted `provider_customer_code`.
- Makes verified KYC authoritative for the linked primary withdrawal bank.
- `GET /api/bank-account` self-heals a stale pending bank when KYC/provider status is already verified.
- `npm run db:init` reconciles existing verified KYC users without moving money.
- Withdrawal readiness still requires a Paystack `provider_recipient_code`; verification alone never bypasses that transfer safety requirement.
