const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.QA_PLAYWRIGHT_PATH || 'playwright');
const evidence = path.resolve(__dirname, '../.preparation/phase1-browser');
fs.mkdirSync(evidence, { recursive: true });

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const navigate = name => page.locator(width === 390 ? '.mobile-bottom-nav' : '.sidebar-nav').getByRole('button', { name: new RegExp('^' + name) }).click();
      await page.goto('http://127.0.0.1:18189/?role=readonly');
      await page.getByText('测试待办', { exact: true }).waitFor();
      for (const name of ['组织', '人脉', '拜访', '待办']) {
        await navigate(name);
        assert.equal(await page.getByRole('button', { name: /新建|添加联系人|添加组织|记拜访|加待办|录组织|约拜访|发起事项|^完成 |^恢复 / }).count(), 0, `readonly ${width} ${name}`);
      }
      await page.screenshot({ path: path.join(evidence, `readonly-${width}.png`), fullPage: false });
      await page.goto('http://127.0.0.1:18189/');
      await page.getByText('测试待办', { exact: true }).waitFor();
      await navigate('待办');
      await page.getByRole('button', { name: '新建待办', exact: true }).click();
      const title = `界面验收-${width}`;
      await page.locator('input[name="title"]').fill(title);
      await page.locator('.internal-task-toggle input').check();
      await page.locator('textarea[name="description"]').fill('中文补充说明\n第二行“完整保留”');
      await page.getByLabel('注入响应').selectOption('500');
      await page.getByRole('button', { name: '创建待办', exact: true }).click();
      await page.getByText('注入测试错误 500', { exact: true }).waitFor();
      assert.equal(await page.locator('input[name="title"]').inputValue(), title);
      assert.equal(await page.locator('textarea[name="description"]').inputValue(), '中文补充说明\n第二行“完整保留”');
      assert.equal(await page.locator('#qa-count').textContent(), '写请求数：1');
      await page.screenshot({ path: path.join(evidence, `failure-preserves-input-${width}.png`), fullPage: false });
      await page.getByLabel('注入响应').selectOption('success');
      // Two submit events in one tick exercise the synchronous ref lock.
      await page.locator('form.record-form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
      await page.getByText(title, { exact: true }).waitFor();
      assert.equal(await page.locator('#qa-count').textContent(), '写请求数：2');
      await page.reload(); await navigate('待办');
      await page.getByText(title, { exact: true }).waitFor();
      if (width === 390) {
        await page.getByText(title, { exact: true }).locator('..').getByText('补充说明', { exact: true }).click();
      } else {
        await page.getByRole('button', { name: `查看 ${title}`, exact: true }).click();
      }
      await page.getByText('中文补充说明\n第二行“完整保留”', { exact: true }).waitFor();
      await page.screenshot({ path: path.join(evidence, `notes-persist-${width}.png`), fullPage: false });
      if (width !== 390) await page.getByRole('button', { name: '关闭', exact: true }).click();
      const toggle = page.getByRole('button', { name: `完成 ${title}`, exact: true });
      for (const [mode, message] of [['403', '注入测试错误 403'], ['500', '注入测试错误 500'], ['offline', '无法连接业务服务'], ['timeout', '请求超时']]) {
        await page.getByLabel('注入响应').selectOption(mode);
        await toggle.click();
        await page.getByRole('status').filter({ hasText: message }).waitFor();
        assert.equal(await toggle.count(), 1, 'failure must preserve pending status');
      }
      await page.getByLabel('注入响应').selectOption('success');
      await toggle.evaluate(button => { button.click(); button.click(); });
      await page.getByRole('status').filter({ hasText: '待办状态已更新' }).waitFor();
      assert.equal(await page.locator('#qa-count').textContent(), '写请求数：5');
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log(JSON.stringify({ width, readonly: true, failurePreservesInput: true, duplicateSubmitOneWrite: true, notesAfterReload: true, failedTogglePreservesState: true, uncaughtErrors: errors.length }));
      await context.close();
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
