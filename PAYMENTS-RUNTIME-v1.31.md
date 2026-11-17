# OptiSave v1.31 — Paystack Payment Runtime Fix

- Built from v1.30 master.
- Keeps Daily Savings calendar guard and v1.29 Paystack backend.
- Normal Deposit UI now shows Paystack Secure Payment instead of the legacy Development Mode label.
- Deposit page cache-busts the canonical API/payment scripts with v1.31.
- Payment pages and payment runtime assets are served with `Cache-Control: no-store` to prevent stale browser/CDN payment JavaScript.
- Deposit runtime checks that `OptiSaveAPI.initializeDeposit` is actually loaded before attempting payment.
- Development wallet endpoints remain backend-only and are not presented as the normal customer deposit method.
