# OptiSave v1.35 — Paystack Test Withdrawal Recipient

- Separates the OptiSave KYC test-bank alias (`007`) from Paystack transfer-recipient testing.
- With an `sk_test_` key and saved KYC bank code `007`, recipient creation uses Paystack’s documented Nigerian transfer test destination: Zenith Bank code `057`, account `0000000000`.
- The user must still re-enter the same 10-digit KYC account number so the saved last-four check remains enforced before setup.
- The full KYC account number is not persisted.
- Live-key behavior is unchanged: real bank code/account resolution is required before recipient creation.
- Withdrawal remains disabled until Paystack returns and OptiSave stores a `recipient_code`.
