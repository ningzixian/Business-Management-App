const {test}=require('node:test');const assert=require('node:assert/strict');
require('./phase3.test.cjs');const {load}=require('./phase1.test.cjs');
test('I08: authenticated binary requests retain arbitrary bytes',async()=>{
 const payload=new Uint8Array([0,255,128,10,0]);
 const {apiRequest}=load('src/api.ts',{fetch:async()=>new Response(payload,{headers:{'content-type':'image/png'}})});
 const result=await apiRequest('/attachments/id',{responseType:'blob'});
 assert.deepEqual(new Uint8Array(await result.arrayBuffer()),payload);
});
test('I08: binary download errors retain API permission errors',async()=>{
 const {apiRequest}=load('src/api.ts',{fetch:async()=>new Response(JSON.stringify({message:'禁止访问'}),{status:403,headers:{'content-type':'application/json'}})});
 await assert.rejects(apiRequest('/attachments/id',{responseType:'blob'}),/禁止访问/);
});
test('I09: all mobile JSX buttons have actions, submit/reset semantics or explicit disabled state',()=>{
 const fs=require('node:fs');const ts=require('typescript');
 for(const file of ['src/mobile-pages.tsx','src/master-data-pages.tsx','src/settings-pages.tsx','src/overlays.tsx','src/mobile-actions.tsx']){
  const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function walk(node){if((ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))&&node.tagName.getText(source)==='button'){
    const attrs=node.attributes.properties.filter(ts.isJsxAttribute);const names=attrs.map(a=>a.name.text);
    const type=attrs.find(a=>a.name.text==='type')?.initializer?.getText(source);
    assert.ok(names.includes('onClick')||names.includes('disabled')||['"submit"','"reset"'].includes(type),file+': '+node.getText(source));
  }ts.forEachChild(node,walk)}walk(source);
 }
});
