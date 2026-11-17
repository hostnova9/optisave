const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist);
const allowed=/\.(css|js|png|jpg|jpeg|svg|webp|gif|ico|woff|woff2|ttf|json)$/i;
function copy(from,to){fs.mkdirSync(to,{recursive:true});for(const e of fs.readdirSync(from,{withFileTypes:true})){if(e.name.startsWith('.'))continue;const src=path.join(from,e.name),dest=path.join(to,e.name);if(e.isDirectory())copy(src,dest);else if(e.isFile()&&allowed.test(e.name))fs.copyFileSync(src,dest)}}
for(const e of fs.readdirSync(root,{withFileTypes:true}))if(e.isFile()&&/^[a-z0-9_-]+\.html$/i.test(e.name))fs.copyFileSync(path.join(root,e.name),path.join(dist,e.name));
for(const d of ['css','js','images'])copy(path.join(root,d),path.join(dist,d));
console.log('Public-only assets built; private server and database files excluded.');
