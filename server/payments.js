const db=require('./db');
const ledger=require('./ledger');

const naira=kobo=>Math.round(Number(kobo||0))/100;

async function settleDeposit(data){
  const reference=String(data?.reference||'');
  if(!reference)return {handled:false};
  const client=await db.pool.connect();
  try{
    await client.query('BEGIN');
    const tx=(await client.query("SELECT * FROM transactions WHERE reference=$1 AND type='Deposit' FOR UPDATE",[reference])).rows[0];
    if(!tx){await client.query('ROLLBACK');return {handled:false,reason:'unknown_reference'}}
    if(tx.status==='completed'){await client.query('COMMIT');return {handled:true,duplicate:true}}
    const expected=Math.round(Number(tx.amount)*100),received=Number(data.amount||0);
    if(String(data.status||'')!=='success'||received!==expected||String(data.currency||'NGN')!=='NGN'){
      await client.query("UPDATE transactions SET status='failed',metadata=metadata||$2::jsonb WHERE id=$1",[tx.id,JSON.stringify({provider_status:data.status||null,provider_amount:received,verification_failed:true})]);
      await client.query('COMMIT');return {handled:true,credited:false};
    }
    const wallet=(await client.query('SELECT * FROM wallets WHERE id=$1 FOR UPDATE',[tx.wallet_id])).rows[0];
    if(!wallet)throw Error('Wallet not found');
    const walletAfter=(await client.query('UPDATE wallets SET available_balance=available_balance+$1,total_deposited=total_deposited+$1,updated_at=NOW() WHERE id=$2 RETURNING *',[tx.amount,wallet.id])).rows[0];
    const updated=(await client.query("UPDATE transactions SET status='completed',metadata=metadata||$2::jsonb WHERE id=$1 RETURNING *",[tx.id,JSON.stringify({provider:'paystack',provider_id:data.id||null,provider_status:'success',paid_at:data.paid_at||data.paidAt||null,channel:data.channel||null})])).rows[0];
    await ledger.append(client,{userId:tx.user_id,walletId:wallet.id,transactionId:tx.id,entryType:'Deposit',direction:'credit',amount:tx.amount,idempotencyKey:`TX_${tx.id}_CREDIT`,before:wallet,after:walletAfter,metadata:{reference:tx.reference,provider:'paystack',providerId:data.id||null}});
    await client.query("INSERT INTO notifications(user_id,title,message,type,action_url,source_transaction_id) VALUES($1,'Deposit successful',$2,'success','transactions.html',$3) ON CONFLICT (source_transaction_id) WHERE source_transaction_id IS NOT NULL DO NOTHING",[tx.user_id,`₦${Number(tx.amount).toLocaleString('en-NG',{minimumFractionDigits:2})} was added to your available balance.`,tx.id]);
    await client.query('COMMIT');return {handled:true,credited:true,transaction:updated};
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}

async function settleTransfer(event,data){
  const reference=String(data?.reference||'');
  if(!reference)return {handled:false};
  const client=await db.pool.connect();
  try{
    await client.query('BEGIN');
    const tx=(await client.query("SELECT * FROM transactions WHERE reference=$1 AND type='Withdrawal' FOR UPDATE",[reference])).rows[0];
    if(!tx){await client.query('ROLLBACK');return {handled:false,reason:'unknown_reference'}}
    const wallet=(await client.query('SELECT * FROM wallets WHERE id=$1 FOR UPDATE',[tx.wallet_id])).rows[0];
    if(!wallet)throw Error('Wallet not found');
    if(event==='transfer.success'){
      if(tx.status==='completed'){await client.query('COMMIT');return {handled:true,duplicate:true}}
      if(['failed','reversed'].includes(tx.status)){await client.query('COMMIT');return {handled:true,ignored:true}}
      const walletAfter=(await client.query('UPDATE wallets SET total_withdrawn=total_withdrawn+$1,updated_at=NOW() WHERE id=$2 RETURNING *',[tx.amount,wallet.id])).rows[0];
      await client.query("UPDATE transactions SET status='completed',metadata=metadata||$2::jsonb WHERE id=$1",[tx.id,JSON.stringify({provider:'paystack',provider_status:'success',transfer_code:data.transfer_code||null,needs_reconciliation:false})]);
      await ledger.append(client,{userId:tx.user_id,walletId:wallet.id,transactionId:tx.id,entryType:'Withdrawal Settled',direction:'internal',amount:tx.amount,idempotencyKey:`WITHDRAWAL_SETTLED_${tx.id}`,before:wallet,after:walletAfter,metadata:{reference:tx.reference,provider:'paystack',transferCode:data.transfer_code||null,noAvailableMovement:true}});
      await client.query("INSERT INTO notifications(user_id,title,message,type,action_url,source_transaction_id) VALUES($1,'Withdrawal successful',$2,'success','transactions.html',$3) ON CONFLICT (source_transaction_id) WHERE source_transaction_id IS NOT NULL DO UPDATE SET title=EXCLUDED.title,message=EXCLUDED.message,type=EXCLUDED.type,is_read=false,created_at=NOW()",[tx.user_id,`₦${Number(tx.amount).toLocaleString('en-NG',{minimumFractionDigits:2})} was sent to your verified bank account.`,tx.id]);
    }else if(event==='transfer.failed'||event==='transfer.reversed'){
      if(['failed','reversed'].includes(tx.status)){await client.query('COMMIT');return {handled:true,duplicate:true}}
      if(event==='transfer.failed'&&tx.status==='completed'){await client.query('COMMIT');return {handled:true,ignored:true}}
      const finalStatus=event==='transfer.reversed'?'reversed':'failed';
      let walletAfter;
      if(event==='transfer.reversed'&&tx.status==='completed') walletAfter=(await client.query('UPDATE wallets SET available_balance=available_balance+$1,total_withdrawn=GREATEST(0,total_withdrawn-$1),updated_at=NOW() WHERE id=$2 RETURNING *',[tx.amount,wallet.id])).rows[0];
      else walletAfter=(await client.query('UPDATE wallets SET available_balance=available_balance+$1,updated_at=NOW() WHERE id=$2 RETURNING *',[tx.amount,wallet.id])).rows[0];
      await client.query('UPDATE transactions SET status=$2,metadata=metadata||$3::jsonb WHERE id=$1',[tx.id,finalStatus,JSON.stringify({provider:'paystack',provider_status:finalStatus,provider_reason:data.reason||data.failures||null,refunded:true,needs_reconciliation:false})]);
      await ledger.append(client,{userId:tx.user_id,walletId:wallet.id,transactionId:tx.id,entryType:'Withdrawal Refund',direction:'credit',amount:tx.amount,idempotencyKey:`WITHDRAWAL_REFUND_${tx.id}`,before:wallet,after:walletAfter,metadata:{reference:tx.reference,provider:'paystack',finalStatus,reason:data.reason||data.failures||null}});
      await client.query("INSERT INTO notifications(user_id,title,message,type,action_url,source_transaction_id) VALUES($1,'Withdrawal returned',$2,'warning','transactions.html',$3) ON CONFLICT (source_transaction_id) WHERE source_transaction_id IS NOT NULL DO UPDATE SET title=EXCLUDED.title,message=EXCLUDED.message,type=EXCLUDED.type,is_read=false,created_at=NOW()",[tx.user_id,`The ₦${Number(tx.amount).toLocaleString('en-NG',{minimumFractionDigits:2})} withdrawal could not be completed and was returned to your available balance.`,tx.id]);
    }
    await client.query('COMMIT');return {handled:true};
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}

module.exports={settleDeposit,settleTransfer,naira};
