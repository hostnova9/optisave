'use strict';
// Run ONLY after stopping the site (Ctrl+C). PGlite must not be open in two processes.
require('dotenv').config();
if (String(process.env.LOCAL_DATABASE||'').toLowerCase()!=='pglite') {
  console.error('This backup tool only works in PGlite local mode.');
  process.exit(1);
}
const db = require('../server/db');
(async()=>{
 try { console.log('Backup saved:', await db.backup()); await db.close(); }
 catch(e){ console.error('Backup failed:',e.message); await db.close().catch(()=>{});process.exitCode=1; }
})();
