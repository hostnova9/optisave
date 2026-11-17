# OptiSave v1.66 — Wema Sandbox Integration Lab

This build adds an admin-only Wema/ALAT Open API sandbox proof environment.

## Purpose

The goal is to prove OptiSave can technically integrate with Wema before requesting production onboarding. Wema publicly describes its developer flow as Register -> Build and Test -> Go Live. The lab keeps all tests isolated from real OptiSave customer balances.

## Admin features

Open `Admin -> Bank Integration Lab`.

The lab includes:
- environment/credential readiness checks (never shows the secret values)
- Wema bank-list connection test
- Wallet Services wallet lookup
- Wallet Creation request runner
- NIN/OTP continuation step
- source wallet name enquiry
- destination account name enquiry
- NIP charges enquiry
- Wallet transaction history request runner
- sandbox Debit Wallet transfer request runner
- callback URLs for wallet, transaction and debit authorization callbacks
- redacted/auditable sandbox logs
- a production-handoff summary that can be copied into the Wema go-live email

## Required environment variables

```env
WEMA_SANDBOX_ENABLED=true
WEMA_API_BASE_URL=YOUR_WEMA_SANDBOX_BASE_URL
WEMA_API_KEY=YOUR_WEMA_WALLET_API_KEY
WEMA_API_KEY_HEADER=x-api-key
WEMA_ACCESS_KEY=YOUR_WEMA_DEBIT_ACCESS_KEY
WEMA_ACCESS_HEADER=access
WEMA_SUBSCRIPTION_KEY=YOUR_OPTIONAL_API_MANAGEMENT_SUBSCRIPTION_KEY
WEMA_SUBSCRIPTION_HEADER=Ocp-Apim-Subscription-Key
WEMA_CHANNEL_ID=YOUR_CHANNEL_ID
WEMA_REQUEST_TIMEOUT_MS=20000
APP_BASE_URL=https://myoptisave.site
```

The exact base URL, key/header names and channel ID must come from the Wema subscription/profile assigned to OptiSave. Do not guess production credentials.

## Callback URLs

With `APP_BASE_URL=https://myoptisave.site`, the lab exposes:

- `https://myoptisave.site/api/webhooks/wema/wallet`
- `https://myoptisave.site/api/webhooks/wema/transaction`
- `https://myoptisave.site/api/webhooks/wema/authorize`

These callbacks only record sandbox events. They do not alter user wallets, savings plans or the financial ledger.

For Debit Wallet sandbox transfers, OptiSave injects a one-time `securityInfo` on the server and validates it when Wema calls the authorization endpoint.

## Important

Sandbox success proves technical compatibility only. Production access remains subject to Wema Bank's commercial, compliance, KYC/AML, security, settlement and regulatory requirements.
