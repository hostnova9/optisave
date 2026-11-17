# OptiSave v1.29 — Paystack Deposits & Withdrawals

- Deposits initialize from the backend and redirect to Paystack Checkout.
- Wallet credit occurs only after server-side Paystack verification or a signed `charge.success` webhook.
- Deposit references are unique and settlement is idempotent.
- Saving a verified bank account now creates a Paystack NUBAN transfer recipient; only the recipient code and last four account digits are stored by OptiSave.
- Withdrawals are restricted to the verified primary bank account.
- Available balance is reserved atomically before transfer initiation.
- `transfer.success` finalizes total withdrawn; `transfer.failed` and `transfer.reversed` return reserved money exactly once.
- Paystack webhook signature verification remains required.
- Development wallet endpoints remain available only when NODE_ENV=development and ENABLE_DEV_WALLET=true, but the normal deposit/withdraw UI now uses Paystack.

Required environment variables:
- PAYSTACK_SECRET_KEY
- APP_BASE_URL=https://myoptisave.site

Webhook URL:
- https://myoptisave.site/api/webhooks/paystack

Run `npm run db:init` after deployment, then restart the server.
