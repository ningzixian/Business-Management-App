// Read-only business checks. Creates and closes only this verification login session.
const assert=require('node:assert/strict');
async function main(){
 assert.equal(process.env.DB_NAME,'business_management');
 const base='http://127.0.0.1:3000/api/v1';let session;
 try{
  const cors=await fetch(base+'/organizations/00000000-0000-4000-8000-000000000001',{method:'OPTIONS',headers:{origin:'https://localhost','access-control-request-method':'PATCH','access-control-request-headers':'authorization,content-type,if-match'}});
  assert.equal(cors.status,204);assert.ok(cors.headers.get('access-control-allow-headers').toLowerCase().includes('if-match'));
  const login=await fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:process.env.INITIAL_ADMIN_USERNAME,password:process.env.INITIAL_ADMIN_PASSWORD,clientLabel:'v026 release verification'})});
  assert.equal(login.status,201,'Verification login failed (credentials are not printed)');session=await login.json();
  const counts={};
  for(const collection of ['organizations','contacts','business-items']){
   const result=await fetch(base+'/'+collection+'?pageSize=100',{headers:{authorization:'Bearer '+session.accessToken}});assert.equal(result.status,200);
   const data=await result.json();counts[collection]=data.meta.total;
   if(data.items.length){const detail=await fetch(base+'/'+collection+'/'+data.items[0].id,{headers:{authorization:'Bearer '+session.accessToken}});assert.equal(detail.status,200);assert.equal(typeof(await detail.json()).revision,'string');}
  }
  console.log(JSON.stringify({result:'PASS',authenticatedRead:true,detailVersions:true,nativeCorsIfMatch:true,counts}));
 }finally{
  if(session){const logout=await fetch(base+'/auth/logout',{method:'POST',headers:{authorization:'Bearer '+session.accessToken,'content-type':'application/json'},body:JSON.stringify({refreshToken:session.refreshToken})});assert.equal(logout.status,201);}
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
