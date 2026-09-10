// Run only against the explicitly forwarded Business QA emulator. Synthetic fetch blocks every external call.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {adb}=require('./phase6-native-updater.cjs');
async function main(){
 assert.match(adb('emu','avd','name'),/^Business_QA_API_34/);
 const c=await require('./native-webview.cjs').connect();
 const until=async expr=>{for(let i=0;i<60;i++){if(await c.evaluate(expr))return;await new Promise(r=>setTimeout(r,200))}throw Error(expr)};
 try{
  let source=fs.readFileSync('tests/ui-harness.cjs','utf8').match(/const bootstrap = String.raw`<script>([\s\S]*?)<\/script>`;/)[1];
  source=source.replace('const p=String(url);',"const p=String(url).replace('http://10.0.2.2:18190','');");
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source});
  await c.send('Page.navigate',{url:'https://localhost/?maintenance&role=manager'});
  await until(`Boolean(document.querySelector('.mobile-bottom-nav'))`);
  await c.evaluate(`document.querySelector('[aria-label="打开菜单"]').click()`);
  await until(`Boolean(document.querySelector('.mobile-menu'))`);
  await c.evaluate(`[...document.querySelectorAll('.mobile-menu button')].find(b=>b.textContent==='组织').click()`);
  await until(`!document.querySelector('.mobile-menu')`);
  await c.evaluate(`[...document.querySelectorAll('.mobile-customer-card button')].find(b=>b.textContent==='详情与编辑').click()`);
  await until(`Boolean(document.querySelector('.maintenance-grid input'))`);
  await c.evaluate(`{const input=document.querySelector('.maintenance-grid input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'模拟器编辑组织');input.dispatchEvent(new Event('input',{bubbles:true}))}`);
  await c.evaluate(`document.querySelector('.record-maintenance button[type=submit]').click()`);
  await until(`document.querySelector('.record-maintenance [role=status]')?.textContent.includes('保存成功')`);
  assert.equal(await c.evaluate(`document.querySelector('.maintenance-grid input').value`),'模拟器编辑组织');
  assert.equal(await c.evaluate(`getComputedStyle(document.querySelector('.maintenance-grid')).gridTemplateColumns.split(' ').length`),1);
  assert.ok(await c.evaluate(`document.documentElement.scrollWidth<=innerWidth+1`));
  fs.mkdirSync('.preparation/v026-native',{recursive:true});
  const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('.preparation/v026-native/organization-edit.png',Buffer.from(shot.data,'base64'));
  adb('shell','input','keyevent','4');await until(`!document.querySelector('.record-maintenance')`);
  console.log('PASS Android QA WebView: organization edit/save/refresh, single-column layout, no overflow, native Back after save');
 }finally{c.close()}
}
main().catch(err=>{console.error(err);process.exitCode=1});
