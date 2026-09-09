const assert = require('node:assert/strict');
async function main() {
 assert.equal(process.env.DB_NAME,'business_management_test');
 const base='http://127.0.0.1:3000/api/v1';
 const response=await fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'qa_member_a',password:process.env.QA_TEST_PASSWORD,clientLabel:'phase2-regression'})});
 assert.equal(response.status,201);const session=await response.json();
 async function req(path,method='GET',body) {const r=await fetch(base+path,{method,headers:{authorization:'Bearer '+session.accessToken,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,method==='POST'?201:200,path);return r.json();}
 try {
  const created=await req('/business-items','POST',{itemType:'task',title:'TEST Phase2 completion timestamp',content:'Completion timestamp stability',isInternal:true,dueAt:'2025-12-31T00:00:00Z',status:'pending'});
  assert.equal(created.ownerUserId,session.user.userId);assert.ok(created.createdAt);assert.equal(created.completedAt,null);
  const first=await req('/business-items/'+created.id,'PATCH',{status:'completed'});assert.ok(first.completedAt);
  await new Promise(resolve=>setTimeout(resolve,1200));
  const second=await req('/business-items/'+created.id,'PATCH',{status:'completed'});assert.equal(second.completedAt,first.completedAt,'repeated completion must preserve timestamp');
  const reopened=await req('/business-items/'+created.id,'PATCH',{status:'pending'});assert.equal(reopened.completedAt,null);
  const completed=await req('/business-items/'+created.id,'PATCH',{status:'completed'});assert.ok(Date.parse(completed.completedAt)>Date.parse(first.completedAt));
  const list=await req('/business-items?ownerUserId='+session.user.userId+'&pageSize=100');assert.ok(list.items.every(item=>item.ownerUserId===session.user.userId));
  assert.equal(list.items.find(item=>item.id===created.id).completedAt,completed.completedAt);
  console.log(JSON.stringify({result:'PASS',taskId:created.id,ownerFilter:true,creationTimestamp:true,completionTimestampStable:true,reopenClearsTimestamp:true,completedAgain:true}));
 } finally {await req('/auth/logout','POST',{refreshToken:session.refreshToken});}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
