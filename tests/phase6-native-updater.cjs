const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const adbPath='D:/Android/Sdk/platform-tools/adb.exe',serial='emulator-5580',pkg='com.company.departmentsteward';
const adb=(...args)=>execFileSync(adbPath,['-s',serial,...args],{encoding:'utf8',timeout:20000});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function dump(){adb('shell','uiautomator','dump','/sdcard/business-qa-ui.xml');return adb('shell','cat','/sdcard/business-qa-ui.xml')}
function nodes(xml){return [...xml.matchAll(/<node\s[^>]+/g)].map(m=>Object.fromEntries([...m[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]])))}
async function see(text,timeout=35000){const end=Date.now()+timeout;let xml;do{xml=dump();if(xml.includes(text))return xml;await wait(300)}while(Date.now()<end);throw Error('Missing native text: '+text+'\n'+xml)}
async function tap(text){const xml=await see(text);const n=nodes(xml).find(n=>n.text===text);if(!n)throw Error('No exact native button '+text);const b=n.bounds.match(/\d+/g).map(Number);adb('shell','input','tap',String(Math.round((b[0]+b[2])/2)),String(Math.round((b[1]+b[3])/2)));}
async function main(){assert.match(adb('emu','avd','name'),/^Business_QA_API_34/);const c=await require('./native-webview.cjs').connect();
const dir=path.resolve(__dirname,'../.preparation/phase6-native');fs.mkdirSync(dir,{recursive:true});
const mode=m=>fetch('http://127.0.0.1:18190/test-mode?mode='+m);
const check=()=>c.evaluate('window.Capacitor.Plugins.AppUpdates.check()');
try{
 await mode('offline');await check();await see('检查更新失败');await tap('知道了');console.log('PASS: native unavailable-service message and retry entry');
 for(const [m,error] of [['bad-hash','SHA256'],['truncated','SHA256'],['wrong-signature','签名与当前版本不同']]){
  await mode(m);await check();await tap('下载并校验');const xml=await see(error);fs.writeFileSync(path.join(dir,m+'.xml'),xml);await tap('知道了');console.log('PASS: native rejects '+m);
 }
 await mode('slow');await check();await tap('下载并校验');await tap('取消下载');await see('已取消下载');await tap('知道了');console.log('PASS: cancel download leaves installed app');
 await mode('good');await check();await tap('稍后再说');assert.match(adb('shell','dumpsys','package',pkg),/versionCode=4\b/);
 await check();await tap('下载并校验');const xml=await see('更新包已验证');fs.writeFileSync(path.join(dir,'verified.xml'),xml);await tap('暂不安装');assert.match(adb('shell','dumpsys','package',pkg),/versionCode=4\b/);console.log('PASS: postponed update and cancelled verified installer');
 await check();await tap('下载并校验');await tap('继续安装');
 let current=dump();
 if(current.includes('Allow from this source')){
  await tap('Allow from this source');
  adb('shell','input','keyevent','4');await tap('继续安装');
 }
 await see('UPDATE');fs.writeFileSync(path.join(dir,'system-installer.xml'),dump());await tap('CANCEL');
 assert.match(adb('shell','dumpsys','package',pkg),/versionCode=4\b/);console.log('PASS: Android system installer cancel preserves version 4');
 console.log('READY: verified APK and native cancel paths passed; final system update follows separately');
}finally{c.close()}}
module.exports={adb,dump,nodes,see,tap};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
