const assert=require('node:assert/strict');
const {chromium}=require(process.env.QA_PLAYWRIGHT_PATH||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [360,1440]){
  const page=await browser.newPage({viewport:{width,height:840}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://192.168.0.253:8088/');await page.getByLabel('用户名',{exact:true}).waitFor();
  assert.equal(await page.locator('.login-brand-panel').isVisible(),width>980);
  assert.equal(await page.locator('.network-check').count(),0);
  if(width>980){
   const title=await page.locator('.login-promise').boundingBox(),cards=await page.locator('.login-feature-grid').boundingBox();
   assert.ok(title.y<840*0.4,'Left title should sit in the upper section');
   assert.ok(cards.y-title.y-title.height<=60,'Feature cards should follow the description');
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.goto('http://192.168.0.253:8088/downloads/');
  const link=page.locator('#download');await link.waitFor({state:'visible'});
  assert.ok((await link.getAttribute('href')).endsWith('/downloads/department-steward-0.2.7.apk'));
  assert.deepEqual(errors,[]);console.log(`PASS production ${width}: login layout, no overflow, download 0.2.7 link, no page errors`);
  await page.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
