const {test}=require('node:test');
const assert=require('node:assert/strict');
require('./phase2.test.cjs');
const {load}=require('./phase1.test.cjs');
test('I07: versioned drafts isolate accounts and departments, preserve multiline fields',()=>{
 const values=new Map();const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 const {draftKey,writeDraft,readDraft}=load('src/visit-draft.ts',{localStorage});
 const key=draftKey('d','a');
 writeDraft(key,{values:{matter:'中文\n第二行'},organizationIds:['o'],contactIds:['c']});
 assert.equal(readDraft(key).values.matter,'中文\n第二行');
 assert.equal(readDraft(draftKey('d','b')),null);assert.equal(readDraft(draftKey('e','a')),null);
 values.set(key,'broken');assert.throws(()=>readDraft(key));
 values.set(key,JSON.stringify({version:1,values:{matter:4},organizationIds:[],contactIds:[]}));assert.throws(()=>readDraft(key));
 values.set(key,JSON.stringify({version:99,values:{},organizationIds:[],contactIds:[]}));assert.throws(()=>readDraft(key));
});
test('I07: storage failures are not reported as successful draft writes',()=>{
 const {writeDraft,readDraft}=load('src/visit-draft.ts',{localStorage:{getItem:()=>{throw Error('denied')},setItem:()=>{throw Error('quota')}}});
 assert.throws(()=>writeDraft('k',{values:{},organizationIds:[],contactIds:[]}),/quota/);assert.throws(()=>readDraft('k'),/denied/);
});
test('I05/I06/I20: adapters preserve revision, real events and source IDs',()=>{
 const {toVisit,toTask}=load('src/api-adapters.ts');
 const item={id:'i',title:'t',status:'planned',organizations:[],contacts:[],participantNames:[],revision:'123',sourceItemId:'source',events:[{id:'e',action:'visit.create',createdAt:'2026-09-08T00:00:00Z'}]};
 assert.equal(toVisit(item).revision,'123');assert.equal(toVisit(item).events[0].id,'e');assert.equal(toTask(item).sourceItemId,'source');
 assert.equal(toVisit({...item,events:undefined}).events,undefined);
});
