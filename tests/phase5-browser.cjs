const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {chromium}=require(process.env.QA_PLAYWRIGHT_PATH||'playwright');
const dir=path.resolve(__dirname,'../.preparation/phase5-browser');fs.mkdirSync(dir,{recursive:true});
async function main(){const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [390,720,721,980,981,1440]){
  const context=await browser.newContext({viewport:{width,height:940}}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let abandon=false;page.on('dialog',d=>abandon?d.accept():d.dismiss());
  const nav=async name=>{
   if(width<=980&&['组织','人脉'].includes(name)){
    await page.getByRole('button',{name:'打开菜单',exact:true}).click();
    await page.getByRole('dialog',{name:'导航菜单'}).getByRole('button',{name,exact:true}).click();
    await page.getByRole('dialog',{name:'导航菜单'}).waitFor({state:'hidden'});
   }else await page.locator(width<=980?'.mobile-bottom-nav':'.sidebar-nav').getByRole('button',{name:new RegExp('^'+name)}).click();
  };
  await page.goto('http://127.0.0.1:18189/?phase3&phase4');await nav('待办');
  for(const name of ['工作台','组织','人脉','拜访','待办']){
   await nav(name);assert.ok(await page.locator('.main-content').isVisible());
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width} ${name} horizontal overflow`);
  }
  if(width<=980){
   for(const name of ['日历','统计','我的设置']){
    await page.getByRole('button',{name:'打开菜单',exact:true}).click();
    await page.getByRole('dialog',{name:'导航菜单'}).getByRole('button',{name,exact:true}).click();
    await page.getByRole('dialog',{name:'导航菜单'}).waitFor({state:'hidden'});
   }
  }
  await nav('待办');const create=page.getByRole('button',{name:'新建待办',exact:true});await create.click();
  const form=page.locator('form.record-form');const dialog=page.getByRole('dialog');
  await page.keyboard.press('Shift+Tab');assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)));
  for(let n=0;n<25;n++)await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)));
  await page.locator('input[name=title]').fill('第五阶段未保存输入');
  await page.keyboard.press('Escape');assert.equal(await page.locator('input[name=title]').inputValue(),'第五阶段未保存输入');
  await page.getByRole('button',{name:'关闭',exact:true}).click();assert.equal(await form.count(),1);
  await page.evaluate(()=>history.back());await page.waitForTimeout(150);assert.equal(await form.count(),1);
  await page.evaluate(()=>window.dispatchEvent(new Event('bam-native-back',{cancelable:true})));assert.equal(await form.count(),1);
  await page.getByRole('button',{name:'人脉档案',exact:true}).click();assert.equal(await form.locator('input[name=title]').count(),1);
  await page.screenshot({path:path.join(dir,`form-${width}.png`),fullPage:false});
  // Crossing a breakpoint must not remount and discard the draft.
  await page.setViewportSize({width:width<=980?1440:390,height:940});assert.equal(await page.locator('input[name=title]').inputValue(),'第五阶段未保存输入');
  await page.setViewportSize({width,height:940});abandon=true;await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.waitForTimeout(150);assert.ok(await create.evaluate(el=>el===document.activeElement));
  const bell=page.getByRole('button',{name:'通知',exact:true});await bell.click();
  await page.locator('.notification-items button').first().waitFor();assert.equal(await bell.locator('b').textContent(),'1');
  await page.keyboard.press('Escape');assert.equal(await page.locator('.notification-popover').count(),0);assert.ok(await bell.evaluate(el=>el===document.activeElement));
  await bell.click();await page.locator('.main-content').click({position:{x:5,y:5}});assert.equal(await page.locator('.notification-popover').count(),0);
  await bell.click();await page.getByLabel('注入响应').selectOption('offline');await page.getByRole('button',{name:'全部已读',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'已读保存失败'}).waitFor();assert.equal(await bell.locator('b').textContent(),'1');
  await page.getByLabel('注入响应').selectOption('success');await page.getByRole('button',{name:'全部已读',exact:true}).click();await page.locator('.notice-read').waitFor();assert.equal(await bell.locator('b').count(),0);
  await page.reload();await bell.click();await page.locator('.notice-read').waitFor();assert.equal(await bell.locator('b').count(),0);
  await page.screenshot({path:path.join(dir,`notifications-${width}.png`),fullPage:false});
  await page.locator('.notification-items button').first().click();await page.getByRole('dialog',{name:'附件测试待办',exact:true}).waitFor();
  await page.keyboard.press('Escape');await page.goto('http://127.0.0.1:18189/?phase3&phase4&user=other');await bell.click();await page.locator('.notice-unread').waitFor();
  assert.equal(errors.length,0,errors.join('\n'));console.log(JSON.stringify({width,navigation:true,noOverflow:true,focusTrap:true,escape:true,dirtyCloseCancel:true,back:true,resizePreservesDraft:true,focusRestore:true,notificationPersistence:true,readFailure:true,accountIsolation:true,recordJump:true,errors:0}));
  await context.close();
 }
}finally{await browser.close()}}
main().catch(e=>{console.error(e);process.exitCode=1});
