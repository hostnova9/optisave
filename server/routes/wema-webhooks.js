const r=require('express').Router(),wema=require('../wema-sandbox');

r.post('/wallet',async(req,res)=>{
  try{await wema.log({action:'wallet_callback',ok:true,response:req.body||{},eventType:'callback'});res.status(200).json({ok:true})}
  catch(e){console.error('[WEMA_WALLET_CALLBACK_FAILED]',e.message);res.status(200).json({ok:true})}
});
r.post('/transaction',async(req,res)=>{
  try{await wema.log({action:'transaction_callback',ok:true,response:req.body||{},eventType:'callback'});res.status(200).json({ok:true})}
  catch(e){console.error('[WEMA_TRANSACTION_CALLBACK_FAILED]',e.message);res.status(200).json({ok:true})}
});
r.post('/authorize',async(req,res)=>{
  const body=req.body||{},transactionReference=String(body.transactionReference||body.transactionRef||body.reference||'').trim(),securityInfo=String(body.securityInfo||'').trim();
  let authorized=false;try{authorized=await wema.authorize(transactionReference,securityInfo);await wema.log({action:'authorization_callback',ok:authorized,response:{transactionReference,authorized},eventType:'callback'})}catch(e){console.error('[WEMA_AUTH_CALLBACK_FAILED]',e.message)}
  res.status(200).json({transactionReference,authorized});
});
module.exports=r;
