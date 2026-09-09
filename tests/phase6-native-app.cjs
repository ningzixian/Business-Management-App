const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {adb,dump,nodes,see,tap}=require('./phase6-native-updater.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){assert.match(adb('emu','avd','name'),/^Business_QA_API_34/);const c=await require('./native-webview.cjs').connect();try{
 if(process.argv[2]!=='back'){
 assert.equal(await c.evaluate(`localStorage.getItem('phase6-upgrade-sentinel')`),'preserve-me');
 assert.equal(await c.evaluate(`localStorage.getItem('phase6-old-draft')`),'draft-preserved');
 const ready=await c.evaluate(`fetch('http://10.0.2.2:18190/api/v1/health/ready',{credentials:'omit'}).then(r=>r.json())`);assert.equal(ready.status,'ready');console.log('PASS: actual Android WebView HTTP/CORS readiness and upgrade data retention');
 const data=Buffer.from('安卓原生附件验证\n'+'Q'.repeat(1024*1024)),hash=crypto.createHash('sha256').update(data).digest('hex');
 const options={name:`phase6-native-${Date.now()}.txt`,mime:'text/plain',base64:data.toString('base64'),checksum:hash};
 const save=()=>c.evaluate(`window.Capacitor.Plugins.AttachmentFiles.save(${JSON.stringify(options)})`);
 let pending=save();await see('com.android.documentsui');adb('shell','input','keyevent','4');assert.equal((await pending).cancelled,true);console.log('PASS: Android system file picker cancel');
 pending=save();await see('com.android.documentsui');const xml=dump();fs.writeFileSync('.preparation/phase6-native/file-picker.xml',xml);
 const button=nodes(xml).find(n=>n.text.toLowerCase()==='save');if(!button)throw Error('Native save button missing: '+xml);await tap(button.text);await pending;
 const downloaded=execFileSync('D:/Android/Sdk/platform-tools/adb.exe',['-s','emulator-5580','exec-out','cat','/sdcard/Download/'+options.name],{timeout:10000,maxBuffer:2*1024*1024});assert.deepEqual(downloaded,data);console.log('PASS: 1 MB native attachment write is byte-exact, without Binder payload failure');
 await assert.rejects(c.evaluate(`window.Capacitor.Plugins.AttachmentFiles.save(${JSON.stringify({...options,checksum:'0'.repeat(64)})})`),/校验/);console.log('PASS: native attachment checksum rejection');
 }
 // Inject synthetic business responses into this test WebView only; never send business writes to a company server.
 let source=fs.readFileSync('tests/ui-harness.cjs','utf8').match(/const bootstrap = String.raw`<script>([\s\S]*?)<\/script>`;/)[1];
 source=source.replace('const p=String(url);',"const p=String(url).replace('http://10.0.2.2:18190','');");
 await c.send('Page.addScriptToEvaluateOnNewDocument',{source});await c.send('Page.navigate',{url:'https://localhost/?phase3&phase4'});
 async function until(expression){for(let i=0;i<60;i++){if(await c.evaluate(expression))return;await sleep(200)}throw Error('WebView condition timeout: '+expression)}
 await until(`Boolean(document.querySelector('.mobile-bottom-nav'))`);
 await c.evaluate(`[...document.querySelectorAll('.mobile-bottom-nav button')].find(b=>b.textContent.startsWith('待办')).click()`);
 await until(`Boolean(document.querySelector('button[aria-label="新建待办"]'))`);
 await c.evaluate(`document.querySelector('button[aria-label="新建待办"]').click()`);
 await until(`Boolean(document.querySelector('input[name=title]'))`);
 await c.evaluate(`{const input=document.querySelector('input[name=title]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'原生返回保留内容');input.dispatchEvent(new Event('input',{bubbles:true}))}`);
 adb('shell','input','keyevent','4');await see('有尚未保存的修改');let buttons=nodes(dump());let cancel=buttons.find(n=>['cancel','取消'].includes(n.text.toLowerCase()));if(!cancel)throw Error('Native discard cancel missing');await tap(cancel.text);
 assert.equal(await c.evaluate(`document.querySelector('input[name=title]').value`),'原生返回保留内容');
 adb('shell','input','keyevent','4');await see('有尚未保存的修改');buttons=nodes(dump());const ok=buttons.find(n=>['ok','确定'].includes(n.text.toLowerCase()));if(!ok)throw Error('Native discard accept missing');await tap(ok.text);
 await until(`!document.querySelector('input[name=title]')`);adb('shell','input','keyevent','4');await until(`document.querySelector('.mobile-bottom-nav .is-active').textContent.startsWith('工作台')`);
 console.log('PASS: physical Android Back dispatch, discard refusal/acceptance, and return to dashboard');
 await sleep(500); // Let the page entrance animation settle before capturing evidence.
 const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('.preparation/phase6-native/workbench.png',Buffer.from(shot.data,'base64'));
}finally{c.close()}}
main().catch(e=>{console.error(e);process.exitCode=1});
