# OptiSave v1.64 — Company Mailer send reliability

- Adds a 32-second browser request timeout so the Send button cannot spin indefinitely.
- Adds a unique request ID for each official send to prevent accidental duplicate emails after a timeout/retry.
- Returns to the browser immediately after the email provider accepts the message; slow history/contact DB updates run afterward.
- Adds server-side mail delivery phase logs for Render diagnostics.
- Tightens the Resend provider timeout to 18 seconds.
- Keeps the existing Reply-To default: optisavesolution@gmail.com.

If a timeout occurs, do not create a fresh send immediately. Check Sent Company Mail and Render logs first. Reusing the same open confirmation will not duplicate a message already being processed.
