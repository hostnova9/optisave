# OptiSave v1.65 – Company Mailer Reply-To Rollback

This build restores the original Company Mailer reply behavior.

- Removed the custom Reply-To field from the admin Company Mailer.
- Company emails are sent from the configured OptiSave corporate sender.
- Recipients reply to the same sender address, as before v1.61.
- Preserves the Keystone strategic follow-up template from v1.62.
- Preserves the v1.64 send timeout, idempotency and reliability logging.
- No savings, wallet, Paystack, verification, plan, or ledger logic was changed.

Recommended environment configuration:

```env
COMPANY_EMAIL_FROM=OptiSave <support@myoptisave.site>
AUTH_EMAIL_FROM=OptiSave <support@myoptisave.site>
BROADCAST_EMAIL_FROM=OptiSave <support@myoptisave.site>
```

`COMPANY_EMAIL_REPLY_TO` is no longer used by the Company Mailer.
