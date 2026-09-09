const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
async function main(){
 assert.equal(process.env.DB_NAME,'business_management_test');
 const base='http://127.0.0.1:3000/api/v1',sessions=[];
 async function login(username){const r=await fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password:process.env.QA_TEST_PASSWORD,clientLabel:'phase5-qa'})});assert.equal(r.status,201);const s=await r.json();sessions.push(s);return s;}
 async function request(s,path,method='GET',body,status=method==='POST'?201:200){const r=await fetch(base+path,{method,headers:{authorization:'Bearer '+s.accessToken,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,status,`${method} ${path}: ${JSON.stringify(data)}`);return data;}
 try{
  const member=await login('qa_member_a'),reader=await login('qa_readonly'),foreign=await login('qa_foreign');
  const run='TEST Phase5 '+randomUUID();
  const task=await request(member,'/business-items','POST',{itemType:'task',title:run,isInternal:true,status:'pending',dueAt:'2026-01-01T00:00:00Z'});
  const get=async s=>(await request(s,'/notifications')).items.find(n=>n.id===task.id);
  assert.equal((await get(member)).read,false);assert.equal((await get(reader)).read,false);assert.equal(await get(foreign),undefined);
  await request(foreign,'/notifications/'+task.id+'/read','PUT');assert.equal((await get(member)).read,false);
  await request(reader,'/notifications/'+task.id+'/read','PUT');assert.equal((await get(reader)).read,true);assert.equal((await get(member)).read,false);
  await request(member,'/notifications/read-all','PUT');assert.equal((await get(member)).read,true);
  const again=await login('qa_member_a');assert.equal((await get(again)).read,true);
  assert.equal((await request(member,'/business-items/'+task.id)).title,run);
  await request(member,'/business-items/'+task.id,'PATCH',{dueAt:'2026-01-02T00:00:00Z'});assert.equal((await get(member)).read,false);
  await request(member,'/business-items/'+task.id,'PATCH',{status:'completed'});assert.equal(await get(member),undefined);
  await request(member,'/notifications/not-a-uuid/read','PUT',undefined,400);
  console.log(JSON.stringify({result:'PASS',run,taskId:task.id,realReminder:true,readPersistedAfterLogin:true,readonlyOwnRead:true,userIsolation:true,departmentIsolation:true,bulkRead:true,changedDeadlineUnread:true,completedRemoved:true,recordTarget:true}));
 }finally{for(const s of sessions)await request(s,'/auth/logout','POST',{refreshToken:s.refreshToken});}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
