"use strict";
const fs=require('fs');const path=require('path');
const file=path.resolve(__dirname,'../.env');
const text=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
if (!/^\s*LOCAL_DATABASE\s*=\s*pglite\s*$/mi.test(text) || !/^\s*PAYMENT_MODE\s*=\s*test\s*$/mi.test(text)) {
 console.error('Expected a local PGlite testing configuration. Run: node scripts/setup-local.js');
 process.exit(1);
}
