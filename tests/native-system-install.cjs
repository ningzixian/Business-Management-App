const assert=require('node:assert/strict'),fs=require('node:fs');const{adb,dump,nodes,see,tap}=require('./phase6-native-updater.cjs');
(async()=>{
 if(dump().includes('Allow from this source')){
  await tap('Allow from this source');console.log(adb('shell','appops','get','com.company.departmentsteward','REQUEST_INSTALL_PACKAGES'));
  adb('shell','input','keyevent','4');await tap('继续安装');
 }
 let xml=dump();fs.writeFileSync('.preparation/phase6-native/system-installer.xml',xml);console.log(nodes(xml).filter(n=>n.text).map(n=>({text:n.text,bounds:n.bounds})));
 if(process.argv[2]==='cancel'){
  const button=nodes(xml).find(n=>n.text.toLowerCase()==='cancel');if(!button)throw Error('System Cancel button missing');await tap(button.text);
  assert.match(adb('shell','dumpsys','package','com.company.departmentsteward'),/versionCode=4\b/);console.log('PASS: Android installer cancellation retains version 4');
 }else if(process.argv[2]==='install'){
  const button=nodes(xml).find(n=>n.text.toLowerCase()==='update');if(!button)throw Error('System Update button missing');await tap(button.text);
  for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,500));if(/versionCode=5\b/.test(adb('shell','dumpsys','package','com.company.departmentsteward'))){console.log('PASS: system-confirmed same-signature upgrade to version 5');return}}
  throw Error('System update did not finish');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
