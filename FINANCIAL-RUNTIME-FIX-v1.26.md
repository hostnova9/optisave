# OptiSave v1.26 — Allocation Center runtime repair

- Restores a compatibility `normalizeAllocationPlan()` helper in the shared PostgreSQL state facade.
- Allocation Center explicitly refreshes PostgreSQL state before selecting/rendering active allocation plans.
- Allocation Center assets are versioned to prevent an older cached JavaScript file from being executed after deployment.
- HTML/JS/CSS responses now require browser revalidation, reducing stale frontend code after a project replacement.
- No wallet balance or plan money is changed by this frontend repair.
