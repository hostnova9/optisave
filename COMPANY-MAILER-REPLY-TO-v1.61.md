# OptiSave v1.61 — Company Mailer Reply-To

- Company Mailer now has a visible **Reply-To** field.
- Default Reply-To is `optisavesolution@gmail.com`.
- Recipients still see the official verified OptiSave sender configured by `COMPANY_EMAIL_FROM`.
- When the recipient presses Reply, the response is addressed to the Reply-To address.
- The Reply-To can be changed per message in Admin.
- Optional Render/.env setting: `COMPANY_EMAIL_REPLY_TO=optisavesolution@gmail.com`.
- Server validates the Reply-To address before sending.

This update does not change authentication emails, broadcast messages, payment logic, savings logic, or the financial ledger.
