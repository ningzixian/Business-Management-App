const {adb,dump,nodes,see,tap}=require('./phase6-native-updater.cjs');const fs=require('node:fs');
(async()=>{const c=await require('./native-webview.cjs').connect();try{
 const current=dump();if(current.includes('知道了'))await tap('知道了');
 await fetch('http://127.0.0.1:18190/test-mode?mode=good');await c.evaluate('window.Capacitor.Plugins.AppUpdates.check()');
 await tap('下载并校验');await tap('继续安装');
 if(process.argv[2]==='ready'){await see('UPDATE');console.log('System installer ready');return;}
 const xml=await see('Allow from this source');fs.writeFileSync('.preparation/phase6-native/install-permission.xml',xml);
 console.log(nodes(xml).filter(n=>n.checkable==='true'||n.clickable==='true'||n.text).map(n=>({text:n.text,id:n['resource-id'],class:n.class,checked:n.checked,bounds:n.bounds})));
}finally{c.close()}})().catch(e=>{console.error(e);process.exitCode=1});
