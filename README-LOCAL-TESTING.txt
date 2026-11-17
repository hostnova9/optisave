OPTISAVE — CLEAN LOCAL DATABASE TEST BUILD (2026-10-21)

WHAT CHANGED
- This package is built from the previously verified OptiSave local preview.
- Excludes the enormous, incomplete PostgreSQL/pgAdmin folder and any .env secrets.
- Node startup checks the local configuration automatically. If a previous
  Render-linked .env is present, it is copied first to a PRIVATE folder under
  your Windows user home (OptiSave-Private-Configuration-Backups), removed from
  this project, and replaced with NEW LOCAL test-only credentials.
- Local PGlite database files will live at database/optisave-pglite/.
- Previous data from Render is NOT copied into this local database.

HOW TO START ON WINDOWS
1. Keep your old OptiSave installation as a backup; unzip this into a NEW folder.
2. Open CMD in the NEW folder and run: npm install
3. Run: npm run test:local
4. Run: npm start (or double-click START-OPTISAVE.bat).
5. Note down the one-time generated local admin password PRIVATELY.
6. Visit http://localhost:30006 to try your site.
7. Run the user and admin workflows with FAKE TEST BALANCES only.

MOVING TO ANOTHER WINDOWS PC
1. Press CTRL+C in OptiSave's running CMD and wait for 'Local database closed'.
2. For an additional backup, run BACKUP-OPTISAVE.bat with the site stopped.
3. Copy the complete OptiSave project INCLUDING the private database/optisave-pglite
   and database/backups directories, and its .env, using secure removable storage.
4. On the next compatible PC install Node.js if needed, npm install, npm start.
5. Keep a separate encrypted backup offline. Never upload backups or .env.

VERIFICATION NOTICE
- The uploaded 358 MB OptiSave.zip is INCOMPLETE (missing ZIP central directory).
  Its available code matched the earlier clean project files byte-for-byte.
- Code is statically checked, but packages were not accessible to run a real
  PGlite or end-to-end financial regression test in this environment.
- TEST ONLY: do not expose this app via a public Cloudflare tunnel or enable
  live payments or real customer savings.
- Rotate any API, admin or database credentials exposed by previous screenshots.
