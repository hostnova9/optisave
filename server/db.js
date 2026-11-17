// PostgreSQL only. Create connections within the current request or scheduled event.
const { Pool }=require('pg');
const { AsyncLocalStorage }=require('node:async_hooks');
const scope=new AsyncLocalStorage();
let cliPool;
function newPool(){
 const raw=process.env.DATABASE_URL;
 if(!raw)throw Error('DATABASE_URL is missing');
 const url=new URL(raw);
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname.endsWith('.neon.tech'))throw Error('Use a private Neon PostgreSQL connection URL');
 url.searchParams.set('sslmode','verify-full');
 const p=new Pool({connectionString:url.toString(),max:3,connectionTimeoutMillis:15000,idleTimeoutMillis:1000,allowExitOnIdle:true});
 p.on('error',err=>console.error('Database pool:',err.code||err.name));
 return p;
}
function current(){const s=scope.getStore();if(s){if(!s.pool)s.pool=newPool();return s.pool}if(process.env.OPTISAVE_CLOUD==='true')throw Error('Missing request database scope');return cliPool||(cliPool=newPool())}
const pool={query:(...args)=>current().query(...args),connect:()=>current().connect(),end:()=>cliPool?cliPool.end():Promise.resolve()};
async function cleanup(s){try{await Promise.allSettled(s.tasks)}finally{if(s.pool)await s.pool.end()}}
function requestMiddleware(req,res,next){
 const s={pool:null,tasks:[]}; let finished=false;
 const finish=()=>{if(finished)return;finished=true;scope.run(s,()=>{const p=cleanup(s).catch(e=>console.error('Database cleanup:',e.code||e.name));if(typeof req.optisaveWaitUntil==='function')req.optisaveWaitUntil(p);});};
 res.once('finish',finish);res.once('close',finish);
 scope.run(s,next);
}
async function withDatabase(fn){const s={pool:null,tasks:[]};return scope.run(s,async()=>{try{return await fn()}finally{await cleanup(s)}})}
function defer(fn){const s=scope.getStore();if(!s)throw Error('Missing background task scope');const p=Promise.resolve().then(fn);s.tasks.push(p);p.catch(e=>console.error('Deferred task failed:',e.code||e.name));return p}
module.exports={query:(...args)=>pool.query(...args),pool,kind:'postgresql',requestMiddleware,withDatabase,defer};
