# OptiSave v1.41 — Multi-User Testing UX

- Login OTP is a dedicated `login-verify.html` step; `login.html` contains only email/password.
- Static HTML/CSS/JS are served `no-store` during active testing to prevent stale mobile UI.
- Dashboard mobile summary is compact: balance and active plans share a two-column row on normal phones; next allocation spans the row.
- Sidebar is white/cloud-blue with dark navy text and high-contrast OptiSave-blue active states.
- Real account sessions/security activity remain PostgreSQL-backed; no device-model guessing.
- Existing v1.40 PIN/OTP security protections and v1.40.1 Paystack webhook fix are preserved.
