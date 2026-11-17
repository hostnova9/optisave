# OptiSave v1.43 — Dashboard Focus & State Freshness

- Removed duplicate Activity Timeline from Dashboard; Transactions remains the financial history source.
- Removed the default visible “Success” toast placeholder.
- Hid the phone number from the Profile summary card.
- Added immediate dashboard rerender when PostgreSQL state changes.
- Added refresh on page focus, visibility return and browser back/forward restoration.
- Added a lightweight 5-second visible-page synchronization for changes made from another device/session.
- Kept the 60-second server financial scheduler concept separate from normal UI freshness.
- Compacted mobile summary cards and made the sidebar light/readable.
