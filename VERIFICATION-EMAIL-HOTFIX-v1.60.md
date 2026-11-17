# OptiSave v1.60 Verification Email Hotfix

This hotfix fixes registration/login verification codes not being delivered when v1.59 is configured with `RESEND_API_KEY` + `COMPANY_EMAIL_FROM` but no separate `AUTH_EMAIL_FROM`.

## Fix
Auth OTP delivery now uses the first configured sender from:
1. `AUTH_EMAIL_FROM`
2. `COMPANY_EMAIL_FROM`
3. `BROADCAST_EMAIL_FROM`
4. `EMAIL_FROM`

Recommended production environment:
```env
RESEND_API_KEY=your_real_resend_key
AUTH_EMAIL_FROM=OptiSave <support@myoptisave.site>
COMPANY_EMAIL_FROM=OptiSave <support@myoptisave.site>
BROADCAST_EMAIL_FROM=OptiSave <support@myoptisave.site>
```

The sender domain must be verified with the email provider. Restart/redeploy the server after changing environment variables.
