const assert=require('node:assert/strict');
(async()=>{const client=await require('./native-webview.cjs').connect();try{
 if(process.argv[2]==='seed')await client.evaluate(`localStorage.setItem('phase6-upgrade-sentinel','preserve-me');localStorage.setItem('phase6-old-draft','draft-preserved')`);
 else{assert.equal(await client.evaluate(`localStorage.getItem('phase6-upgrade-sentinel')`),'preserve-me');assert.equal(await client.evaluate(`localStorage.getItem('phase6-old-draft')`),'draft-preserved')}
 console.log('PASS: '+(process.argv[2]==='seed'?'old APK data fixture created':'old APK data preserved after covering installation'));
}finally{client.close()}})().catch(e=>{console.error(e);process.exitCode=1});
