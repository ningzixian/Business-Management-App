const assert=require('node:assert/strict');const {randomUUID,createHash}=require('node:crypto');
const {Pool}=require('pg');const {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand}=require('@aws-sdk/client-s3');
const {AttachmentsService}=require('/app/dist/attachments/attachments.service.js');
async function main(){
 assert.equal(process.env.DB_NAME,'business_management_test');assert.equal(process.env.DB_USER,'business_test');assert.equal(process.env.MINIO_BUCKET,'qa-attachments');
 const base='http://127.0.0.1:3000/api/v1',sessions=[];
 const pool=new Pool({host:process.env.DB_HOST,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,max:2});
 const s3=new S3Client({endpoint:'http://'+process.env.MINIO_ENDPOINT+':'+process.env.MINIO_PORT,region:'us-east-1',forcePathStyle:true,credentials:{accessKeyId:process.env.MINIO_ACCESS_KEY,secretAccessKey:process.env.MINIO_SECRET_KEY}});
 const bucket=process.env.MINIO_BUCKET;
 const database={query:(...args)=>pool.query(...args),transaction:async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}};
 const storage={isDisabled:()=>false,maxUploadBytes:()=>20*1024*1024,putObject:(key,buffer)=>s3.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:buffer})),removeObject:key=>s3.send(new DeleteObjectCommand({Bucket:bucket,Key:key}))};
 const service=new AttachmentsService(database,storage,{log:async()=>{}});
 let lastLogin=0;
 async function login(username){const delay=13000-(Date.now()-lastLogin);if(delay>0)await new Promise(r=>setTimeout(r,delay));lastLogin=Date.now();const r=await fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password:process.env.QA_TEST_PASSWORD,clientLabel:'phase4-qa'})});assert.equal(r.status,201);const s=await r.json();sessions.push(s);return s;}
 async function req(s,path,method='GET',body,status=method==='POST'?201:200){const headers={authorization:'Bearer '+s.accessToken};if(body&&!(body instanceof FormData))headers['content-type']='application/json';const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});assert.equal(r.status,status,`${method} ${path}: ${r.status}`);return r;}
 function form(name,type,bytes){const f=new FormData();f.append('file',new Blob([bytes],{type}),name);return f;}
 try{
  const member=await login('qa_member_a'),readonly=await login('qa_readonly'),foreign=await login('qa_foreign'),admin=await login('qa_admin');
  const run='TEST Phase4 '+randomUUID();
  const item=await (await req(member,'/business-items','POST',{itemType:'task',title:run,status:'pending',isInternal:true,dueAt:new Date().toISOString()})).json();
  const samples=[['图片.png','image/png',Buffer.from('89504e470d0a1a0a00000000','hex')],['文档.pdf','application/pdf',Buffer.from('%PDF-1.4\nQA only\n%%EOF')],['录音.wav','audio/wav',Buffer.from('RIFF0000WAVEfmt QA audio')]];
  const uploaded=[];
  for(const [name,type,bytes]of samples){const a=await(await req(member,`/business-items/${item.id}/attachments`,'POST',form(name,type,bytes))).json();assert.equal(a.fileName,name);assert.equal(a.checksumSha256,createHash('sha256').update(bytes).digest('hex'));const r=await req(readonly,'/attachments/'+a.id);assert.match(r.headers.get('content-disposition'),/attachment/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes);uploaded.push(a);}
  const list=await(await req(member,`/business-items/${item.id}/attachments`)).json();assert.equal(list.items.length,3);assert.equal(list.maxUploadBytes,20*1024*1024);
  await req(readonly,`/business-items/${item.id}/attachments`,'POST',form('deny.txt','text/plain','x'),403);
  await req(readonly,'/attachments/'+uploaded[0].id,'DELETE',undefined,403);
  await req(foreign,`/business-items/${item.id}/attachments`,'GET',undefined,404);
  await req(foreign,'/attachments/'+uploaded[0].id,'GET',undefined,404);
  assert.equal((await fetch(base+'/attachments/'+uploaded[0].id)).status,401);
  await req(member,`/business-items/${item.id}/attachments`,'POST',form('empty.txt','text/plain',''),400);
  await req(member,`/business-items/${item.id}/attachments`,'POST',form('unsafe.svg','image/svg+xml','<svg/>'),400);
  await req(member,`/business-items/${item.id}/attachments`,'POST',form('large.txt','text/plain',Buffer.alloc(20*1024*1024+1)),413);
  await req(member,'/attachments/'+uploaded[0].id,'DELETE');await req(member,'/attachments/'+uploaded[0].id,'GET',undefined,404);
  // A simulated metadata transaction failure leaves a real, persisted object-cleanup job.
  const broken=new AttachmentsService({...database,transaction:async()=>{throw Error('injected DB failure')}},storage,{log:async()=>{}});
  await assert.rejects(broken.upload(member.user,item.id,{originalname:'orphan.txt',mimetype:'text/plain',size:6,buffer:Buffer.from('orphan')}),/injected DB failure/);
  const orphan=(await pool.query("SELECT object_key FROM attachment_cleanup_jobs WHERE object_key LIKE $1",['%/'+item.id+'/%-orphan.txt'])).rows[0];assert.ok(orphan);
  await pool.query('UPDATE attachment_cleanup_jobs SET due_at=NOW() WHERE object_key=$1',[orphan.object_key]);
  const failing=new AttachmentsService(database,{...storage,removeObject:async()=>{throw Error('injected storage outage')}},{log:async()=>{}});
  await failing.cleanup();assert.ok((await pool.query('SELECT attempts FROM attachment_cleanup_jobs WHERE object_key=$1',[orphan.object_key])).rows[0].attempts>0);
  await pool.query('UPDATE attachment_cleanup_jobs SET due_at=NOW() WHERE object_key=$1',[orphan.object_key]);await service.cleanup();
  assert.equal((await pool.query('SELECT object_key FROM attachment_cleanup_jobs WHERE object_key=$1',[orphan.object_key])).rowCount,0);
  await assert.rejects(s3.send(new GetObjectCommand({Bucket:bucket,Key:orphan.object_key})),e=>e.$metadata?.httpStatusCode===404);
  await req(admin,'/business-items/'+item.id,'DELETE');
  assert.equal((await pool.query("SELECT id FROM attachments WHERE business_item_id=$1 AND status='active'",[item.id])).rowCount,0);
  await req(member,'/attachments/'+uploaded[1].id,'GET',undefined,404);await service.cleanup();
  console.log(JSON.stringify({result:'PASS',run,itemId:item.id,uploaded:uploaded.map(a=>a.id),binaryRoundtrip:true,chineseNames:true,permissionMatrix:true,sizeAndTypeLimits:true,orphanFailureRetry:true,parentDeleteCleanup:true}));
 }finally{for(const s of sessions)await req(s,'/auth/logout','POST',{refreshToken:s.refreshToken});await pool.end();s3.destroy();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
