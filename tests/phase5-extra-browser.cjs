const assert=require('node:assert/strict');const {chromium}=require(process.env.QA_PLAYWRIGHT_PATH||'playwright');
async function main(){const browser=await chromium.launch({channel:'msedge'});try{
 for(const width of [390,980,981,1440]){
  const page=await browser.newPage({viewport:{width,height:940}});
  const nav=name=>page.locator(width<=980?'.mobile-bottom-nav':'.sidebar-nav').getByRole('button',{name:new RegExp('^'+name)}).click();
  await page.goto('http://127.0.0.1:18189/?phase3&phase4&phase5');await nav('拜访');
  await page.getByText('第三阶段拜访',{exact:true}).first().click();
  await page.locator('.linked-task').click();assert.equal(await page.getByRole('dialog').count(),2);
  await page.keyboard.press('Tab');assert.ok(await page.getByRole('dialog').last().evaluate(el=>el.contains(document.activeElement)));
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),1);
  assert.ok(await page.locator('.linked-task').evaluate(el=>el===document.activeElement));
  await page.evaluate(()=>history.back());await page.getByRole('dialog').waitFor({state:'hidden'});
  await nav('待办');await page.getByRole('button',{name:'查看 附件测试待办',exact:true}).click();
  const panel=page.locator('.attachment-panel');await panel.getByText('暂无附件',{exact:true}).waitFor();
  await panel.locator('input[type=file]').setInputFiles({name:'busy.txt',mimeType:'text/plain',buffer:Buffer.from('busy test')});
  await page.keyboard.press('Escape');await page.getByText('正在保存或处理附件，请等待完成后再关闭。',{exact:true}).waitFor();
  await panel.getByText('busy.txt',{exact:true}).waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  for(const name of ['日历','统计','设置']){
   if(width<=980){await page.getByRole('button',{name:'打开菜单',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:name==='设置'?'我的设置':name,exact:true}).click()}
   else await page.locator('.sidebar').getByRole('button',{name,exact:true}).click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width} ${name}`);
  }
  console.log(JSON.stringify({width,nestedTopEscape:true,nestedFocusRestore:true,backClosesLast:true,busyAttachmentCloseBlocked:true,secondaryRoutesNoOverflow:true}));await page.close();
 }
}finally{await browser.close()}}
main().catch(e=>{console.error(e);process.exitCode=1});
