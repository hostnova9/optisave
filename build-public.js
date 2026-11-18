const fs=require('node:fs');const path=require('node:path');
// OptiSave v1.73 cloud hotfix: keep iconv-lite's Node modules available to Wrangler.
// Cloudflare workers-sdk issue #9309. This only changes installed build metadata.
const {createRequire}=require('node:module');
const expressRequire=createRequire(require.resolve('express'));
const parserRequire=createRequire(expressRequire.resolve('body-parser'));
const rawRequire=createRequire(parserRequire.resolve('raw-body'));
const iconvPackage=rawRequire.resolve('iconv-lite/package.json');
const iconv=JSON.parse(fs.readFileSync(iconvPackage,'utf8'));
if(iconv.version==='0.4.24' && iconv.browser && typeof iconv.browser==='object'){
 let changed=false;
 for(const key of ['./lib/extend-node','./lib/streams']){
  if(iconv.browser[key]===false){delete iconv.browser[key];changed=true;}
 }
 if(changed){
  if(!Object.keys(iconv.browser).length)delete iconv.browser;
  fs.writeFileSync(iconvPackage,JSON.stringify(iconv,null,2)+'\n');
  console.log('Cloud compatibility: restored iconv-lite Node module resolution.');
 }
}
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist);
const allowed=/\.(css|js|png|jpg|jpeg|svg|webp|gif|ico|woff|woff2|ttf|json)$/i;
function copy(from,to){fs.mkdirSync(to,{recursive:true});for(const e of fs.readdirSync(from,{withFileTypes:true})){if(e.name.startsWith('.'))continue;const src=path.join(from,e.name),dest=path.join(to,e.name);if(e.isDirectory())copy(src,dest);else if(e.isFile()&&allowed.test(e.name))fs.copyFileSync(src,dest)}}
for(const e of fs.readdirSync(root,{withFileTypes:true}))if(e.isFile()&&/^[a-z0-9_-]+\.html$/i.test(e.name))fs.copyFileSync(path.join(root,e.name),path.join(dist,e.name));
for(const d of ['css','js','images'])copy(path.join(root,d),path.join(dist,d));
console.log('Public-only assets built; private server and database files excluded.');
