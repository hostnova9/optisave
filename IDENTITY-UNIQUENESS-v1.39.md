# OptiSave v1.39 — Identity uniqueness and cloud-blue UI

- Email remains unique at PostgreSQL level.
- Phone numbers are normalized and uniquely reserved for new registrations.
- BVN and bank account details are never stored raw for duplicate detection. HMAC-SHA256 fingerprints are stored instead.
- A BVN or verified-bank identity cannot be reserved by two users at the same time.
- Failed provider verification releases the identity fingerprints so legitimate corrections can be retried.
- Duplicate errors do not disclose another customer's personal details.
- Sidebar and global background use the OptiSave light-blue/cloud-white visual system.
