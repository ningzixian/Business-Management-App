const assert=require('node:assert/strict');
const {chromium}=require(process.env.QA_PLAYWRIGHT_PATH||'playwright');
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:940}}),errors=[];
  page.on('pageerror',err=>{errors.push(err.message);console.error(err.message)});let accept=false;page.on('dialog',dialog=>accept?dialog.accept():dialog.dismiss());
  const nav=async name=>{
   if(width<981&&['组织','人脉'].includes(name)){
    await page.getByRole('button',{name:'打开菜单',exact:true}).click();
    await page.getByRole('dialog',{name:'导航菜单'}).getByRole('button',{name,exact:true}).click();
    await page.getByRole('dialog',{name:'导航菜单'}).waitFor({state:'hidden'});
   }else await page.locator(width<981?'.mobile-bottom-nav':'.sidebar-nav').getByRole('button',{name:new RegExp('^'+name)}).click();
  };
  await page.goto('http://127.0.0.1:18189/?maintenance&role=manager');
  await nav('组织');
  if(width>980) { await page.locator('.customer-row').first().click(); }
  await page.getByRole('button',{name:width<981?'详情与编辑':'管理记录',exact:true}).first().click();
  let dialog=page.getByRole('dialog',{name:'组织档案管理'});
  await dialog.getByLabel('组织名称',{exact:true}).fill('修补后的组织');
  await page.keyboard.press('Escape');assert.equal(await dialog.count(),1,'dirty close cancelled');
  for(const mode of ['409','403','500','offline']){
   await page.evaluate(mode=>{const select=document.querySelector('[aria-label="注入响应"]');select.value=mode;select.dispatchEvent(new Event('change',{bubbles:true}))},mode);
   await dialog.getByRole('button',{name:'保存修改'}).click();await dialog.getByRole('alert').waitFor();
   assert.equal(await dialog.getByLabel('组织名称',{exact:true}).inputValue(),'修补后的组织');
   assert.equal(await dialog.getByRole('status').count(),0,'failure never claims success');
  }
  await page.evaluate(()=>{const select=document.querySelector('[aria-label="注入响应"]');select.value='success';select.dispatchEvent(new Event('change',{bubbles:true}))});
  await dialog.getByRole('button',{name:'保存修改'}).click();await dialog.getByRole('status').waitFor();
  assert.equal(await dialog.getByLabel('组织名称',{exact:true}).inputValue(),'修补后的组织');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await dialog.getByRole('button',{name:'删除记录'}).click();assert.equal(await dialog.count(),1,'delete cancelled');
  accept=true;await dialog.getByRole('button',{name:'关闭',exact:true}).click();accept=false;
  await nav('人脉');
  if(width>980)await page.locator('.contact-library-row').first().click();
  await page.getByRole('button',{name:width<981?'详情与编辑':'管理记录',exact:true}).first().click();
  dialog=page.getByRole('dialog',{name:'人脉档案管理'});
  await dialog.getByLabel('手机',{exact:true}).fill('13900000000');
  await dialog.getByRole('button',{name:'保存修改'}).click();await dialog.getByRole('status').waitFor();
  await dialog.getByRole('button',{name:'添加任职'}).click();
  const aff=page.getByRole('dialog',{name:'添加任职关系'});
  await aff.getByLabel('任职组织').selectOption('qa-org');await aff.getByLabel('职务',{exact:true}).fill('项目经理');
  await aff.getByRole('button',{name:'保存任职'}).click();await aff.waitFor({state:'hidden'});
  await dialog.getByText('修补后的组织 · 项目经理').waitFor();
  accept=true;await dialog.getByRole('button',{name:'关闭',exact:true}).click();accept=false;
  await nav('待办');
  await page.getByRole('button',{name:'查看 测试待办',exact:true}).click();
  await page.getByRole('button',{name:'管理记录',exact:true}).click();
  dialog=page.getByRole('dialog',{name:'待办管理'});
  await dialog.getByLabel('待办标题').fill('已编辑待办');
  await dialog.getByRole('button',{name:'保存修改'}).click();await dialog.getByRole('status').waitFor();
  accept=true;await dialog.getByRole('button',{name:'删除记录'}).click();await dialog.waitFor({state:'hidden'});
  assert.equal(await page.getByText('已编辑待办',{exact:true}).count(),0);
  assert.deepEqual(errors,[]);await page.close();console.log(`PASS maintenance edit/affiliation/delete/dirty/refresh width=${width}`);
 }
 const page=await browser.newPage();await page.goto('http://127.0.0.1:18189/?maintenance&role=readonly');
 await page.locator('.sidebar-nav').getByRole('button',{name:'人脉',exact:true}).click();await page.locator('.contact-library-row').click();await page.getByRole('button',{name:'管理记录'}).click();
 const dialog=page.getByRole('dialog',{name:'人脉档案管理'});await dialog.getByLabel('姓名',{exact:true}).waitFor();
 assert.equal(await dialog.getByRole('button',{name:'保存修改'}).count(),0);assert.equal(await dialog.getByRole('button',{name:'删除记录'}).count(),0);assert.ok(await dialog.getByLabel('姓名',{exact:true}).isDisabled());
 console.log('PASS readonly has no mutation controls');
 }finally{await browser.close()}
}
main().catch(err=>{console.error(err);process.exitCode=1});
