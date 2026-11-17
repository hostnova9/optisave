# OptiSave v1.46 — Compact Savings Flow & Canonical Allocation Schedule

- Create Plan redesigned with adviser-image background and three compact responsive plan cards.
- Lock Only redesigned into a compact two-column desktop flow with dropdown duration and sticky smart summary.
- Lock & Allocation purpose, duration, allocation percentage, and start mode use compact dropdown controls.
- Lock & Allocation includes a live smart summary and retains 10–80% allocation rules.
- Daily Savings shares the same adviser-image/cloud-blue visual treatment.
- Allocation Center cards are more compact to reduce unnecessary scrolling.
- PostgreSQL `next_event_at` is the single source of truth for allocation timing across Dashboard and Allocation Center.
- New and future allocation schedule calculations use 05:00 Africa/Lagos explicitly, independent of server timezone.
- `npm run db:init` safely canonicalizes existing active allocation `next_event_at` times to 05:00 Africa/Lagos without moving money.
