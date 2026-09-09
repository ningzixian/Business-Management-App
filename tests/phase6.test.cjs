require('./phase4.test.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');const {load}=require('./phase1.test.cjs');
test('I23: service worker never intercepts API, update metadata, APK or foreign-origin requests',()=>{
 const handlers={};const vm=require('node:vm'),fs=require('node:fs');
 vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{URL,self:{location:{origin:'https://business.test'},addEventListener:(name,fn)=>handlers[name]=fn}});
 for(const pathname of ['/api/v1/business-items','/api/v1/auth/me','/downloads/android.json','/downloads/app.apk','https://other.test/assets/a.js']){
  let intercepted=false;handlers.fetch({request:{method:'GET',url:pathname.startsWith('http')?pathname:'https://business.test'+pathname},respondWith:()=>intercepted=true});assert.equal(intercepted,false,pathname);
 }
});
test('I23: mobile requires one absolute API origin; public HTTP and credential URLs rejected',()=>{
 const {serviceConfig}=load('src/service-config.ts',{URL});
 for(const bad of ['/api/v1','http://example.com/api/v1','https://user:pass@example.com/api/v1','https://example.com/api/v1?token=x','https://example.com/other','ftp://192.168.1.1/api/v1'])assert.throws(()=>serviceConfig(bad,true),undefined,bad);
 for(const origin of ['http://192.168.0.253:8088','http://10.0.2.2:18190','http://172.16.0.1','https://business.example.com'])assert.equal(serviceConfig(origin+'/api/v1',true).origin,origin);
 assert.equal(serviceConfig('/api/v1').origin,'');
});
test('I23: readiness probe has no credentials and rejects captive portals/unready services',async()=>{
 const {checkBusinessNetwork}=load('src/network-check.tsx',{fetch:()=>{},window:{},URL});
 assert.match(await checkBusinessNetwork('/api/v1',async(url,opts)=>{assert.equal(url,'/api/v1/health/ready');assert.equal(opts.credentials,'omit');assert.equal(opts.redirect,'error');return{ok:true,json:async()=>({status:'ready',checks:{database:{ready:true}}})}}),/连接成功/);
 await assert.rejects(checkBusinessNetwork('/api/v1',async()=>({ok:true,json:async()=>({status:'login portal'})})),/返回内容/);
 await assert.rejects(checkBusinessNetwork('/api/v1',async()=>({ok:false,status:503})),/503/);
 await assert.rejects(checkBusinessNetwork('/api/v1',async()=>{throw Error('offline')}),/Wi-Fi/);
});
