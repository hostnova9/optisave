# OptiSave v1.63 — Company Mailer Send Reliability Hotfix

- Shows provider errors inside the confirmation modal instead of hiding them behind the overlay.
- Shows visible sending progress.
- Adds a 25-second timeout to the Resend API request so the UI cannot wait forever.
- Adds a safe Render log entry on mail delivery failure.
- Cache-busts admin mailer JavaScript to v1.63.
- Does not modify savings, wallet, Paystack, KYC, or ledger logic.
