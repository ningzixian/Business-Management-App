const assert = require('node:assert/strict')
const { chromium } = require(process.env.QA_PLAYWRIGHT_PATH || 'playwright')

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('http://127.0.0.1:18189/?maintenance&role=manager')

    await page.locator('.mobile-bottom-nav').getByRole('button', { name: /^待办/ }).click()
    await page.getByRole('button', { name: '新建待办', exact: true }).click()
    const form = page.locator('form.record-form')
    await form.waitFor()
    const initial = await form.evaluate(node => ({
      top: node.scrollTop,
      height: node.clientHeight,
      scrollHeight: node.scrollHeight,
      active: document.activeElement?.tagName,
    }))
    assert.equal(initial.top, 0, `表单打开后应位于顶部，实际 scrollTop=${initial.top}`)
    assert.ok(initial.scrollHeight > initial.height, '测试表单应存在可滚动内容')
    await form.evaluate(node => { node.scrollTop = node.scrollHeight })
    assert.ok(await form.evaluate(node => node.scrollTop > 0), '表单应能向下滚动')
    await form.evaluate(node => { node.scrollTop = 0 })
    assert.equal(await form.evaluate(node => node.scrollTop), 0, '表单应能回到顶部')
    assert.equal(initial.active, 'SECTION', '打开弹窗时应聚焦容器，避免 WebView 自动滚动到控件')

    await page.getByRole('button', { name: '关闭', exact: true }).click()
    await page.getByRole('button', { name: '查看 测试待办', exact: true }).click()
    await page.getByRole('button', { name: '管理记录', exact: true }).click()
    const maintenanceBody = page.locator('.preview-dialog-body').last()
    await maintenanceBody.waitFor()
    const maintenance = await maintenanceBody.evaluate(node => ({ top: node.scrollTop, height: node.clientHeight, scrollHeight: node.scrollHeight }))
    assert.equal(maintenance.top, 0, '管理表单打开后应位于顶部')
    assert.ok(maintenance.scrollHeight > maintenance.height, '管理表单应由内容区独立滚动')
    await maintenanceBody.evaluate(node => { node.scrollTop = node.scrollHeight })
    assert.ok(await maintenanceBody.evaluate(node => node.scrollTop > 0), '管理表单应能向下滚动')
    await maintenanceBody.evaluate(node => { node.scrollTop = 0 })
    assert.equal(await maintenanceBody.evaluate(node => node.scrollTop), 0, '管理表单应能向上回到顶部')

    assert.deepEqual(errors, [])
    console.log(JSON.stringify({ viewport: '390x844', createForm: initial, maintenanceForm: maintenance, errors: 0 }))
    await context.close()
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
