# OptiSave v1.56 — Create-Plan Summary Fix

- Fixed the blank **Lock Summary** on the Lock Only creation page.
- Fixed the blank **Saving Summary** on the Daily Savings creation page.
- Root cause: the global dashboard `.summary-card` rule used `!important` and forced these form summaries to a white background while their text remained white.
- Form summaries now use page-specific classes (`lock-live-summary` and `daily-live-summary`) so dashboard/global summary styles cannot collide with them.
- Added CSS cache-busting (`?v=1.56`) for both pages so mobile browsers fetch the corrected styles.
- v1.55 dashboard summary changes were intentionally not carried forward; v1.56 is based on v1.54 Production Readiness plus this form-summary correction.
