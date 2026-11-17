"use strict";
// Create an isolated local PGlite test configuration. Existing remote
// configuration is preserved outside the website project, never overwritten.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const configFile = path.resolve(__dirname, '..', '.env');
const isLocal = (s) => /^\s*LOCAL_DATABASE\s*=\s*pglite\s*$/mi.test(s)
  && /^\s*PAYMENT_MODE\s*=\s*test\s*$/mi.test(s);
if (fs.existsSync(configFile)) {
  const current = fs.readFileSync(configFile, 'utf8');
  if (isLocal(current)) {
    console.log('OptiSave local test configuration is ready (existing .env kept).');
    process.exit(0);
  }
  // Securely preserve the old configuration separately. The old database,
  // payments and API keys are NEVER copied into the new local test config.
  const oldConfigsDir = path.join(os.homedir(), 'OptiSave-Private-Configuration-Backups');
  fs.mkdirSync(oldConfigsDir, {recursive:true, mode:0o700});
  let dest;
  do {
    dest = path.join(oldConfigsDir,
      'previous-env-' + new Date().toISOString().replace(/[:.]/g,'-') + '-' + crypto.randomBytes(3).toString('hex') + '.txt');
  } while (fs.existsSync(dest));
  fs.copyFileSync(configFile, dest, fs.constants.COPYFILE_EXCL);
  if (fs.readFileSync(dest,'utf8') !== current) throw new Error('Could not verify previous configuration backup; original untouched.');
  fs.unlinkSync(configFile);
  console.log('Old .env preserved OUTSIDE OptiSave in: ' + oldConfigsDir);
  console.log('The prior database was not changed or deleted.');
}
const adminPassword = crypto.randomBytes(20).toString('base64url');
const jwt = crypto.randomBytes(48).toString('hex');
const env = [
  'NODE_ENV=development',
  'PORT=30006',
  'LOCAL_DATABASE=pglite',
  'PAYMENT_MODE=test',
  'ENABLE_DEV_WALLET=true',
  'FINCRA_SANDBOX_ENABLED=false',
  'WEMA_SANDBOX_ENABLED=false',
  'DB_SSL=false',
  'JWT_SECRET=' + jwt,
  'JWT_EXPIRES_IN=7d',
  'ADMIN_EMAIL=admin@optisave.local',
  'ADMIN_PASSWORD=' + adminPassword,
  'ADMIN_NAME=OptiSave Local Administrator',
  'ADMIN_JWT_EXPIRES_IN=8h',
].join('\n') + '\n';
fs.writeFileSync(configFile, env, { flag: 'wx', mode: 0o600 });
console.log('A fresh test-only .env was generated. Render is no longer used by this copy.');
console.log('Local administrator: admin@optisave.local');
console.log('Local administrator initial password (SAVE PRIVATELY): ' + adminPassword);
console.log('Do not send screenshots containing this password.');
