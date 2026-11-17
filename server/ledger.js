const n=v=>Math.round(Number(v||0)*100)/100;

function snapshot(row){
  if(!row)return {available:null,locked:null};
  return {available:n(row.available_balance),locked:n(row.total_locked)};
}

async function wallet(client,walletId){
  if(!walletId)return null;
  return (await client.query('SELECT * FROM wallets WHERE id=$1',[walletId])).rows[0]||null;
}

async function append(client,{userId,walletId=null,planId=null,transactionId=null,entryType,direction,amount=0,idempotencyKey,before=null,after=null,metadata={}}){
  if(!userId||!entryType||!idempotencyKey)throw Error('Ledger entry is missing required identity fields');
  const b=snapshot(before),a=snapshot(after);
  const params=[userId,walletId,planId,transactionId,String(entryType).slice(0,100),direction,n(amount),b.available,a.available,b.locked,a.locked,String(idempotencyKey).slice(0,200),JSON.stringify(metadata||{})];
  const q=await client.query(`INSERT INTO financial_ledger(user_id,wallet_id,plan_id,transaction_id,entry_type,direction,amount,available_before,available_after,locked_before,locked_after,idempotency_key,metadata)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(idempotency_key) DO NOTHING RETURNING *`,params);
  if(q.rows[0])return {entry:q.rows[0],duplicate:false};
  const existing=(await client.query('SELECT * FROM financial_ledger WHERE idempotency_key=$1',[String(idempotencyKey).slice(0,200)])).rows[0];
  if(!existing)throw Error('Unable to verify financial ledger entry');
  if(Number(existing.user_id)!==Number(userId)||n(existing.amount)!==n(amount)||String(existing.direction)!==String(direction)){
    const e=Error('Financial ledger idempotency conflict');e.code='LEDGER_IDEMPOTENCY_CONFLICT';throw e;
  }
  return {entry:existing,duplicate:true};
}

module.exports={append,wallet,snapshot,n};
