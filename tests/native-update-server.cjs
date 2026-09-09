// Loopback-only synthetic update server. Never forwards to production.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../.preparation/phase6-apks');let mode='none';
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/test-mode'){mode=url.searchParams.get('mode')||'none';res.end(mode);return;}
 if(url.pathname==='/api/v1/health/ready'){res.setHeader('access-control-allow-origin','https://localhost');res.setHeader('content-type','application/json');res.end(JSON.stringify({status:'ready',checks:{database:{ready:true}}}));return;}
 const name=mode==='wrong-signature'?'wrong.apk':'next.apk',file=path.join(root,name);
 if(url.pathname==='/downloads/android.json'){
  if(mode==='offline'){res.writeHead(503).end();return;}
  const bytes=fs.existsSync(file)?fs.readFileSync(file):Buffer.alloc(0);
  res.setHeader('content-type','application/json');res.end(JSON.stringify({versionCode:mode==='none'?4:5,versionName:'0.2.3-QA',path:'/downloads/next.apk',size:bytes.length,sha256:mode==='bad-hash'?'0'.repeat(64):crypto.createHash('sha256').update(bytes).digest('hex'),notes:'仅限独立商务模拟器测试'}));return;
 }
 if(url.pathname==='/downloads/next.apk'&&fs.existsSync(file)){
  const bytes=fs.readFileSync(file);res.setHeader('content-type','application/vnd.android.package-archive');
  if(mode==='truncated'){res.end(bytes.subarray(0,100));return;}
  if(mode==='slow'){let offset=0;const timer=setInterval(()=>{if(offset>=bytes.length){clearInterval(timer);res.end()}else{res.write(bytes.subarray(offset,offset+32768));offset+=32768}},2000);res.on('close',()=>clearInterval(timer));return;}
  res.end(bytes);return;
 }
 res.writeHead(404).end();
}).listen(18190,'127.0.0.1',()=>console.log('Synthetic native update service on 127.0.0.1:18190'));
