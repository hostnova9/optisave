const assert=require('assert');
const pm=require('./payment-mode');

const saved={...process.env};
const fakeDb=email=>({query:async()=>({rows:[{email}]})});
function reset(){for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}

(async()=>{
 try{
  process.env.PAYMENT_MODE='test';process.env.PAYSTACK_SECRET_KEY='sk_test_demo';delete process.env.LIVE_PAYMENT_ALLOWLIST;
  assert.deepStrictEqual(pm.validateConfiguration(),{mode:'test',keyKind:'test'});
  assert.strictEqual((await pm.statusForUser(fakeDb('any@example.com'),1)).canUsePayments,true);

  process.env.PAYMENT_MODE='pilot';process.env.PAYSTACK_SECRET_KEY='sk_live_demo';process.env.LIVE_PAYMENT_ALLOWLIST='owner@example.com';process.env.LIVE_DEPOSIT_MAX='5000';process.env.LIVE_WITHDRAWAL_MAX='3000';
  assert.deepStrictEqual(pm.validateConfiguration(),{mode:'pilot',keyKind:'live'});
  let s=await pm.statusForUser(fakeDb('OWNER@example.com'),1);assert.strictEqual(s.canUsePayments,true);assert.strictEqual(s.depositMax,5000);assert.strictEqual(s.withdrawalMax,3000);
  s=await pm.statusForUser(fakeDb('other@example.com'),2);assert.strictEqual(s.canUsePayments,false);
  await assert.rejects(()=>pm.assertPaymentAccess(fakeDb('owner@example.com'),1,'deposit',5001),/pilot deposit limit/i);
  await assert.rejects(()=>pm.assertPaymentAccess(fakeDb('other@example.com'),2,'withdrawal',100),/controlled testing/i);

  process.env.PAYMENT_MODE='test';process.env.PAYSTACK_SECRET_KEY='sk_live_demo';
  assert.throws(()=>pm.validateConfiguration(),/cannot run with a live Paystack secret key/i);

  process.env.PAYMENT_MODE='pilot';process.env.PAYSTACK_SECRET_KEY='sk_test_demo';process.env.LIVE_PAYMENT_ALLOWLIST='owner@example.com';
  assert.throws(()=>pm.validateConfiguration(),/requires a Paystack live secret key/i);

  console.log('OptiSave v1.57 payment pilot guard checks passed.');
 }finally{reset()}
})().catch(e=>{reset();console.error(e);process.exit(1)});
