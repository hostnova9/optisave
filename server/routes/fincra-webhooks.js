const r=require('express').Router(),fincra=require('../fincra-sandbox');
r.post('/',async(req,res)=>{const raw=Buffer.isBuffer(req.body)?req.body:Buffer.from(JSON.stringify(req.body||{}));let payload={};try{payload=JSON.parse(raw.toString('utf8')||'{}')}catch(_){return res.sendStatus(400)}const sig=String(req.headers.signature||'');const valid=fincra.validateWebhook(raw,sig);await fincra.log({action:'webhook',ok:valid,response:payload,eventType:'callback',signatureValid:valid});if(!valid)return res.sendStatus(401);return res.status(200).json({ok:true})});
module.exports=r;
