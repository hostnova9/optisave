# OptiSave v1.40 — Security & Mobile UX

- Branded OptiSave HTML templates for verification, login, password reset and PIN-reset email codes.
- Spam/Junk guidance remains on the website verification screens, not inside delivered emails.
- Registration activation creates a real authenticated session and an Account Activated notification, then continues to the one-time Welcome experience.
- Login OTP now uses a dedicated login verification page.
- Active Devices and Security Activity use PostgreSQL-backed real session/event data; hard-coded device/activity samples were removed.
- Device descriptions are deliberately general when browsers do not reliably expose an exact model.
- Personal-information changes require the transaction PIN.
- Password changes require the transaction PIN and invalidate active sessions.
- Transaction-PIN changes require a fresh email OTP.
- Bank/withdrawal-recipient changes and provider KYC verification require the transaction PIN.
- Fake biometric toggles were removed. The UI now clearly reserves biometric login for a future standards-based passkey/WebAuthn implementation.
- Sidebar contrast changed to white/cloud-blue with dark readable text and OptiSave blue states.
- Mobile dashboard summary cards are more compact and use a two-column layout where appropriate.
