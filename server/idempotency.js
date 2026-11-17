const crypto=require('crypto');

function stable(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
}
function requestHash(req){
  const body={...(req.body||{})};delete body.idempotencyKey;
  return crypto.createHash('sha256').update(stable(body)).digest('hex');
}
function key(req){return String(req.get?.('Idempotency-Key')||req.body?.idempotencyKey||'').trim()}

async function begin(client,req,action,{required=true}={}){
  const k=key(req);
  if(!k){if(required){const e=Error('A request idempotency key is required. Refresh the page and try again.');e.status=400;throw e}return {enabled:false}}
  if(k.length>160||!/^[A-Za-z0-9._:-]+$/.test(k)){const e=Error('Invalid request idempotency key.');e.status=400;throw e}
  const h=requestHash(req),userId=Number(req.user?.sub);
  const ins=await client.query(`INSERT INTO idempotency_requests(user_id,action,idempotency_key,request_hash) VALUES($1,$2,$3,$4)
    ON CONFLICT(user_id,action,idempotency_key) DO NOTHING RETURNING *`,[userId,action,k,h]);
  if(ins.rows[0])return {enabled:true,key:k,hash:h,userId,action,replayed:false};
  const row=(await client.query('SELECT * FROM idempotency_requests WHERE user_id=$1 AND action=$2 AND idempotency_key=$3 FOR UPDATE',[userId,action,k])).rows[0];
  if(!row){const e=Error('Unable to verify the request.');e.status=409;throw e}
  if(row.request_hash!==h){const e=Error('This request key was already used for different information. Please try again.');e.status=409;throw e}
  if(row.completed_at&&row.response_body)return {enabled:true,key:k,hash:h,userId,action,replayed:true,statusCode:row.status_code||200,response:row.response_body};
  const e=Error('This financial request is already being processed. Please check its status before retrying.');e.status=409;throw e;
}
async function finish(client,claim,statusCode,response){
  if(!claim?.enabled)return;
  await client.query(`UPDATE idempotency_requests SET status_code=$1,response_body=$2::jsonb,completed_at=NOW() WHERE user_id=$3 AND action=$4 AND idempotency_key=$5`,[statusCode,JSON.stringify(response||{}),claim.userId,claim.action,claim.key]);
}
async function refresh(pool,userId,action,k,statusCode,response){
  if(!k)return;
  await pool.query(`UPDATE idempotency_requests SET status_code=$1,response_body=$2::jsonb,completed_at=NOW() WHERE user_id=$3 AND action=$4 AND idempotency_key=$5`,[statusCode,JSON.stringify(response||{}),userId,action,k]);
}
module.exports={begin,finish,refresh,key,requestHash};
