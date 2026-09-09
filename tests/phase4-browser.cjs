const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {chromium}=require(process.env.QA_PLAYWRIGHT_PATH||'playwright');
const dir=path.resolve(__dirname,'../.preparation/phase4-browser');fs.mkdirSync(dir,{recursive:true});
async function main(){const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:940},acceptDownloads:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const nav=name=>page.locator(width===390?'.mobile-bottom-nav':'.sidebar-nav').getByRole('button',{name:new RegExp('^'+name)}).click();
  await page.goto('http://127.0.0.1:18189/?phase3&phase4');await nav('待办');await page.getByRole('button',{name:'查看 附件测试待办',exact:true}).click();
  const panel=page.locator('.attachment-panel');await panel.getByText('暂无附件',{exact:true}).waitFor();
  const payload=Buffer.from('中文附件\nSecond line\u0000\u00ff');
  const picker=panel.locator('input[type=file]');
  await picker.setInputFiles({name:'报告.txt',mimeType:'text/plain',buffer:payload});await panel.getByText('报告.txt',{exact:true}).waitFor();
  const downloadPromise=page.waitForEvent('download');await panel.getByRole('button',{name:'下载',exact:true}).click();const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),'报告.txt');assert.deepEqual(fs.readFileSync(await download.path()),payload);
  await panel.getByText('已交给浏览器下载，请查看下载列表',{exact:true}).waitFor();
  await page.getByRole('button',{name:'关闭',exact:true}).click();await page.reload();await nav('待办');await page.getByRole('button',{name:'查看 附件测试待办',exact:true}).click();
  await panel.getByText('报告.txt',{exact:true}).waitFor();
  await picker.setInputFiles({name:'empty.txt',mimeType:'text/plain',buffer:Buffer.alloc(0)});await panel.getByText('不能上传空文件',{exact:true}).waitFor();
  await picker.setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await panel.getByText(/不支持该格式/).waitFor();
  await picker.setInputFiles({name:'large.txt',mimeType:'text/plain',buffer:Buffer.alloc(20*1024*1024+1)});await panel.getByText('文件超过 20 MB 限制',{exact:true}).waitFor();
  await page.getByLabel('注入响应').selectOption('offline');await picker.setInputFiles({name:'retry.txt',mimeType:'text/plain',buffer:payload});
  await panel.getByText(/上传或删除结果未确认/).waitFor();assert.equal(await panel.getByRole('button',{name:'上传附件',exact:true}).isDisabled(),true);
  await page.getByLabel('注入响应').selectOption('success');await panel.getByRole('button',{name:'刷新附件',exact:true}).click();await panel.getByRole('button',{name:'上传附件',exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('.attachment-panel input[type=file]').disabled);
  await picker.setInputFiles({name:'retry.txt',mimeType:'text/plain',buffer:payload});await panel.getByText('retry.txt',{exact:true}).waitFor();
  await page.screenshot({path:path.join(dir,`attachments-${width}.png`),fullPage:false});
  const row=panel.locator('.attachment-row').filter({hasText:'报告.txt'});await row.getByRole('button',{name:'删除',exact:true}).click();await row.getByRole('button',{name:'取消',exact:true}).click();assert.equal(await row.count(),1);
  await row.getByRole('button',{name:'删除',exact:true}).click();await row.getByRole('button',{name:'确认删除',exact:true}).click();await row.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'关闭',exact:true}).click();await nav('拜访');await page.getByText('第三阶段拜访',{exact:true}).first().click();await page.locator('.attachment-panel').getByText('暂无附件',{exact:true}).waitFor();
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  if(width===390){
   await nav('组织');await page.getByRole('button',{name:'导航',exact:true}).click();await page.getByRole('dialog',{name:'打开外部地图'}).waitFor();
   assert.ok((await page.locator('.map-consent').boundingBox()).width>300);await page.screenshot({path:path.join(dir,'map-consent-390.png'),fullPage:false});
   await page.getByRole('button',{name:'取消',exact:true}).click();
   await nav('人脉');assert.equal(await page.getByRole('button',{name:'联系',exact:true}).isEnabled(),true);
   await nav('工作台');assert.ok(await page.getByRole('button',{name:'暂无有效电话',exact:true}).count()>0);
  }
  await page.goto('http://127.0.0.1:18189/?phase3&phase4&role=readonly');await nav('待办');await page.getByRole('button',{name:'查看 附件测试待办',exact:true}).click();await panel.getByText('retry.txt',{exact:true}).waitFor();
  assert.equal(await panel.getByRole('button',{name:'上传附件',exact:true}).count(),0);assert.equal(await panel.getByRole('button',{name:'删除',exact:true}).count(),0);
  assert.equal(errors.length,0,errors.join('\n'));console.log(JSON.stringify({width,uploadDownloadBytes:true,reload:true,limits:true,offlineRefreshBeforeRetry:true,deleteConfirm:true,perItemIsolation:true,readonly:true,mobileActions:true,errors:0}));await context.close();
 }
}finally{await browser.close()}}
main().catch(e=>{console.error(e);process.exitCode=1});
