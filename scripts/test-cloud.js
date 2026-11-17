const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
require('./build-public');
const root=path.resolve(__dirname,'..');const dist=path.join(root,'dist');
for(const n of ['.env','server','database','scripts','package.json','wrangler.jsonc'])assert(!fs.existsSync(path.join(dist,n)));
for(const n of ['index.html','admin.html','wallet-deposit.html','css','js','images'])assert(fs.existsSync(path.join(dist,n)));
const w=JSON.parse(fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8'));
assert.equal(w.vars.PAYMENT_MODE,'test');assert.equal(w.vars.ENABLE_DEV_WALLET,'false');assert.equal(w.vars.NODE_ENV,'production');assert(w.assets.run_worker_first);assert(w.triggers.crons.includes('* * * * *'));
require('../server/readiness-test');
console.log('Cloud configuration, assets and existing readiness checks passed (not a deployed runtime test).');
