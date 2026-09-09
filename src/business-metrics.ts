import type { Customer, Task, Visit } from './types'

export function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function weekRange(now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - (start.getDay() + 6) % 7)
  const end = new Date(start); end.setDate(end.getDate() + 7)
  return { start, end }
}
export function monthRange(now: Date) {
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) }
}
export type Period = ReturnType<typeof weekRange> | null
export function inPeriod(value: string | undefined, period: Period) {
  if (!value || !Number.isFinite(Date.parse(value))) return false
  const date = new Date(value)
  return !period || (date >= period.start && date < period.end)
}
export function taskDeadline(task: Task) { return task.dueAt || `${task.due}T${(task.dueLabel.match(/\d{1,2}:\d{2}/)?.[0] || '23:59').padStart(5, '0')}:00` }
export function isOpen(task: Task) { return !['已完成', '已取消'].includes(task.status) }
export function currentTask(task: Task, now: Date): Task {
  if (!isOpen(task)) return task
  return { ...task, status: Date.parse(taskDeadline(task)) < now.getTime() ? '已逾期' : task.status === '已逾期' ? '待处理' : task.status }
}
export function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => (Date.parse(taskDeadline(a)) || Infinity) - (Date.parse(taskDeadline(b)) || Infinity) || String(a.id).localeCompare(String(b.id)))
}
export function itemRegion(item: Pick<Task, 'organizationIds'>, organizations: Customer[]) {
  if (!item.organizationIds?.length) return '未关联组织'
  const regions = new Set(item.organizationIds.map(id => organizations.find(org => String(org.id) === id)?.region?.trim()).map(region => !region || ['待补充', '未填写'].includes(region) ? '未填写地区' : region))
  return regions.size === 1 ? [...regions][0] : '多地区'
}
export function selectReport(visits: Visit[], tasks: Task[], organizations: Customer[], period: Period, owner = '', region = '') {
  const matches = (item: Visit | Task) => (!owner || item.ownerUserId === owner) && (!region || itemRegion(item, organizations) === region)
  const selectedVisits = visits.filter(v => matches(v) && (!period || inPeriod(`${v.date}T${v.time || '00:00'}:00`, period) || (v.status === '已完成' && inPeriod(v.completedAt, period))))
  const selectedTasks = tasks.filter(t => matches(t) && (!period || inPeriod(taskDeadline(t), period) || (t.status === '已完成' && inPeriod(t.completedAt, period))))
  const completedTasks = selectedTasks.filter(t => t.status === '已完成' && inPeriod(t.completedAt, period))
  const completedVisits = selectedVisits.filter(v => v.status === '已完成' && inPeriod(v.completedAt, period))
  const coveredIds = new Set(selectedVisits.flatMap(v => v.organizationIds || []))
  const covered = organizations.filter(o => coveredIds.has(String(o.id)))
  const ranking = new Map<string, { id: string; name: string; visits: number; tasks: number; total: number; rate: number }>()
  for (const item of [...selectedVisits, ...selectedTasks]) {
    const id = item.ownerUserId || 'unknown'
    if (!ranking.has(id)) ranking.set(id, { id, name: 'owner' in item ? item.owner : item.assignee, visits: 0, tasks: 0, total: 0, rate: 0 })
    const row = ranking.get(id)!
    if ('matter' in item) row.visits++
    else if (item.status !== '已取消') { row.total++; if (completedTasks.includes(item)) row.tasks++ }
  }
  const members = [...ranking.values()].map(row => ({ ...row, rate: row.total ? Math.round(row.tasks / row.total * 100) : 0 })).sort((a, b) => b.visits - a.visits || b.tasks - a.tasks || a.id.localeCompare(b.id))
  const industries = new Map<string, number>()
  for (const org of covered) industries.set(org.industry || '未分类', (industries.get(org.industry || '未分类') || 0) + 1)
  const denominator = selectedTasks.filter(t => t.status !== '已取消').length
  return { visits: selectedVisits, tasks: selectedTasks, completedTasks, completedVisits, covered, members, industries: [...industries].map(([name, value]) => ({ name, value })), rate: denominator ? Math.round(completedTasks.length / denominator * 100) : 0 }
}
export function reportRows(report: ReturnType<typeof selectReport>, organizations: Customer[]) {
  return [['类型', '名称', '组织', '负责人', '安排/截止时间', '完成时间', '状态', '地区归属'],
    ...report.visits.map(v => ['拜访', v.matter, v.customer, v.owner, `${v.date} ${v.time}`, v.completedAt || '', v.status, itemRegion(v, organizations)]),
    ...report.tasks.map(t => ['待办', t.title, t.customer, t.assignee, taskDeadline(t), t.completedAt || '', t.status, itemRegion(t, organizations)])]
}
export function weeklyVisits(visits: Visit[], now: Date) {
  const { start } = weekRange(now)
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start); date.setDate(date.getDate() + i)
    const fullDate = localDay(date)
    return { fullDate, day: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][i], date: `${date.getMonth() + 1}/${date.getDate()}`, planned: visits.filter(v => v.date === fullDate).length, completed: visits.filter(v => v.status === '已完成' && v.completedAt && localDay(new Date(v.completedAt)) === fullDate).length }
  })
}
