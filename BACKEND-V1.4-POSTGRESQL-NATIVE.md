# OptiSave Backend v1.4 — PostgreSQL Native Core

Core account state no longer relies on browser localStorage for durable storage.

PostgreSQL-native:
- authentication/users
- wallet
- Lock Only creation + deduction (single SQL transaction)
- Lock & Allocation creation + deduction (single SQL transaction)
- Daily Savings creation + first contribution
- plans
- transaction ledger
- notifications persistence
- personal profile
- KYC status/metadata
- verified withdrawal bank metadata
- bank account name resolution through backend provider

The old storage.js remains only as a compatibility cache for legacy synchronous display/automation code. It hydrates from PostgreSQL on authenticated page load; it is not intended to be the durable account store.

## Paystack bank verification
Set `PAYSTACK_SECRET_KEY` in `.env` to a Paystack TEST secret key. Never put this key in browser JavaScript.
The backend fetches Nigerian banks and resolves account names. Only the verified bank name/code, account holder name, and last four account-number digits are persisted by this build.

## KYC files
KYC status and masked document metadata are persisted. Raw identity-document/selfie binary upload is intentionally NOT treated as production-ready storage in this build; that requires private object storage/provider integration.

## Test
Run `npm run db:init` after upgrading because schema migrations add profile address fields.
Then `npm start` and test only through localhost.
