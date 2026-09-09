const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
async function main(){
 assert.equal(process.env.DB_NAME,'business_management_test');
 const base='http://127.0.0.1:3000/api/v1',sessions=[];
 async function login(username){const r=await fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password:process.env.QA_TEST_PASSWORD,clientLabel:'phase3-qa'})});assert.equal(r.status,201);const s=await r.json();sessions.push(s);return s;}
 async function request(s,path,method='GET',body,status=method==='POST'?201:200){const r=await fetch(base+path,{method,headers:{authorization:'Bearer '+s.accessToken,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,status,`${method} ${path}: ${JSON.stringify(data)}`);return data;}
 try{
  const member=await login('qa_member_a'),readonly=await login('qa_readonly'),foreign=await login('qa_foreign');
  const run='TEST Phase3 '+randomUUID();
  const org=await request(member,'/organizations','POST',{name:run,organizationType:'company',status:'normal'});
  const org2=await request(member,'/organizations','POST',{name:run+' secondary',organizationType:'department',parentOrganizationId:org.id,status:'normal'});
  const people=[];
  for(const suffix of ['A','B']) people.push(await request(member,'/contacts','POST',{fullName:run+suffix,visibility:'department',affiliations:[{organizationId:org.id},{organizationId:org2.id}]}));
  const visit=await request(member,'/business-items','POST',{itemType:'visit',title:run,content:'原始拜访',location:'原始地点',startsAt:'2026-09-09T02:00:00Z',endsAt:'2026-09-09T03:00:00Z',status:'planned',organizationIds:[org.id,org2.id],contactIds:people.map(p=>p.id)});
  assert.ok(visit.revision);assert.equal(visit.events.length,1);assert.equal(visit.events[0].action,'visit.create');
  await request(readonly,'/business-items/'+visit.id,'PATCH',{expectedRevision:visit.revision,content:'禁止修改'},403);
  await request(foreign,'/business-items/'+visit.id,'GET',undefined,404);
  await request(foreign,'/business-items/'+visit.id,'PATCH',{expectedRevision:visit.revision,content:'越权'},404);
  const edited=await request(member,'/business-items/'+visit.id,'PATCH',{expectedRevision:visit.revision,content:'编辑中文\n第二行',location:'新地点',endsAt:null,participantNames:['甲','乙']});
  assert.notEqual(edited.revision,visit.revision);assert.equal(edited.endsAt,null);assert.equal(edited.content,'编辑中文\n第二行');assert.deepEqual(edited.participantNames,['甲','乙']);assert.equal(edited.events.length,2);
  await request(member,'/business-items/'+visit.id,'PATCH',{expectedRevision:visit.revision,content:'旧版本覆盖'},409);
  await request(member,'/business-items/'+visit.id,'PATCH',{content:'无版本'},409);
  const results=await Promise.all(['并发甲','并发乙'].map(content=>fetch(base+'/business-items/'+visit.id,{method:'PATCH',headers:{authorization:'Bearer '+member.accessToken,'content-type':'application/json'},body:JSON.stringify({expectedRevision:edited.revision,content})})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const after=await request(member,'/business-items/'+visit.id);assert.equal(after.events.length,3);assert.ok(['并发甲','并发乙'].includes(after.content));
  assert.ok(after.events.every(e=>e.createdAt&&e.actorName&&!('changes'in e)));
  const task=await request(member,'/business-items','POST',{itemType:'task',title:run+' followup',status:'pending',dueAt:'2026-09-10T03:00:00Z',isInternal:true,sourceItemId:visit.id});
  assert.equal(task.sourceItemId,visit.id);assert.equal(task.isInternal,false);assert.deepEqual(task.organizations.map(o=>o.id).sort(),[org.id,org2.id].sort());assert.deepEqual(task.contacts.map(c=>c.id).sort(),people.map(p=>p.id).sort());
  const refreshed=await request(member,'/business-items/'+task.id);assert.equal(refreshed.sourceItemId,visit.id);
  const list=await request(member,'/business-items?q='+encodeURIComponent(run)+'&pageSize=100');assert.ok(list.items.some(i=>i.sourceItemId===visit.id));
  await request(foreign,'/business-items','POST',{itemType:'task',title:'invalid source',status:'pending',dueAt:'2026-09-10T03:00:00Z',isInternal:true,sourceItemId:visit.id},400);
  console.log(JSON.stringify({result:'PASS',run,visitId:visit.id,taskId:task.id,editPersisted:true,optimisticConflict:true,concurrentOneWinner:true,readonlyDenied:true,crossDepartmentDenied:true,realAudit:true,sourceInheritance:true,sourcePersisted:true}));
 }finally{for(const s of sessions)await request(s,'/auth/logout','POST',{refreshToken:s.refreshToken});}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
