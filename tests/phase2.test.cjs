const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./phase1.test.cjs');
const m = load('src/business-metrics.ts');
const now = new Date('2026-01-01T12:00:00');
const orgs = [{id:'a',region:'北区',industry:'制造'}, {id:'b',region:'南区',industry:'服务'}, {id:'c',region:'',industry:'制造'}];
const task = (id, extra={}) => ({id,title:id,customer:'测试',assignee:'同名',ownerUserId:'u1',due:'2026-01-01',dueLabel:'1月1日 12:00',status:'待处理',organizationIds:['a'],...extra});
test('I03/I10: week crosses year; half-open Monday boundary excludes next Monday',()=>{
 const range=m.weekRange(now); assert.equal(m.localDay(range.start),'2025-12-29');assert.equal(m.localDay(range.end),'2026-01-05');
 assert.equal(m.inPeriod('2025-12-29T00:00:00',range),true);assert.equal(m.inPeriod('2026-01-05T00:00:00',range),false);
 assert.equal(m.inPeriod('2026-01-04T23:59:59',range),true);assert.equal(m.inPeriod(undefined,range),false);
});
test('I10: actual completion time wins, cancelled and undated completion do not count',()=>{
 const tasks=[task('old',{due:'2025-12-01',status:'已完成',completedAt:'2026-01-01T10:00:00'}),task('future-completion',{status:'已完成',completedAt:'2026-01-06T10:00:00'}),task('cancelled',{status:'已取消'}),task('unknown',{status:'已完成'})];
 const r=m.selectReport([],tasks,orgs,m.weekRange(now));assert.equal(r.completedTasks.length,1);assert.equal(r.completedTasks[0].id,'old');assert.equal(r.rate,33);
 assert.equal(m.reportRows(r,orgs).length,r.tasks.length+1);
});
test('I12: district uses organizations, not address; multi-region and missing buckets are disjoint',()=>{
 assert.equal(m.itemRegion(task('1',{location:'南区某大厦'}),orgs),'北区');
 assert.equal(m.itemRegion(task('1',{organizationIds:['a','a']}),orgs),'北区');
 assert.equal(m.itemRegion(task('1',{organizationIds:['a','b']}),orgs),'多地区');
 assert.equal(m.itemRegion(task('1',{organizationIds:['c']}),orgs),'未填写地区');
 assert.equal(m.itemRegion(task('1',{organizationIds:[]}),orgs),'未关联组织');
 const tasks=[task('a'),task('b',{organizationIds:['b']}),task('multi',{organizationIds:['a','b']})];
 const r=m.selectReport([],tasks,orgs,null,'','北区');assert.equal(r.tasks.length,1);assert.equal(m.reportRows(r,orgs)[1].at(-1),'北区');
});
test('I02/I13: ranking uses stable IDs, no NaN for empty input, deterministic deadline sort',()=>{
 const r=m.selectReport([],[],orgs,null);assert.equal(r.rate,0);assert.equal(r.members.length,0);
 const tasks=[task('later',{due:'2026-01-03',ownerUserId:'u2'}),task('early',{due:'2026-01-01'})];
 assert.equal(m.selectReport([],tasks,orgs,null,'u1').tasks.length,1);
 assert.equal(m.selectReport([],tasks,orgs,null).members.length,2);
 assert.equal(m.sortTasks(tasks)[0].id,'early');assert.equal(tasks[0].id,'later');
});
test('I03: deadline crossover updates overdue without changing completed/cancelled state',()=>{
 assert.equal(m.currentTask(task('x'),new Date('2026-01-01T12:00:01')).status,'已逾期');
 assert.equal(m.currentTask(task('x'),new Date('2026-01-01T11:59:59')).status,'待处理');
 assert.equal(m.currentTask(task('x',{status:'已完成'}),new Date('2026-01-02')).status,'已完成');
});
test('I02: weekly chart dates and values reflect supplied data without minimum fake bars',()=>{
 const rows=m.weeklyVisits([{date:'2026-01-01',status:'已完成',completedAt:'2026-01-02T09:00:00'}],now);
 assert.equal(rows[0].fullDate,'2025-12-29');assert.equal(rows[3].planned,1);assert.equal(rows[4].completed,1);assert.equal(rows[0].planned,0);
});
test('I02/I03: missing schedule dates stay missing, never fabricated as today',()=>{
 const {toTask,toVisit}=load('src/api-adapters.ts');
 const item={id:'missing',title:'无日期',organizations:[],contacts:[],ownerUserId:'u1',ownerName:'测试',status:'pending'};
 assert.equal(toTask(item).due,'');assert.equal(toVisit({...item,status:'planned'}).date,'');
 assert.equal(m.selectReport([],[toTask(item)],orgs,null).tasks.length,1);
 assert.equal(m.selectReport([],[toTask(item)],orgs,m.weekRange(now)).tasks.length,0);
});
