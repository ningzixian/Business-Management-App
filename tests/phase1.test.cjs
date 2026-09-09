const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(relative, globals = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, '..', relative);
  if (cache.has(filename)) return cache.get(filename);
  const exports = {}; cache.set(filename, exports);
  const source = fs.readFileSync(filename, 'utf8').replaceAll('import.meta.env', '({})');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const localRequire = name => name.startsWith('.')
    ? load(path.relative(path.resolve(__dirname, '..'), [name, name + '.ts', name + '.tsx'].map(n => path.resolve(path.dirname(filename), n)).find(n => fs.existsSync(n))), globals, cache)
    : require(name);
  vm.runInNewContext(output, { exports, require: localRequire, console, setTimeout, clearTimeout, Headers, FormData, AbortController, navigator: { userAgent: 'QA', platform: 'QA' }, localStorage: { getItem: () => null }, ...globals }, { filename });
  return exports;
}
module.exports = { load };

test('I18: CSV neutralizes formula prefixes, whitespace/control prefixes and preserves numeric cells', () => {
  const { csvCell } = load('src/client-actions.ts');
  for (const value of ['=1+1', '+SUM(1,2)', '-1+2', '@SUM(A1)', '  =1', '\t=1', '\r=1', '\n=1', '\u0000=1', '\tplain']) assert.ok(csvCell(value).startsWith('"\''), JSON.stringify(value));
  assert.equal(csvCell(-12), '"-12"');
  assert.equal(csvCell(0), '"0"');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell('中文,"内容"\n第二行'), '"中文,""内容""\n第二行"');
});
test('I19: invalid or masked numbers never navigate; complete supported numbers stay intact', () => {
  const window = { location: { href: 'unchanged' } };
  const { callablePhone, dialPhone } = load('src/client-actions.ts', { window });
  for (const number of ['', '待补充', '138****1234', '138xxxx1234', '+86+13800138000', '01012345678转123', '123', '(01012345678', '010/12345678', '=12345678']) {
    assert.equal(callablePhone(number), null, number); let unavailable = 0;
    dialPhone(number, () => unavailable++); assert.equal(unavailable, 1); assert.equal(window.location.href, 'unchanged');
  }
  assert.equal(callablePhone('+86 138-0013-8000'), '+8613800138000');
  assert.equal(callablePhone('(010) 1234-5678'), '01012345678');
  dialPhone('138 0013 8000', () => assert.fail('valid number rejected'));
  assert.equal(window.location.href, 'tel:13800138000');
});
test('I18: downloaded CSV contains BOM, escaped text and CRLF rows', async () => {
  let blob, clicked = false, revoked = false;
  const anchor = { click: () => { clicked = true; }, remove: () => {} };
  const { downloadCsv } = load('src/client-actions.ts', {
    Blob, URL: { createObjectURL: value => { blob = value; return 'blob:qa'; }, revokeObjectURL: () => { revoked = true; } },
    document: { createElement: () => anchor, body: { appendChild: () => {} } }, window: { setTimeout: callback => callback() },
  });
  downloadCsv('qa.csv', [['标题', '=1+1'], ['多行\n内容', -2]]);
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.equal(bytes.subarray(0, 3).toString('hex'), 'efbbbf');
  assert.equal(bytes.subarray(3).toString(), '"标题","\'=1+1"\r\n"多行\n内容","-2"');
  assert.equal(anchor.download, 'qa.csv'); assert.equal(clicked, true); assert.equal(revoked, true);
});
test('I04: API adapter preserves multiline Chinese task notes', () => {
  const { toTask } = load('src/api-adapters.ts');
  const content = '中文说明\n第二行 “引号”';
  assert.equal(toTask({ id: 'task', title: 'QA', content, organizations: [], contacts: [], isInternal: true, status: 'pending', ownerName: 'QA', dueAt: '2026-09-08T00:00:00Z' }).content, content);
});
test('I15/I14: write controls absent for readonly, disabled in flight, enabled for writers', () => {
  const { WriteAccess, WriteButton } = load('src/write-access.tsx');
  const render = (canWrite, busy) => renderToStaticMarkup(React.createElement(WriteAccess.Provider, { value: { canWrite, busy } }, React.createElement(WriteButton, { type: 'button' }, '新建')));
  assert.equal(render(false, false), '');
  assert.match(render(true, true), /disabled=""/);
  assert.doesNotMatch(render(true, false), /disabled/);
});
for (const status of [403, 500]) test(`I14: HTTP ${status} is a catchable error without automatic write retry`, async () => {
  let requests = 0;
  const { apiRequest } = load('src/api.ts', { fetch: async () => { requests++; return new Response(JSON.stringify({ message: '测试失败' }), { status, headers: { 'content-type': 'application/json' } }); } });
  await assert.rejects(apiRequest('/business-items', { method: 'POST', body: '{}' }), error => error.status === status && error.message === '测试失败');
  assert.equal(requests, 1);
});
test('I14: network failure reports unconfirmed save rather than claiming success', async () => {
  const { apiRequest } = load('src/api.ts', { fetch: async () => { throw new TypeError('offline'); } });
  await assert.rejects(apiRequest('/business-items', { method: 'POST', body: '{}' }), error => error.status === 0 && /保存结果未确认/.test(error.message));
});
test('I14: hung request aborts on timeout and releases timer', async () => {
  let cleared = false;
  const { apiRequest } = load('src/api.ts', {
    setTimeout: callback => { queueMicrotask(callback); return 1; }, clearTimeout: () => { cleared = true; },
    fetch: (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
  });
  await assert.rejects(apiRequest('/business-items', { method: 'PATCH' }), error => error.status === 408 && /超时/.test(error.message));
  assert.equal(cleared, true);
});
