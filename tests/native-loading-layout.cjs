// Read layout through the explicitly forwarded app WebView. No API/business writes.
const assert=require('node:assert/strict');
(async()=>{const c=await require('./native-webview.cjs').connect();try{
 const result=await c.evaluate(`(()=>{const node=document.createElement('main');node.className='system-state-screen';node.style.cssText='position:fixed;inset:0;visibility:hidden;pointer-events:none';const item=document.createElement('strong');item.textContent='正在同步部门数据…';node.append(item);document.body.append(node);try{const box=node.getBoundingClientRect(),child=item.getBoundingClientRect();return {height:box.height,viewport:innerHeight,verticalOffset:Math.abs(child.top+child.height/2-(box.top+box.height/2)),horizontalOffset:Math.abs(child.left+child.width/2-(box.left+box.width/2))}}finally{node.remove()}})()`);
 assert.ok(result.height>=result.viewport);assert.ok(result.verticalOffset<1);assert.ok(result.horizontalOffset<1);console.log('PASS native loading screen fills viewport and centers content',result);
}finally{c.close()}})().catch(e=>{console.error(e);process.exitCode=1});
