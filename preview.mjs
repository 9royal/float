import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {dirname,extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';

// A dependency-free preview of the verified production build. Serves dist only.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'dist');
const port=Number(process.env.PORT||4178);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
await stat(resolve(root,'index.html')).catch(()=>{throw new Error('dist/index.html is missing. Run pnpm run build first.');});
const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(root,path==='/'?'index.html':`.${path}`);
    if(file!==root&&!file.startsWith(root+sep)){res.writeHead(404);res.end();return;}
    const info=await stat(file);if(!info.isFile()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD'){res.end();return;}
    createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  }catch{res.writeHead(404);res.end();}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is in use. Close the previous preview or set PORT.`:e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
  const url=`http://127.0.0.1:${port}/`;
  console.log(`Buoyancy Lab v0.3\nLocal preview: ${url}\nPress Ctrl+C to stop.`);
  if(process.argv.includes('--open')){
    if(process.platform==='win32')execFile('cmd.exe',['/d','/c','start',url],{windowsHide:true},()=>{});
    else execFile(process.platform==='darwin'?'open':'xdg-open',[url],()=>{});
  }
});
