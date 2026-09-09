const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.QA_PLAYWRIGHT_PATH || 'playwright');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 fs.mkdirSync('.preparation/app-auth',{recursive:true});
 try {
  for(const [width,height] of [[360,800],[390,844],[390,450],[980,800],[1440,900]]) {
   const page=await browser.newPage({viewport:{width,height}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   let writes=0;
   await page.route('**/api/v1/**',route=>{writes++;return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({message:'测试：账号或密码错误'})})});
   await page.goto('http://127.0.0.1:18193');
   await page.getByLabel('用户名',{exact:true}).fill('ui-test');
   await page.getByLabel('密码',{exact:true}).fill('Example123!');
   const focusStyle=await page.getByLabel('密码',{exact:true}).evaluate(el=>({outline:getComputedStyle(el).outlineStyle,shadow:getComputedStyle(el.parentElement).boxShadow}));
   assert.equal(focusStyle.outline,'none');assert.equal(focusStyle.shadow,'none');
   if(width<=980){
    assert.equal(await page.locator('.app-auth').count(),1);
    assert.ok((await page.locator('.app-auth').boundingBox()).height>=height,'Login background must fill viewport');
    assert.equal(await page.locator('.login-copy').count(),0);
    const iconBox=await page.locator('.app-auth-icon').boundingBox(),textBox=await page.locator('.app-auth-brand-copy').boundingBox();
    assert.ok(textBox.x>=iconBox.x+iconBox.width);
    assert.equal(await page.locator('.login-brand-panel').isVisible(),false);
    assert.equal(await page.locator('.app-auth-footer details').count(),0);
    assert.equal(await page.getByText('连接帮助与版本更新',{exact:true}).count(),0);
    await page.getByRole('button',{name:'显示密码',exact:true}).click();
    assert.equal(await page.getByLabel('密码',{exact:true}).getAttribute('type'),'text');
    await page.getByRole('button',{name:'隐藏密码',exact:true}).click();
   } else assert.equal(await page.locator('.login-brand-panel').isVisible(),true);
   await page.locator('.login-submit').click();
   await page.getByRole('alert').waitFor();
   assert.equal(await page.getByLabel('用户名',{exact:true}).inputValue(),'ui-test');
   await page.getByRole('button',{name:'注册账号',exact:true}).click();
   await page.getByLabel('用户名',{exact:true}).fill('ui-test');
   await page.getByLabel('姓名',{exact:true}).fill('界面测试');
   await page.getByLabel('密码',{exact:true}).fill('Example123!');
   await page.getByLabel('确认密码',{exact:true}).fill('Different123!');
   const before=writes;await page.locator('.login-submit').click();
   await page.getByText('两次输入的密码不一致',{exact:true}).waitFor();assert.equal(writes,before);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`.preparation/app-auth/register-${width}-${height}.png`,fullPage:true});
   await page.locator('.auth-mode-tabs').getByRole('button',{name:'登录',exact:true}).click();
   await page.getByLabel('用户名',{exact:true}).fill('');
   await page.screenshot({path:`.preparation/app-auth/login-${width}-${height}.png`,fullPage:true});
   assert.deepEqual(errors,[]);console.log(`PASS ${width}x${height}: layout, password, login error, registration mismatch, no overflow`);
   await page.close();
  }
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
