// Local-only fault-injection harness. No real API, credentials, phone call or DB.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const bootstrap = String.raw`<script>
const role=['readonly','manager'].includes(new URLSearchParams(location.search).get('role'))?new URLSearchParams(location.search).get('role'):'member';
const user={userId:new URLSearchParams(location.search).get('user')||'qa-local',departmentId:'qa-local',username:'qa-local',displayName:'隔离测试',role};
localStorage.setItem('bam-auth-session-v0.2',JSON.stringify({accessToken:'synthetic-only',refreshToken:'synthetic-only',expiresIn:3600,user}));
let mode='success',writes=0;
let tasks=JSON.parse(sessionStorage.getItem('qa-tasks')||'null')||[{id:'qa-task',itemType:'task',title:'测试待办',content:'原有说明\n第二行',status:'pending',isInternal:true,dueAt:new Date(Date.now()+86400000).toISOString(),ownerUserId:user.userId,ownerName:'隔离测试',organizations:[],contacts:[],participantNames:[]}];
let organizations=[],contacts=[];
const maintenance=new URLSearchParams(location.search).has('maintenance');
if(maintenance){
 organizations=[{id:'qa-org',revision:'1',name:'修补测试组织',shortName:'测试',organizationType:'company',status:'normal',industry:'服务',region:'测试区',contactCount:1,itemCount:1,parentOrganizationId:null}];
 contacts=[{id:'qa-contact',revision:'1',fullName:'合成人脉',mobile:'13800000000',status:'active',relationshipLevel:'normal',visibility:'department',tags:[],affiliations:[],affiliationCount:0,itemCount:0}];
 tasks=[{id:'qa-task',revision:'1',itemType:'task',title:'测试待办',content:'原说明',status:'pending',priority:'medium',isInternal:true,ownerUserId:user.userId,ownerName:user.displayName,dueAt:new Date(Date.now()+86400000).toISOString(),organizations:[],contacts:[],participantNames:[]}];
}
let attachments=JSON.parse(sessionStorage.getItem('qa-attachments')||'[]');
if(new URLSearchParams(location.search).has('phase2')) {
 organizations=[{id:'north',name:'北方组织',shortName:'北',region:'北区',industry:'制造',status:'normal',contactCount:0,itemCount:0},{id:'south',name:'南方组织',region:'南区',industry:'服务',status:'normal',contactCount:0,itemCount:0}];
 const common={itemType:'task',status:'pending',isInternal:false,ownerUserId:user.userId,ownerName:user.displayName,organizations:[organizations[0]],contacts:[],participantNames:[],createdAt:'2026-12-31T10:00:00+08:00',content:'第二阶段说明'};
 tasks=[{...common,id:'early',title:'我的早到期待办',dueAt:'2026-12-31T23:59:50+08:00'},{...common,id:'late',title:'我的次日待办',dueAt:'2027-01-01T10:00:00+08:00'},
 {...common,id:'other',title:'同名同事待办',ownerUserId:'qa-other',dueAt:'2026-12-31T18:00:00+08:00',organizations:[organizations[1]]},
 {...common,id:'done',title:'本周完成旧待办',dueAt:'2026-11-01T10:00:00+08:00',status:'completed',completedAt:'2026-12-31T12:00:00+08:00'},
 {...common,id:'multi',title:'多地区事项',dueAt:'2027-01-01T10:00:00+08:00',organizations},
 {...common,id:'cancelled',title:'取消待办',status:'cancelled',dueAt:'2027-01-01T10:00:00+08:00'},
 {...common,id:'visit',itemType:'visit',title:'跨年拜访',content:'跨年拜访',startsAt:'2027-01-01T09:00:00+08:00',status:'planned',location:'详细地址不是地区'},
 {...common,id:'today-visit',itemType:'visit',title:'年末拜访',content:'年末拜访',startsAt:'2026-12-31T09:00:00+08:00',status:'completed',completedAt:'2026-12-31T09:30:00+08:00'}];
}
if(new URLSearchParams(location.search).has('empty')) {tasks=[];organizations=[];}
if(new URLSearchParams(location.search).has('phase3')) {
 organizations=[{id:'org-3',name:'第三阶段组织',shortName:'三',region:'北区',status:'normal',contactCount:0,itemCount:0}];
 tasks=JSON.parse(sessionStorage.getItem('qa-phase3')||'null')||[{id:'visit-3',revision:'1',itemType:'visit',title:'第三阶段拜访',content:'第三阶段拜访',location:'旧地点',startsAt:new Date().toISOString(),status:'planned',ownerUserId:user.userId,ownerName:user.displayName,organizations,contacts:[],participantNames:['测试员'],events:[{id:'e1',action:'visit.create',actorName:'隔离测试',createdAt:new Date().toISOString()}]}];
}
if(new URLSearchParams(location.search).has('phase4')) {
 organizations=organizations.map(o=>({...o,address:'合成测试地址'}));
 contacts=[{id:'person4',fullName:'附件测试联系人',mobile:'13800138000',relationshipLevel:'normal',status:'active',visibility:'department',affiliationCount:0,itemCount:0}];
 if(!tasks.some(t=>t.id==='attachment-task'))tasks.push({id:'attachment-task',itemType:'task',title:'附件测试待办',content:'真实任务说明',status:'pending',isInternal:true,ownerUserId:user.userId,ownerName:user.displayName,dueAt:'2026-01-01T00:00:00Z',organizations:[],contacts:[],participantNames:[]});
}
const count=()=>document.getElementById('qa-count').textContent='写请求数：'+writes;
if(new URLSearchParams(location.search).has('phase5'))for(const task of tasks)if(task.id==='attachment-task')task.sourceItemId='visit-3';
window.fetch=async(url,init={})=>{
 const p=String(url); const method=init.method||'GET';
 if(!p.startsWith('/api/v1/'))throw new Error('Harness blocks external requests');
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
 if(p.endsWith('/auth/me'))return reply({user});
 if(p.endsWith('/auth/logout'))return reply({success:true},201);
 if(maintenance&&/^\/api\/v1\/(organizations|contacts|business-items)\//.test(p)){
  if(p.endsWith('/attachments'))return reply({items:[],enabled:false,maxUploadBytes:0});
  const parts=p.split('/'),collection=parts[3],id=parts[4];
  const rows=collection==='organizations'?organizations:collection==='contacts'?contacts:tasks;
  const row=rows.find(r=>r.id===id);if(!row)return reply({message:'记录已删除'},404);
  if(method==='GET')return reply(row);
  writes++;count();if(role==='readonly'||(method==='DELETE'&&role!=='manager'))return reply({message:'无权限'},403);
  if(mode==='offline')throw Error('offline');if(mode!=='success')return reply({message:'注入测试错误 '+mode},Number(mode)||500);
  const body=JSON.parse(init.body||'{}'),expected=new Headers(init.headers).get('If-Match')||body.expectedRevision;
  if(expected&&expected!==row.revision)return reply({message:'版本冲突'},409);
  if(parts[5]==='affiliations'){
   if(method==='POST')row.affiliations.push({...body,organizationName:organizations.find(o=>o.id===body.organizationId)?.name,id:'aff-'+Date.now()});
   else if(method==='DELETE')row.affiliations=row.affiliations.filter(a=>a.id!==parts[6]);
   else Object.assign(row.affiliations.find(a=>a.id===parts[6]),body);
   row.affiliationCount=row.affiliations.length;
  }else if(method==='DELETE'){rows.splice(rows.indexOf(row),1);return reply({success:true});}
  else Object.assign(row,body);
  row.revision=String(Number(row.revision)+1);return reply(row);
 }
 if(p.includes('/notifications')) {
  const key='qa-notice-reads:'+user.userId;
  const reads=JSON.parse(localStorage.getItem(key)||'{}');
  const active=tasks.filter(t=>t.itemType==='task'&&['pending','in_progress','overdue'].includes(t.status)&&new Date(t.dueAt)<new Date());
  if(method==='PUT') {
   if(mode==='offline')throw new TypeError('offline');
   if(mode==='500')return reply({message:'注入通知保存错误'},500);
   for(const t of active.filter(t=>p.endsWith('/read-all')||p.includes('/'+t.id+'/')))reads[t.id]=t.dueAt;
   localStorage.setItem(key,JSON.stringify(reads));return reply({ok:true});
  }
  return reply({items:active.map(t=>({id:t.id,title:t.title,dueAt:t.dueAt,read:reads[t.id]===t.dueAt}))});
 }
 if(method!=='GET'){
  writes++;count();
  if(mode==='offline')throw new TypeError('offline');
  if(mode==='timeout')return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('aborted'))));
  await new Promise(resolve=>setTimeout(resolve,1000));
  if(mode==='500'||mode==='403'||mode==='409')return reply({message:'注入测试错误 '+mode},Number(mode));
  if(method==='POST'&&p.endsWith('/attachments')){
   const file=init.body.get('file'),bytes=new Uint8Array(await file.arrayBuffer());
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
   const item={id:'file-'+Date.now(),itemId:p.split('/')[4],fileName:file.name,mimeType:file.type,sizeBytes:String(file.size),checksumSha256:hash,base64:btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''))};
   attachments.push(item);sessionStorage.setItem('qa-attachments',JSON.stringify(attachments));return reply(item,201);
  }
  if(method==='DELETE'&&p.startsWith('/api/v1/attachments/')){attachments=attachments.filter(a=>!p.endsWith('/'+a.id));sessionStorage.setItem('qa-attachments',JSON.stringify(attachments));return reply({success:true});}
  const body=JSON.parse(init.body||'{}');
  if(method==='POST'){const item={...body,id:'qa-'+Date.now(),revision:'1',ownerUserId:user.userId,ownerName:user.displayName,createdAt:new Date().toISOString(),organizations:organizations.filter(o=>body.organizationIds?.includes(o.id)),contacts:[],participantNames:body.participantNames||[],events:[{id:'e'+Date.now(),action:body.itemType+'.create',createdAt:new Date().toISOString(),actorName:user.displayName}]};tasks.unshift(item);sessionStorage.setItem('qa-tasks',JSON.stringify(tasks));sessionStorage.setItem('qa-phase3',JSON.stringify(tasks));return reply(item,201)}
  const item=tasks.find(t=>p.endsWith('/'+t.id));Object.assign(item,body);item.revision=String(Number(item.revision||0)+1);if(item.events)item.events.push({id:'e'+Date.now(),action:item.itemType+'.update',createdAt:new Date().toISOString(),actorName:user.displayName});if(body.status==='completed')item.completedAt=new Date().toISOString();sessionStorage.setItem('qa-tasks',JSON.stringify(tasks));sessionStorage.setItem('qa-phase3',JSON.stringify(tasks));return reply(item);
 }
 if(p.endsWith('/attachments'))return reply({items:attachments.filter(a=>a.itemId===p.split('/')[4]),enabled:true,maxUploadBytes:20*1024*1024});
 if(p.startsWith('/api/v1/attachments/')){if(mode==='offline')throw Error('offline');const a=attachments.find(a=>p.endsWith('/'+a.id));return a?new Response(Uint8Array.from(atob(a.base64),c=>c.charCodeAt(0)),{headers:{'content-type':a.mimeType}}):reply({message:'未找到附件'},404);}
 if(p.startsWith('/api/v1/business-items/'))return reply(tasks.find(t=>p.endsWith('/'+t.id))||{},tasks.some(t=>p.endsWith('/'+t.id))?200:404);
 const items=p.includes('/business-items')?tasks:p.includes('/organizations')?organizations:p.includes('/contacts')?contacts:[];
 return reply({items,meta:{total:items.length,page:1,pageSize:100,pageCount:1}});
};
window.addEventListener('DOMContentLoaded',()=>{
 const bar=document.createElement('div');bar.style='position:fixed;top:0;left:0;right:0;z-index:99999;background:#fff6d8;padding:5px;font:12px sans-serif;display:flex;gap:8px;align-items:center';
 bar.innerHTML='<strong>本机合成测试 / '+role+'</strong><select aria-label="注入响应"><option value="success">成功</option><option value="500">500</option><option value="403">403</option><option value="409">409</option><option value="offline">断网</option><option value="timeout">超时</option></select><span id="qa-count">写请求数：0</span>';
 bar.querySelector('select').onchange=e=>mode=e.target.value;document.body.append(bar);document.body.style.paddingTop='36px';
});
</script>`;
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const requested=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(requested!==root&&!requested.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const file=fs.existsSync(requested)&&fs.statSync(requested).isFile()?requested:path.join(root,'index.html');
 const type={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
 res.setHeader('Content-Type',type);
 res.end(file.endsWith('index.html')?fs.readFileSync(file,'utf8').replace('<head>','<head>'+bootstrap):fs.readFileSync(file));
}).listen(18189,'127.0.0.1',()=>console.log('Synthetic UI harness http://127.0.0.1:18189 ; readonly ?role=readonly'));
