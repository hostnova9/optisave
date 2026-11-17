# OptiSave v1.14 — Paystack KYC test bank UI

The provider identity verification bank dropdown now displays each Paystack bank code.
When Paystack returns a bank entry with code `007`, OptiSave labels it `TEST KYC`, preselects it, and displays a test-mode hint.

This is a development/testing convenience only. The actual bank list and codes still come from Paystack through `/api/banks`.
