# OptiSave v1.59 — Company Mailer & Partner Outreach

This build extends v1.58 without changing the savings engine, financial ledger, payment mode guard, KYC flow, Daily Savings scheduler, Lock Only or Lock & Allocation rules.

## New Company Mailer
Admin → Company Mailer now supports:
- Official branded external emails for banks, partners, investors and support correspondence.
- OptiSave logo, banner, colors, company name, RC number, website, support email and director signature.
- Formal, Partnership, Investor, Support and General layouts.
- Built-in templates, including Bank Follow-Up / Regulatory Clarification and Banking Partnership Introduction.
- To, CC and BCC fields.
- PDF, DOC/DOCX, PNG/JPG and TXT attachments (maximum 5 files / 7 MB total).
- Preview before sending.
- Send Test to support@myoptisave.site or another email before sending externally.
- Final OptiSave confirmation modal instead of browser confirmation.
- Sent-mail history with provider status and attachment count.

## Bank / Partner Outreach Tracker
The same admin section now has a contact tracker for:
- Bank/company name
- Contact person
- Official email
- Status: Not contacted, Email sent, Replied, Meeting, Follow-up or Closed
- Optional follow-up date and notes
- One-click “Use” to insert a saved contact into the Company Mailer
- Successful sends automatically mark a matching new contact as contacted

## Brand & Signature Settings
Admin can update:
- Company name
- RC number
- Official support email
- Website
- Logo URL/path
- Tagline
- Sender name/title
- Primary/accent colors

Default production identity:
- OptiSave Digital Solutions Ltd
- RC 9899018
- support@myoptisave.site
- https://myoptisave.site

## Email provider
The Company Mailer uses the existing Resend integration. Configure server-side only:

RESEND_API_KEY=...
COMPANY_EMAIL_FROM=OptiSave <support@myoptisave.site>
APP_BASE_URL=https://myoptisave.site

BROADCAST_EMAIL_FROM remains supported. COMPANY_EMAIL_FROM takes precedence for official external mail.

Your sending domain must be verified with the provider before mail can be sent from support@myoptisave.site.

## Safety
- Secret/API keys remain server-side.
- External links are restricted to http/https.
- Message content is HTML-escaped before being placed into the branded email template.
- Attachments are size/type checked server-side.
- Admin authentication is required for all Company Mailer endpoints.
