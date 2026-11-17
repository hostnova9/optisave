"use strict";
const jwt=require('jsonwebtoken');
const db=require('../db');
module.exports=async(req,res,next)=>{
 const h=String(req.headers.authorization||'');
 const token=h.startsWith('Bearer ')?h.slice(7):'';
 if(!token)return res.status(401).json({error:'Admin authentication required'});
 try{
  const payload=jwt.verify(token,process.env.JWT_SECRET);
  if(payload.scope!=='admin'||!/^\d+$/.test(String(payload.sub||'')))return res.status(401).json({error:'Invalid admin session'});
  const row=(await db.query('SELECT id,email,full_name,role,status,must_change_password,session_version FROM admins WHERE id=$1',[payload.sub])).rows[0];
  if(!row||row.status!=='active'||Number(row.session_version)!==Number(payload.sv||0))return res.status(401).json({error:'Admin access revoked or session expired'});
  if(!['super_admin','support_agent','personal_assistant'].includes(row.role))return res.status(403).json({error:'Unknown administrator role'});
  req.admin={sub:String(row.id),email:row.email,fullName:row.full_name,role:row.role,mustChangePassword:!!row.must_change_password};
  next();
 }catch(e){if(e?.name==='TokenExpiredError'||e?.name==='JsonWebTokenError')return res.status(401).json({error:'Admin session expired or invalid'});next(e)}
};
