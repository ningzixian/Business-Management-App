const assert=require('node:assert/strict');
const {chromium}=require(process.env.QA_PLAYWRIGHT_PATH||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [360,390,980]){
  const page=await browser.newPage({viewport:{width,height:840}});
  await page.goto('http://127.0.0.1:18189/?phase3&phase4');
  await page.locator('.mobile-bottom-nav').waitFor();
  const labels=await page.locator('.mobile-bottom-nav button span').allTextContents();
  assert.deepEqual(labels,['工作台','拜访','待办','日历','统计']);
  for(const name of labels){await page.locator('.mobile-bottom-nav').getByRole('button',{name:new RegExp('^'+name)}).click();assert.equal(await page.locator('.mobile-bottom-nav .is-active span').textContent(),name);}
  const menu=page.getByRole('dialog',{name:'导航菜单'}),opener=page.getByRole('button',{name:'打开菜单'});
  await opener.click();await menu.waitFor();
  assert.ok((await menu.boundingBox()).width<=264.1);
  assert.equal(await page.locator('.mobile-menu-backdrop').evaluate(el=>getComputedStyle(el).backdropFilter),'none');
  await menu.getByRole('button',{name:'关闭菜单'}).click();
  assert.equal(await menu.count(),1,'Exit must not immediately unmount');
  await menu.waitFor({state:'hidden'});
  for(const close of ['escape','outside','back','route']){
   await opener.click();await page.locator('.mobile-menu-backdrop.is-visible').waitFor();
   if(close==='escape')await page.keyboard.press('Escape');
   if(close==='outside')await page.locator('.mobile-menu-backdrop').click({position:{x:width-4,y:200}});
   if(close==='back')await page.evaluate(()=>window.dispatchEvent(new Event('bam-native-back',{cancelable:true})));
   if(close==='route')await menu.getByRole('button',{name:'组织',exact:true}).click();
   await menu.waitFor({state:'hidden'});
  }
  await page.emulateMedia({reducedMotion:'reduce'});await opener.click();await menu.waitFor();
  assert.ok(parseFloat(await menu.evaluate(el=>getComputedStyle(el).transitionDuration))<=0.001);
  await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  console.log(`PASS ${width}: nav order/active, compact drawer, exit lifetime, close paths, reduced motion`);await page.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
