const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {chromium}=require(process.env.QA_PLAYWRIGHT_PATH||'playwright');
const dir=path.resolve(__dirname,'../.preparation/phase2-browser');fs.mkdirSync(dir,{recursive:true});
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:940},timezoneId:'Asia/Shanghai',acceptDownloads:true});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const time=new Date('2026-12-31T23:59:30+08:00');await page.clock.install({time});await page.clock.pauseAt(new Date(time.getTime()+1000));
  const nav=async name=>{if(width===390&&['日历','统计'].includes(name)){await page.getByRole('button',{name:'打开菜单',exact:true}).click();await page.locator('.mobile-menu nav').getByRole('button',{name,exact:true}).click();}else await page.locator(width===390?'.mobile-bottom-nav':'.sidebar-nav').getByRole('button',{name:new RegExp('^'+name)}).click();};
  await page.goto('http://127.0.0.1:18189/?phase2');
  await page.getByText('我的早到期待办',{exact:true}).first().waitFor();
  assert.doesNotMatch(await page.locator('main').innerText(),/华东客户拜访计划|70%|张伟|87.5%/);
  await page.clock.runFor(40000);
  const heading=await page.locator(width===390?'.mobile-page-title':'.page-heading').innerText();
  assert.match(heading,/1月1日/);
  if(width===390)assert.match(await page.locator('.mobile-focus-main').innerText(),/跨年拜访/);
  await nav('待办');assert.equal(await page.getByText('同名同事待办',{exact:true}).count(),0);
  if(width===390){await page.getByRole('button',{name:'全部',exact:true}).click();await page.getByText('取消待办',{exact:true}).waitFor();await page.getByRole('button',{name:'待完成',exact:true}).click();}
  if(width===390)await page.getByRole('button',{name:'团队待办',exact:true}).click();else await page.getByRole('button',{name:'查看团队任务'}).click();
  await page.getByText('同名同事待办',{exact:true}).waitFor();
  if(width===390)await page.getByRole('button',{name:'我的待办',exact:true}).click();else await page.getByRole('button',{name:'查看我的任务'}).click();
  assert.equal(await page.getByText('同名同事待办',{exact:true}).count(),0);
  const rows=await page.locator(width===390?'.mobile-task-row':'.full-task-row').allTextContents();
  assert.ok(rows.findIndex(r=>r.includes('我的早到期待办'))<rows.findIndex(r=>r.includes('我的次日待办')));
  await page.getByRole('button',{name:'完成 我的早到期待办',exact:true}).click();await page.clock.runFor(1500);await page.getByRole('status').filter({hasText:'待办状态已更新'}).waitFor();
  await nav('日历');
  await page.getByRole('button',{name:/我的次日待办/}).click();
  await page.getByRole('dialog').getByText('第二阶段说明',{exact:true}).waitFor();await page.getByRole('button',{name:'关闭',exact:true}).click();
  if(width===390){await page.locator('.mobile-month-button').click();assert.equal(await page.locator('.mobile-month-grid > button').count(),42);}else{await page.getByRole('button',{name:'月',exact:true}).click();assert.equal(await page.locator('.calendar-day').count(),42);}
  await page.screenshot({path:path.join(dir,`calendar-${width}.png`),fullPage:true});
  await nav('统计');await page.getByLabel('统计期间').selectOption('week');
  assert.match(await page.locator('.phase2-metrics').innerText(),/期间完成待办\s*2/);
  await page.getByLabel('统计地区').selectOption('南区');
  assert.match(await page.locator('.phase2-metrics').innerText(),/拜访事项\s*0/);
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出报表',exact:true}).click();
  const download=await downloadPromise;const csv=fs.readFileSync(await download.path(),'utf8');
  assert.match(csv,/同名同事待办/);assert.doesNotMatch(csv,/我的早到期待办|多地区事项|跨年拜访/);
  await page.getByLabel('统计地区').selectOption('多地区');assert.match(await page.locator('.ranking-table').innerText(),/隔离测试/);
  if(width===390)assert.ok(await page.locator('.ranking-row').first().evaluate(row=>row.getBoundingClientRect().right<=window.innerWidth),'ranking must fit mobile viewport');
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:path.join(dir,`report-${width}.png`),fullPage:true,animations:'disabled'});
  await page.goto('http://127.0.0.1:18189/?empty');await nav('统计');await page.getByText('当前条件暂无业务数据',{exact:true}).waitFor();assert.doesNotMatch(await page.locator('main').innerText(),/NaN|Infinity|87.5%/);
  await page.clock.setFixedTime(new Date('2027-01-02T08:00:00+08:00'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await nav('工作台');assert.match(await page.locator(width===390?'.mobile-page-title':'.page-heading').innerText(),/1月2日/);
  assert.equal(errors.length,0,errors.join('\n'));console.log(JSON.stringify({width,midnight:true,foregroundRefresh:true,scopeById:true,deadlineSort:true,calendarTaskDetail:true,month42:true,regionExport:true,liveCompletionStats:true,emptyState:true,errors:0}));await context.close();
 }}finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
