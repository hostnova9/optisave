# OptiSave v1.67 – Wema BVN Sandbox Step 1

This release maps the exact Wema ALAT Playground BVN account-creation Step 1 endpoint supplied from the official API documentation.

## Exact request mapped

- Method: `POST`
- Base URL: `https://apiplayground.alat.ng`
- Path: `/account-creation/api/CustomerAccount/PostPartnershipAccountCreationWithBvn`
- Required credential header: `x-api-key`
- Request body: `phoneNumber`, `email`, `bvn`

## Safety

The request is made from the OptiSave backend so the Wema API key is never exposed in browser JavaScript. The raw BVN is never written to the Wema sandbox audit log; sensitive values are redacted before storage. The Bank Integration Lab remains isolated from the OptiSave customer wallet and savings engine.

## UI

Admin -> Bank Integration Lab now includes a dedicated **BVN Tier-1 Account Creation** card with structured fields instead of requiring raw JSON. The response is shown in the sandbox console and any returned tracking/reference ID is copied into the dedicated result field.

## Next mapping

The BVN Step 2 and Step 3 routes will be mapped only after their exact documented endpoint URLs and request models are confirmed. No endpoint paths are guessed.
