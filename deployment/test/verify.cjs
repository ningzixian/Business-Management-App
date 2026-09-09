const assert = require('node:assert/strict');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

async function main() {
  assert.equal(process.env.DB_NAME, 'business_management_test');
  const base='http://127.0.0.1:3000/api/v1';
  const ready=await fetch(`${base}/health/ready`); assert.equal(ready.status,200);
  const checks=await ready.json(); assert.equal(checks.checks.database.ready,true); assert.equal(checks.checks.storage.ready,true);
  const users=[['qa_admin','admin',105],['qa_manager','manager',105],['qa_member_a','member',105],['qa_member_b','member',105],['qa_readonly','readonly',105],['qa_foreign','member',0],['qa_empty','member',0]];
  for(let i=0;i<users.length;i++) {
    // Respect the existing five-logins/minute rate limit; never disable it for QA.
    if(i) await new Promise(resolve=>setTimeout(resolve,13000));
    const [username,role,count]=users[i];
    const r=await fetch(`${base}/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password:process.env.QA_TEST_PASSWORD,clientLabel:'preparation-smoke'})});
    assert.equal(r.status,201,`login ${username}`); const session=await r.json();
    assert.equal(session.user.role,role);
    const headers={Authorization:`Bearer ${session.accessToken}`};
    const list=await fetch(`${base}/organizations?pageSize=100`,{headers}); assert.equal(list.status,200);
    const page=await list.json(); assert.equal(page.meta.total,count);
    if(count>100) { const next=await fetch(`${base}/organizations?pageSize=100&page=2`,{headers}); assert.equal(next.status,200); assert.equal((await next.json()).items.length,5); }
    const logout=await fetch(`${base}/auth/logout`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({refreshToken:session.refreshToken})}); assert.equal(logout.status,201);
    console.log(JSON.stringify({username,role,organizations:count,login:true,logout:true}));
  }
  assert.equal(process.env.MINIO_BUCKET,'qa-attachments');
  assert.equal(process.env.MINIO_ENDPOINT,'storage');
  const storage=new S3Client({endpoint:'http://storage:9000',region:'us-east-1',forcePathStyle:true,credentials:{accessKeyId:process.env.MINIO_ACCESS_KEY,secretAccessKey:process.env.MINIO_SECRET_KEY}});
  const object={Bucket:'qa-attachments',Key:'preparation/smoke-test.txt'};
  await storage.send(new PutObjectCommand({...object,Body:'SYNTHETIC PREPARATION CHECK'}));
  try { const read=await storage.send(new GetObjectCommand(object)); assert.equal(await read.Body.transformToString(),'SYNTHETIC PREPARATION CHECK'); }
  finally { await storage.send(new DeleteObjectCommand(object)); storage.destroy(); }
  console.log('PASS: database/storage readiness, seven role logins, department isolation counts, 105-row pagination, object read/write roundtrip');
}
main().catch(error=>{ console.error(error.message);process.exitCode=1; });
