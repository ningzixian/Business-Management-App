import { useState } from 'react'
import { Card, CardHeader, PageHeader, ProgressBar } from './ui'
import type { Customer, Task, Visit } from './types'
import { inPeriod, itemRegion, localDay, monthRange, reportRows, selectReport, weekRange } from './business-metrics'
import { useBusinessNow } from './business-clock'
import { downloadCsv } from './client-actions'

export function LiveReports({ visits, tasks, customers, onNotify, mobile = false }: { visits: Visit[]; tasks: Task[]; customers: Customer[]; onNotify: (message: string) => void; mobile?: boolean }) {
  const now = useBusinessNow()
  const [period, setPeriod] = useState('month')
  const [owner, setOwner] = useState('')
  const [region, setRegion] = useState('')
  const range = period === 'all' ? null : period === 'week' ? weekRange(now) : monthRange(now)
  const report = selectReport(visits, tasks, customers, range, owner, region)
  const members = new Map([...visits.map(v => [v.ownerUserId || '', v.owner] as const), ...tasks.map(t => [t.ownerUserId || '', t.assignee] as const)])
  const regions = [...new Set([...visits, ...tasks].map(item => itemRegion(item, customers)))].sort()
  const trend = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const month = monthRange(date)
    return { label: `${date.getFullYear()}/${date.getMonth() + 1}`, value: report.visits.filter(v => inPeriod(`${v.date}T${v.time || '00:00'}:00`, month)).length }
  })
  return <div className={mobile ? 'mobile-page live-reports' : 'page-stack live-reports'}>
    <PageHeader title={mobile ? '业务简报' : '统计'} description="按当前授权数据统计；完成数按完成时间，安排按拜访时间/待办截止时间。" actions={<button type="button" className="button button-secondary" onClick={() => { downloadCsv(`商务活动报表-${localDay(now)}.csv`, reportRows(report, customers)); onNotify('已导出当前筛选明细') }}>导出报表</button>} />
    <section className="report-filter-bar">
      <label>期间<select aria-label="统计期间" value={period} onChange={e => setPeriod(e.target.value)}><option value="week">本周</option><option value="month">本月</option><option value="all">全部时间</option></select></label>
      <label>成员<select aria-label="统计成员" value={owner} onChange={e => setOwner(e.target.value)}><option value="">全部成员</option>{[...members].filter(([id]) => id).map(([id, name]) => <option key={id} value={id}>{name} · {id.slice(0, 8)}</option>)}</select></label>
      <label>地区<select aria-label="统计地区" value={region} onChange={e => setRegion(e.target.value)}><option value="">全部地区</option>{regions.map(value => <option key={value}>{value}</option>)}</select></label>
    </section>
    <p className="report-scope">{range ? `${localDay(range.start)}（含）至 ${localDay(range.end)}（不含）` : '全部时间'} · 设备本地时区。明细包含期间内安排或完成的事项；多地区单列且每项仅计一次。缺少完成时间的旧记录不计入完成数；取消事项不计入完成率分母。</p>
    <section className="phase2-metrics">
      {[['拜访事项', report.visits.length], ['覆盖组织', report.covered.length], ['期间完成待办', report.completedTasks.length], ['待办完成率', `${report.rate}%`], ['逾期待办', report.tasks.filter(t => t.status === '已逾期').length]].map(([label, value]) => <Card key={label}><span>{label}</span><strong>{value}</strong></Card>)}
    </section>
    {!report.visits.length && !report.tasks.length ? <div className="table-empty">当前条件暂无业务数据</div> : null}
    <section className="report-grid">
      <Card><CardHeader title="拜访安排趋势" subtitle="最近六个月；与当前期间、成员、地区筛选一致" /><div className="phase2-bars">{trend.map(row => <div key={row.label}><span>{row.label}</span><ProgressBar value={row.value / Math.max(1, ...trend.map(t => t.value)) * 100} /><strong>{row.value}</strong></div>)}</div></Card>
      <Card><CardHeader title="覆盖组织行业" subtitle="按组织 ID 去重，多组织拜访计入各关联组织" />{report.industries.length ? <div className="phase2-bars">{report.industries.map(row => <div key={row.name}><span>{row.name}</span><ProgressBar value={row.value / Math.max(1, report.covered.length) * 100} /><strong>{row.value}</strong></div>)}</div> : <p className="table-empty">暂无组织覆盖数据</p>}</Card>
    </section>
    <Card><CardHeader title="成员执行情况" subtitle="当前筛选范围；按拜访事项数、完成待办数排序" /><div className="ranking-table"><div className="ranking-row ranking-head"><span>成员</span><span>拜访</span><span>期间完成待办</span><span>完成率</span></div>{report.members.map(row => <div className="ranking-row" key={row.id}><span title={row.id}>{row.name}</span><span>{row.visits}</span><span>{row.tasks}</span><span>{row.rate}%</span></div>)}</div>{!report.members.length ? <p className="table-empty">暂无成员统计</p> : null}</Card>
  </div>
}
