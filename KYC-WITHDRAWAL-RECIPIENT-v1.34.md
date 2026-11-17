# OptiSave v1.34 — Withdrawal Recipient Completion

- Adds a secure recipient-completion flow for KYC-verified bank accounts that are missing a Paystack `recipient_code`.
- The user re-enters the same 10-digit account number; OptiSave checks the saved last four digits and sends the number to Paystack without persisting the full number.
- The Paystack recipient code is stored and the bank becomes withdrawal-ready.
- The KYC-only test-bank alias `007` is mapped to Paystack's documented Zenith transfer test bank code `057` only when `PAYSTACK_SECRET_KEY` is a test key.
- Existing verified KYC status is preserved. No wallet balance is changed by recipient setup.
