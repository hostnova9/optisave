# OptiSave v1.57 — Controlled Live Pilot Guard

This build adds an explicit payment safety switch around the existing Paystack integration.

## Modes
- `PAYMENT_MODE=test`: requires a Paystack test key. Existing test payment flow remains available.
- `PAYMENT_MODE=pilot`: requires a Paystack live key and `LIVE_PAYMENT_ALLOWLIST`. Only allowlisted OptiSave accounts can initialize real deposits, submit real withdrawals, create live transfer recipients, or start live Paystack identity verification.
- `PAYMENT_MODE=live`: requires a Paystack live key and opens the existing payment flow to eligible users.

The server refuses to start if the configured mode and Paystack key type disagree. This prevents a live key from being used accidentally while the app still says it is in test mode.

## Pilot limits
`LIVE_DEPOSIT_MAX` and `LIVE_WITHDRAWAL_MAX` are enforced by the backend. The browser also displays the pilot status and limits, but backend enforcement is authoritative.

## Safety rules
- Development wallet endpoints are force-disabled outside `test` mode.
- Paystack webhooks are never blocked by the allowlist, so already-accepted provider events can always settle safely.
- Deposit crediting and withdrawal settlement still use the existing ledger/idempotency controls.
- Deposit verification remains available for an existing transaction even if the current pilot allowlist changes.

## Example pilot configuration
```env
NODE_ENV=production
ENABLE_DEV_WALLET=false
PAYMENT_MODE=pilot
PAYSTACK_SECRET_KEY=sk_live_REPLACE_ME
LIVE_PAYMENT_ALLOWLIST=your-optisave-login-email@example.com
LIVE_DEPOSIT_MAX=5000
LIVE_WITHDRAWAL_MAX=5000
```

Do not put live secret keys in source control or share them in chat. Keep them only in the server `.env` / hosting environment variables.
