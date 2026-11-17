'use strict';
require('dotenv').config();
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const db=require('../server/db');
(async()=>{
 try {
  if(db.kind!=='pglite')throw Error('LOCAL_DATABASE=pglite is not enabled');
  await db.query(fs.readFileSync(path.join(__dirname,'../server/schema.sql'),'utf8'));
  const names=(await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")).rows.map(x=>x.table_name);
  for (const table of ['users','wallets','plans','transactions','financial_ledger','daily_saving_events','admins']) {
   if(!names.includes(table))throw Error('Missing table: '+table);
  }
  const mark='local-test-'+crypto.randomUUID()+'@example.invalid';
  const c=await db.pool.connect();
  try {
   await c.query('BEGIN');
   await c.query('INSERT INTO company_contacts(company_name,email) VALUES($1,$2)', ['Temporary smoke test',mark]);
   const probe=await c.query('SELECT id FROM company_contacts WHERE email=$1',[mark]);
   if(probe.rowCount!==1)throw Error('Uncommitted read failed');
   await c.query('ROLLBACK');
  } finally {c.release()}
  const check=await db.query('SELECT id FROM company_contacts WHERE email=$1',[mark]);
  if(check.rowCount)throw Error('ROLLBACK did not work');
  console.log('PASS: schema loaded, basic SQL queries and transaction rollback work.');
  console.log('Still manually test registration, KYC, wallet, scheduled saving and withdrawals before use.');
 } catch (err) {console.error('FAIL:',err?.stack||err);process.exitCode=1;}
 finally {if(typeof db.close === 'function') await db.close().catch(e=>console.error('Close failed',e)); else if(typeof db.pool?.end === 'function') await db.pool.end().catch(()=>{});}
})();
