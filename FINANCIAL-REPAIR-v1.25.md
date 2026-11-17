# OptiSave v1.25 — Legacy Allocation Schedule Repair

This build repairs active Lock & Allocation plans created by older builds when their money values exist in PostgreSQL but canonical scheduler fields (`schedule_total_events`, `event_amount`, `next_event_at`) are missing.

`npm run db:init` derives schedule data from the existing plan/legacy metadata and does not debit, credit, release, or otherwise move money. The normal financial engine remains responsible for releases after initialization.
