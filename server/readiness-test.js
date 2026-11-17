const assert=require('assert');
const fs=require('fs');
const path=require('path');
const schedule=require('./schedule');
const idem=require('./idempotency');

function hours(a,b){return Math.round(((b-a)/3600000)*100)/100}

// Weekend timing: exact remaining real time, not a hard-coded weekend duration.
{
  const sat=new Date('2026-09-26T13:00:00+01:00');
  const due=schedule.firstFutureFive(sat,true,sat);
  assert.strictEqual(due.toISOString(),'2026-09-28T04:00:00.000Z');
  assert.strictEqual(hours(sat,due),40);
  const sun=new Date('2026-09-27T13:00:00+01:00');
  const due2=schedule.firstFutureFive(sun,true,sun);
  assert.strictEqual(hours(sun,due2),16);
}

// Weekly allocations stay weekly after the first eligible 05:00 anchor.
{
  const monday=new Date('2026-09-28T05:00:00+01:00');
  const next=schedule.nextAllocationEvent(monday,'weekly',true);
  assert.strictEqual(next.toISOString(),'2026-10-05T04:00:00.000Z');
}

// Request hashes are deterministic even if object key order changes.
{
  const a={body:{amount:1000,note:'x'},user:{sub:1}};
  const b={body:{note:'x',amount:1000},user:{sub:1}};
  const c={body:{note:'x',amount:1001},user:{sub:1}};
  assert.strictEqual(idem.requestHash(a),idem.requestHash(b));
  assert.notStrictEqual(idem.requestHash(a),idem.requestHash(c));
}

const root=path.join(__dirname,'..');
const schema=fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8');
const engine=fs.readFileSync(path.join(__dirname,'financial-engine.js'),'utf8');
const payments=fs.readFileSync(path.join(__dirname,'payments.js'),'utf8');
const account=fs.readFileSync(path.join(__dirname,'routes','account.js'),'utf8');
const api=fs.readFileSync(path.join(root,'js','api.js'),'utf8');

assert(schema.includes('CREATE TABLE IF NOT EXISTS financial_ledger'));
assert(schema.includes('CREATE TABLE IF NOT EXISTS idempotency_requests'));
assert(schema.includes('CREATE TABLE IF NOT EXISTS financial_engine_state'));
assert(schema.includes('NOT EXISTS (SELECT 1 FROM financial_ledger existing WHERE existing.transaction_id=t.id)'));
assert(engine.includes('ledger.append'));
assert(payments.includes('ledger.append'));
assert(account.includes('ledger.append'));
assert(account.includes("idem.begin(client,req,'create-plan')"));
assert(account.includes("idem.begin(client,req,'withdrawal:create')"));
assert(account.includes("needs_reconciliation:true"));
assert(account.includes("Withdrawal awaiting confirmation"));
assert(api.includes('financialRequest("create-plan"'));
assert(api.includes('financialRequest("withdrawal"'));

console.log('OptiSave v1.54 readiness checks passed.');
