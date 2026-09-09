// CDP is limited to the explicitly forwarded, isolated QA Android WebView.
async function connect(){
 const targets=await (await fetch('http://127.0.0.1:18191/json/list')).json();
 const target=targets.find(t=>t.type==='page'&&t.url.startsWith('https://localhost/'));
 if(!target)throw Error('Expected local Capacitor QA WebView');
 const socket=new WebSocket(target.webSocketDebuggerUrl);let id=0;const pending=new Map();
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});
 socket.onmessage=e=>{const value=JSON.parse(e.data);const p=pending.get(value.id);if(p){pending.delete(value.id);value.error?p.reject(Error(JSON.stringify(value.error))):p.resolve(value.result)}};
 async function send(method,params={}){return new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});socket.send(JSON.stringify({id:next,method,params}))})}
 async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
 await send('Page.enable');
 return{send,evaluate,close:()=>socket.close()};
}
module.exports={connect};
