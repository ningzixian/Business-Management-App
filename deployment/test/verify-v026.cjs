const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
async function main(){
 assert.equal(process.env.DB_NAME,'business_management_test');assert.equal(process.env.DB_USER,'business_test');
 const base='http://127.0.0.1:3000/api/v1',sessions=[];
 async function login(name){if(sessions.length)await new Promise(r=>setTimeout(r,13000));const r=await fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:name,password:process.env.QA_TEST_PASSWORD,clientLabel:'v026 QA'})});assert.equal(r.status,201);const s=await r.json();sessions.push(s);return s;}
 async function req(s,path,method='GET',body,status=method==='POST'?201:200,revision){const r=await fetch(base+path,{method,headers:{authorization:'Bearer '+s.accessToken,'content-type':'application/json',...(revision?{'if-match':revision}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,status,`${method} ${path} ${JSON.stringify(data)}`);return data;}
 try{
  const admin=await login('qa_admin'),member=await login('qa_member_a'),other=await login('qa_member_b'),readonly=await login('qa_readonly'),foreign=await login('qa_foreign');
  const name='TEST v026 '+randomUUID();
  const org=await req(member,'/organizations','POST',{name});
  const child=await req(member,'/organizations','POST',{name:name+' child',parentOrganizationId:org.id,organizationType:'department'});
  await req(admin,'/organizations/'+org.id,'DELETE',undefined,400,org.revision);
  const contact=await req(member,'/contacts','POST',{fullName:name,visibility:'private'});
  await req(other,'/contacts/'+contact.id,'GET',undefined,404);
  for(const kind of ['organizations','contacts']){
   const row=kind==='organizations'?org:contact,path='/'+kind+'/'+row.id;
   await req(readonly,path,'PATCH',{notes:'denied'},403,row.revision);
   await req(foreign,path,'GET',undefined,404);
   const results=await Promise.all(['one','two'].map(notes=>fetch(base+path,{method:'PATCH',headers:{authorization:'Bearer '+member.accessToken,'content-type':'application/json','if-match':row.revision},body:JSON.stringify({notes})})));
   assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
   const current=await req(member,path);assert.ok(['one','two'].includes(current.notes));
   await req(admin,path,'DELETE',undefined,409,row.revision);
   await req(member,path,'DELETE',undefined,403,current.revision);
  }
  let person=await req(member,'/contacts/'+contact.id);
  const aff=await req(member,'/contacts/'+person.id+'/affiliations','POST',{organizationId:org.id,title:'经理',isPrimary:true},201,person.revision);
  person=await req(member,'/contacts/'+person.id);
  const historical=await req(member,'/contacts/'+person.id+'/affiliations/'+aff.id,'PATCH',{status:'historical',isPrimary:true,startDate:'2026-01-01',endDate:'2026-09-09'},200,person.revision);
  assert.equal(historical.affiliations[0].isPrimary,false);assert.equal(historical.affiliations[0].status,'historical');
  await req(member,'/contacts/'+person.id+'/affiliations/'+aff.id,'PATCH',{startDate:'2026-02-30'},400,historical.revision);
  assert.equal((await req(member,'/contacts/'+person.id)).revision,historical.revision,'failed transaction must roll back version');
  await req(admin,'/contacts/'+person.id+'/affiliations/'+aff.id,'DELETE',undefined,200,historical.revision);
  assert.equal((await req(member,'/contacts/'+person.id)).affiliations.length,0);
  const visit=await req(member,'/business-items','POST',{itemType:'visit',title:name,status:'planned',startsAt:'2026-09-10T02:00:00Z',organizationIds:[org.id]});
  const task=await req(member,'/business-items','POST',{itemType:'task',title:name+' task',status:'pending',dueAt:'2026-10-01T09:00:00Z',isInternal:true,sourceItemId:visit.id});
  const edited=await req(member,'/business-items/'+task.id,'PATCH',{expectedRevision:task.revision,title:name+' edited',content:'持久化\n第二行',priority:'high',dueAt:'2026-10-01T09:00:00Z'});
  assert.equal(edited.content,'持久化\n第二行');assert.equal(edited.priority,'high');
  await req(member,'/business-items/'+task.id,'PATCH',{expectedRevision:task.revision,title:'stale'},409);
  await req(admin,'/business-items/'+visit.id,'DELETE',undefined,200,visit.revision);
  assert.equal((await req(member,'/business-items/'+task.id)).sourceItemId,visit.id);
  await req(admin,'/business-items/'+visit.id,'DELETE',undefined,404,visit.revision);
  await req(admin,'/business-items/'+task.id,'DELETE',undefined,200,edited.revision);
  await req(admin,'/organizations/'+child.id,'DELETE',undefined,200,child.revision);
  const latestOrg=await req(admin,'/organizations/'+org.id);await req(admin,'/organizations/'+org.id,'DELETE',undefined,200,latestOrg.revision);
  const latestPerson=await req(admin,'/contacts/'+contact.id);await req(admin,'/contacts/'+contact.id,'DELETE',undefined,200,latestPerson.revision);
  await req(admin,'/contacts/'+contact.id,'DELETE',undefined,404,latestPerson.revision);
  console.log('PASS v0.2.6 real PostgreSQL: org/contact concurrent one-winner, permissions, rollback, hierarchy, affiliation history/delete, task edit and source retention, repeated delete');
 }finally{for(const s of sessions)await req(s,'/auth/logout','POST',{refreshToken:s.refreshToken});}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
