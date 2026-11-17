# OptiSave v1.70 — Focused Admin Workspace + Fincra-Only Lab

- Removed the Wema sandbox integration from the active OptiSave runtime and Admin UI.
- Bank Integration Lab is now a dedicated Fincra Sandbox workspace.
- Admin sidebar is grouped into Workspace, Customers & Plans, Money Movement, Integrations, Communications, and System.
- Clicking a sidebar item now opens only that section instead of stacking every admin section on one long page.
- Added clearer active navigation state, sticky section header, and mobile-friendly workspace routing.
- Fincra connection test now authenticates with `/profile/business/me` and can auto-detect the Business ID for the running server session.
- Added a separate NGN bank directory test.
- Fincra remains sandbox-only and isolated from OptiSave customer balances.
