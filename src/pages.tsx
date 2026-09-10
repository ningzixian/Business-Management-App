import { RecordAction } from './record-maintenance'
import { WriteButton } from './write-access'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Download,
  Filter,
  ListTodo,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  TrendingUp,
  UsersRound,
} from 'lucide-react'
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { downloadCsv } from './client-actions'
import { useBusinessNow, useBusinessUser } from './business-clock'
import { inPeriod, isOpen, localDay, reportRows, selectReport, sortTasks, weekRange, weeklyVisits } from './business-metrics'
import { LiveReports } from './live-reports'
import { TaskPreview, SourceVisitButton } from './task-preview'
import { AttachmentPanel } from './attachments'
import type { Customer, EntityId, PageKey, Task, Visit } from './types'
import {
  Card,
  CardHeader,
  InitialAvatar,
  PageHeader,
  PreviewDialog,
  ProgressBar,
  StatusTag,
  TextLink,
} from './ui'

interface VisitActions {
  visits: Visit[]
  onCreate: () => void
  onSelectVisit: (visit: Visit) => void
}

interface DashboardProps {
  customers: Customer[]
  visits: Visit[]
  tasks: Task[]
  displayName: string
  onCreate: (kind: 'visit' | 'task' | 'organization' | 'contact') => void
  onSelectVisit: (visit: Visit) => void
  onToggleTask: (taskId: EntityId) => void
  onNavigate: (page: PageKey) => void
  onNotify: (message: string) => void
}

const todayIso = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}


export function DashboardPage({
  visits,
  tasks,
  displayName,
  customers,
  onCreate,
  onSelectVisit,
  onToggleTask,
  onNavigate,
  onNotify,
}: DashboardProps) {
  const now = useBusinessNow()
  const weekly = selectReport(visits, tasks, customers, weekRange(now))
  const currentVisits = visits.filter(visit => visit.date === localDay(now)).sort((a, b) => a.time.localeCompare(b.time))
  const openTasks = sortTasks(tasks.filter(isOpen))
  const completedTasks = weekly.completedTasks.length
  const overdueTasks = tasks.filter((task) => task.status === '已逾期').length
  const todayTasks = openTasks.filter((task) => task.due === todayIso()).length
  const completionRate = weekly.rate

  function exportWeeklyReport() {
    downloadCsv(`商务活动周报-${localDay(weekRange(now).start)}.csv`, reportRows(weekly, customers))
    onNotify('周报已导出')
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())}
        title={`${new Date().getHours() < 12 ? '上午好' : new Date().getHours() < 18 ? '下午好' : '晚上好'}，${displayName}`}
        description={`今天有 ${currentVisits.length} 次客户拜访，${overdueTasks} 项逾期工作需要关注。`}
        actions={
          <>
            <button className="button button-secondary" type="button" onClick={exportWeeklyReport}>
              <Download size={17} />
              导出周报
            </button>
            <WriteButton className="button button-primary" type="button" onClick={() => onCreate('visit')}>
              <Plus size={18} />
              新建记录
            </WriteButton>
          </>
        }
      />

      <section className="stat-grid" aria-label="工作概览">
        <StatCard
          title="今日拜访"
          value={String(currentVisits.length)}
          hint="按事项时间自动汇总"
          icon={<CalendarCheck2 />}
          tone="blue"
          onClick={() => onNavigate('visits')}
        />
        <StatCard
          title="待办事项"
          value={String(openTasks.length)}
          hint={`其中 ${todayTasks} 项今日到期`}
          icon={<ListTodo />}
          tone="green"
          onClick={() => onNavigate('tasks')}
        />
        <StatCard
          title="本周已完成"
          value={String(completedTasks)}
          hint={`本周事项完成率 ${completionRate}%`}
          icon={<CheckCircle2 />}
          tone="cyan"
          onClick={() => onNavigate('tasks')}
        />
        <StatCard
          title="逾期事项"
          value={String(overdueTasks)}
          hint="需优先处理"
          icon={<AlertTriangle />}
          tone="orange"
          onClick={() => onNavigate('tasks')}
        />
      </section>

      <section className="dashboard-grid dashboard-primary-grid">
        <Card className="performance-card">
          <CardHeader
            title="部门拜访计划"
            subtitle="本周计划与完成情况"
            action={
              <span className="compact-select">本周</span>
            }
          />
          <WeeklyChart visits={visits} />
        </Card>

        <Card className="timeline-card">
          <CardHeader title="今日拜访" subtitle="按计划时间排列" action={<TextLink onClick={() => onNavigate('visits')}>查看全部</TextLink>} />
          <div className="visit-timeline">
            {currentVisits.slice(0, 4).map((visit) => (
              <button
                className="timeline-row"
                key={visit.id}
                type="button"
                onClick={() => onSelectVisit(visit)}
              >
                <time>{visit.time}</time>
                <span className={`timeline-dot dot-${statusTone(visit.status)}`} />
                <span className="timeline-content">
                  <strong>{visit.customer}</strong>
                  <small>
                    <MapPin size={13} /> {visit.region} · {visit.contact}
                  </small>
                </span>
                <StatusTag label={visit.status} />
              </button>
            ))}
          </div>
        </Card>

        <Card className="task-card">
          <CardHeader title="待办事项" subtitle="优先处理到期任务" action={<TextLink onClick={() => onNavigate('tasks')}>全部待办</TextLink>} />
          <div className="compact-task-list">
            {openTasks.slice(0, 4).map((task) => (
              <div className="compact-task" key={task.id}>
                <WriteButton
                  className={`task-check ${task.status === '已完成' ? 'is-checked' : ''}`}
                  type="button"
                  aria-label={`完成 ${task.title}`}
                  onClick={() => onToggleTask(task.id)}
                >
                  {task.status === '已完成' ? <Check size={14} /> : <Circle size={14} />}
                </WriteButton>
                <span className="task-copy">
                  <strong>{task.title}</strong>
                  <small>{task.customer}</small>
                </span>
                <span className={task.status === '已逾期' ? 'due-danger' : 'due-normal'}>
                  {task.dueLabel}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="dashboard-grid dashboard-secondary-grid">
        <Card>
          <CardHeader title="部门完成进度" subtitle="本周行动项执行情况" />
          <div className="progress-summary">
            <div className="progress-ring" style={{ '--progress': `${completionRate}%` } as CSSProperties}>
              <span>{completionRate}%</span>
              <small>完成率</small>
            </div>
            <div className="progress-details">
              <ProgressMetric label="本周完成" value={String(completedTasks)} progress={completionRate} tone="blue" />
              <ProgressMetric label="进行中" value={String(weekly.tasks.filter(t => t.status === '进行中').length)} progress={weekly.tasks.length ? weekly.tasks.filter(t => t.status === '进行中').length / weekly.tasks.length * 100 : 0} tone="green" />
              <ProgressMetric label="已逾期" value={String(weekly.tasks.filter(t => t.status === '已逾期').length)} progress={weekly.tasks.length ? weekly.tasks.filter(t => t.status === '已逾期').length / weekly.tasks.length * 100 : 0} tone="orange" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="最新跟进动态" subtitle="根据事项真实创建时间展示，不代替审计日志" action={<TextLink onClick={() => onNotify('完整审计动态将在 v0.3.0 开放')}>查看动态</TextLink>} />
          <div className="activity-feed">
{[...visits.map(v => ({ id: v.id, name: v.owner, target: v.matter, time: v.createdAt })), ...tasks.map(t => ({ id: t.id, name: t.assignee, target: t.title, time: t.createdAt }))].filter(row => row.time).sort((a, b) => String(b.time).localeCompare(String(a.time))).slice(0, 3).map(row => <Activity key={row.id} name={row.name} action="创建了事项" target={row.target} time={new Date(row.time!).toLocaleString('zh-CN')} />)}
            {![...visits, ...tasks].some(item => item.createdAt) ? <p className="table-empty">暂无真实创建动态</p> : null}
          </div>
        </Card>

        <Card className="quick-card">
          <CardHeader title="快捷操作" subtitle="常用业务入口" />
          <div className="quick-grid">
            <WriteButton type="button" onClick={() => onCreate('visit')}>
              <span><Plus size={18} /></span>
              新建拜访
            </WriteButton>
            <WriteButton type="button" onClick={() => onCreate('organization')}>
              <span><UsersRound size={18} /></span>
              添加组织
            </WriteButton>
            <WriteButton type="button" onClick={() => onCreate('contact')}>
              <span><UsersRound size={18} /></span>
              添加人脉
            </WriteButton>
            <WriteButton type="button" onClick={() => onCreate('task')}>
              <span><ListTodo size={18} /></span>
              创建待办
            </WriteButton>
          </div>
        </Card>
      </section>
    </div>
  )
}

function StatCard({
  title,
  value,
  hint,
  icon,
  tone,
  onClick,
}: {
  title: string
  value: string
  hint: string
  icon: ReactNode
  tone: 'blue' | 'green' | 'cyan' | 'orange'
  onClick?: () => void
}) {
  const content = (
    <>
      <span className="stat-icon">{icon}</span>
      <span className="stat-copy">
        <small>{title}</small>
        <strong>{value}</strong>
        <em>{hint}</em>
      </span>
      {onClick ? <ArrowRight className="stat-arrow" size={18} /> : null}
    </>
  )
  return onClick
    ? <button className={`stat-card stat-${tone}`} type="button" onClick={onClick}>{content}</button>
    : <article className={`stat-card stat-${tone}`}>{content}</article>
}

function WeeklyChart({ visits }: { visits: Visit[] }) {
  const now = useBusinessNow()
  const weeklyPerformance = weeklyVisits(visits, now)
  const max = Math.max(1, ...weeklyPerformance.flatMap(item => [item.planned, item.completed]))

  return (
    <div className="weekly-chart" aria-label="本周拜访计划图表">
      <div className="chart-legend">
        <span><i className="legend-planned" />计划拜访</span>
        <span><i className="legend-completed" />已完成</span>
      </div>
      <div className="chart-body">
        <div className="chart-axis" aria-hidden="true">
          <span>{max}</span><span>{Math.round(max * 2 / 3)}</span><span>{Math.round(max / 3)}</span><span>0</span>
        </div>
        <div className="chart-columns">
          {weeklyPerformance.map((item) => (
            <div className={`chart-column ${item.fullDate === localDay(now) ? 'is-today' : ''}`} key={item.day}>
              <div className="bar-area">
                <span
                  className="bar-planned"
                  title={`计划 ${item.planned}`}
                  style={{ height: `${(item.planned / max) * 100}%` }}
                />
                <span
                  className="bar-completed"
                  title={`完成 ${item.completed}`}
                  style={{ height: `${(item.completed / max) * 100}%` }}
                />
              </div>
              <strong>{item.date}</strong>
              <small>{item.day}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProgressMetric({
  label,
  value,
  progress,
  tone,
}: {
  label: string
  value: string
  progress: number
  tone: 'blue' | 'green' | 'orange'
}) {
  return (
    <div className="progress-metric">
      <span><b>{label}</b><strong>{value}</strong></span>
      <ProgressBar value={progress} tone={tone} />
    </div>
  )
}

function Activity({
  name,
  action,
  target,
  time,
}: {
  name: string
  action: string
  target: string
  time: string
}) {
  return (
    <div className="activity-row">
      <InitialAvatar text={name} size="small" />
      <p><strong>{name}</strong> {action}<br /><span>{target}</span></p>
      <time>{time}</time>
    </div>
  )
}

export function CustomersPage({
  customers: customerList,
  onCreate,
  onNotify,
  onUpdateHierarchy,
}: {
  customers: Customer[]
  onCreate: () => void
  onNotify: (message: string) => void
  onUpdateHierarchy?: import('./organization-tree').HierarchyUpdate
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'全部' | '重点' | '有待办'>('全部')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const filteredCustomers = useMemo(() => customerList.filter((customer) => {
    const queryMatches = `${customer.name}${customer.contact}${customer.region}${customer.owner}`.toLowerCase().includes(query.trim().toLowerCase())
    const filterMatches = filter === '全部' || (filter === '重点' && customer.status === '重点跟进') || (filter === '有待办' && customer.openTasks > 0)
    return queryMatches && filterMatches
  }), [customerList, filter, query])
  const nextFilter = () => setFilter((current) => current === '全部' ? '重点' : current === '重点' ? '有待办' : '全部')

  function exportOrganizations() {
    downloadCsv(`组织-${todayIso()}.csv`, [['组织名称', '行业', '主要联系人', '电话', '地区', '待办', '状态', '负责人'], ...filteredCustomers.map((customer) => [customer.name, customer.industry, customer.contact, customer.phone, customer.region, customer.openTasks, customer.status, customer.owner])])
    onNotify(`已导出 ${filteredCustomers.length} 条组织记录`)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="独立主数据"
        title="组织"
        description="独立维护公司、子公司及组织信息，并通过任职关系关联人脉。"
        actions={
          <WriteButton className="button button-primary" type="button" onClick={onCreate}>
            <Plus size={18} /> 添加组织
          </WriteButton>
        }
      />
      <OrganizationTree organizations={customerList} onUpdate={onUpdateHierarchy} />
      <Toolbar placeholder="搜索组织名称、主要联系人或负责人" query={query} onQueryChange={setQuery} filterLabel={filter} onFilter={nextFilter} onMore={exportOrganizations} moreLabel="导出当前组织列表" />
      <section className="customer-summary-grid">
        <MiniMetric label="组织总数" value={String(customerList.length)} note="部门可见主数据" icon={<Building2 />} />
        <MiniMetric label="重点组织" value={String(customerList.filter((item) => item.status === '重点跟进').length)} note="需优先维护关系" icon={<TrendingUp />} />
        <MiniMetric label="已有拜访" value={String(customerList.filter((item) => item.lastVisit !== '暂无拜访').length)} note="关联事项自动汇总" icon={<CalendarCheck2 />} />
      </section>
      <Card className="table-card">
        <div className="data-table customer-table">
          <div className="table-row table-head">
            <span>组织名称</span><span>主要联系人</span><span>所在地区</span><span>最近拜访</span>
            <span>待办</span><span>状态</span><span>负责人</span><span />
          </div>
          {filteredCustomers.map((customer) => <CustomerRow customer={customer} path={organizationPath(customer, customerList)} key={customer.id} onSelect={() => setSelectedCustomer(customer)} />)}
        </div>
        {!filteredCustomers.length ? <div className="table-empty">没有找到符合条件的组织</div> : null}
      </Card>
      {selectedCustomer ? <PreviewDialog title={selectedCustomer.name} eyebrow="甲方组织详情" onClose={() => setSelectedCustomer(null)}><RecordAction kind="organizations" id={selectedCustomer.id} onDone={() => setSelectedCustomer(null)} /><div className="preview-detail-grid"><DetailValue label="行业" value={selectedCustomer.industry} /><DetailValue label="地区" value={selectedCustomer.region} /><DetailValue label="主要联系人" value={`${selectedCustomer.contact} · ${selectedCustomer.phone}`} /><DetailValue label="负责人" value={selectedCustomer.owner} /><DetailValue label="最近拜访" value={selectedCustomer.lastVisit} /><DetailValue label="下一步行动" value={selectedCustomer.nextAction} /><DetailValue label="待办事项" value={`${selectedCustomer.openTasks} 项`} /><DetailValue label="组织状态" value={selectedCustomer.status} /></div></PreviewDialog> : null}
    </div>
  )
}

function CustomerRow({ customer, path, onSelect }: { customer: Customer; path: string; onSelect: () => void }) {
  return (
    <button className="table-row customer-row" type="button" onClick={onSelect}>
      <span className="customer-cell">
        <InitialAvatar text={customer.shortName} color={customer.color} />
        <span><strong>{customer.name}</strong><small>{customer.industry}</small><small title={path}>{customer.parentOrganizationId ? path : '一级组织'}</small></span>
      </span>
      <span><strong>{customer.contact}</strong><small>{customer.phone}</small></span>
      <span>{customer.region}</span>
      <span>{customer.lastVisit}</span>
      <span><b className="task-count">{customer.openTasks}</b><small>{customer.nextAction}</small></span>
      <span><StatusTag label={customer.status} /></span>
      <span>{customer.owner}</span>
      <span><ChevronRight size={18} /></span>
    </button>
  )
}

export function VisitsPage({ visits, onCreate, onSelectVisit, onNotify }: VisitActions & { onNotify: (message: string) => void }) {
  const today = localDay(useBusinessNow())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'全部' | '今日' | '待开始' | '进行中' | '已完成'>('全部')
  const filteredVisits = useMemo(() => visits.filter((visit) => {
    const queryMatches = `${visit.customer}${visit.contact}${visit.location}${visit.matter}${visit.owner}`.toLowerCase().includes(query.trim().toLowerCase())
    const filterMatches = filter === '全部' || (filter === '今日' && visit.date === today) || visit.status === filter
    return queryMatches && filterMatches
  }), [filter, query, visits, today])

  function exportVisits() {
    downloadCsv(`拜访记录-${todayIso()}.csv`, [['日期', '时间', '组织', '联系人', '地点', '拜访事项', '负责人', '状态'], ...filteredVisits.map((visit) => [visit.date, visit.time, visit.customer, visit.contact, visit.location, visit.matter, visit.owner, visit.status])])
    onNotify(`已导出 ${filteredVisits.length} 条拜访记录`)
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="拜访"
        description="从拜访计划到跟进结果，完整记录每一次客户沟通。"
        actions={
          <WriteButton className="button button-primary" type="button" onClick={onCreate}>
            <Plus size={18} /> 新建拜访
          </WriteButton>
        }
      />
      <Toolbar placeholder="搜索客户、联系人、地点或事项" query={query} onQueryChange={setQuery} filterLabel={filter} onFilter={() => setFilter((current) => current === '全部' ? '今日' : '全部')} onMore={exportVisits} moreLabel="导出当前拜访列表" />
      <div className="filter-tabs" role="tablist" aria-label="拜访筛选">
        {([
          ['全部', visits.length], ['今日', visits.filter(item => item.date === today).length], ['待开始', visits.filter((item) => item.status === '待开始').length], ['进行中', visits.filter((item) => item.status === '进行中').length], ['已完成', visits.filter((item) => item.status === '已完成').length],
        ] as const).map(([label, count]) => <button className={filter === label ? 'is-active' : ''} type="button" key={label} onClick={() => setFilter(label)}>{label} <span>{count}</span></button>)}
      </div>
      <Card className="visit-list-card">
        <div className="visit-list-heading">
          <span>日期与时间</span><span>客户与联系人</span><span>地点</span><span>拜访事项</span><span>负责人</span><span>状态</span><span />
        </div>
        <div className="visit-list">
          {filteredVisits.map((visit) => (
            <button className="visit-list-row" type="button" key={visit.id} onClick={() => onSelectVisit(visit)}>
              <span className="visit-date"><strong>{visit.time}</strong><small>{visit.date}</small></span>
              <span className="visit-customer">
                <InitialAvatar text={visit.shortName} color={visit.color} />
                <span><strong>{visit.customer}</strong><small>{visit.contact} · {visit.phone}</small></span>
              </span>
              <span className="visit-location"><MapPin size={15} />{visit.region}</span>
              <span className="visit-matter">{visit.matter}</span>
              <span>{visit.owner}</span>
              <span><StatusTag label={visit.status} /></span>
              <span><ChevronRight size={18} /></span>
            </button>
          ))}
        </div>
        {!filteredVisits.length ? <div className="table-empty">没有找到符合条件的拜访记录</div> : null}
      </Card>
    </div>
  )
}

export function TasksPage({
  tasks: allTasks,
  onToggleTask,
  onCreate,
  onNotify,
}: {
  tasks: Task[]
  onToggleTask: (id: EntityId) => void
  onCreate: () => void
  onNotify: (message: string) => void
}) {
  const [query, setQuery] = useState('')
  const now = useBusinessNow()
  const user = useBusinessUser()
  const [scope, setScope] = useState<'mine' | 'team'>('mine')
  const tasks = sortTasks(allTasks.filter(t => scope === 'team' || t.ownerUserId === user?.userId))
  const [filter, setFilter] = useState<'全部' | '待完成' | '已完成' | '已逾期'>('全部')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const done = tasks.filter((task) => task.status === '已完成').length
  const overdue = tasks.filter((task) => task.status === '已逾期').length
  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const queryMatches = `${task.title}${task.customer}${task.assignee}${task.source}`.toLowerCase().includes(query.trim().toLowerCase())
    const filterMatches = filter === '全部' || (filter === '待完成' && isOpen(task)) || task.status === filter
    return queryMatches && filterMatches
  }), [filter, query, tasks])

  function exportTasks() {
    downloadCsv(`待办事项-${todayIso()}.csv`, [['待办事项', '组织', '负责人', '截止时间', '优先级', '状态', '来源'], ...filteredTasks.map((task) => [task.title, task.customer, task.assignee, task.dueLabel, task.priority, task.status, task.source])])
    onNotify(`已导出 ${filteredTasks.length} 条待办记录`)
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="待办"
        description="明确负责人和截止时间，让每次拜访都有后续。"
        actions={
          <WriteButton className="button button-primary" type="button" onClick={onCreate}>
            <Plus size={18} /> 新建待办
          </WriteButton>
        }
      />
      <section className="task-summary">
        <Card><span>全部任务</span><strong>{tasks.length}</strong><small>本周新增 {tasks.filter(t => inPeriod(t.createdAt, weekRange(now))).length} 项</small></Card>
        <Card><span>进行中</span><strong>{tasks.filter((item) => item.status === '进行中').length}</strong><small>请按计划推进</small></Card>
        <Card><span>已完成</span><strong>{done}</strong><small>完成率 {Math.round(done / Math.max(1, tasks.filter(t => t.status !== '已取消').length) * 100)}%（不含取消）</small></Card>
        <Card className="danger-card"><span>已逾期</span><strong>{overdue}</strong><small>需要立即处理</small></Card>
      </section>
      <Toolbar placeholder="搜索待办名称、客户或负责人" query={query} onQueryChange={setQuery} filterLabel={filter} onFilter={() => setFilter((current) => current === '全部' ? '待完成' : current === '待完成' ? '已完成' : current === '已完成' ? '已逾期' : '全部')} onMore={exportTasks} moreLabel="导出当前待办列表" />
      <Card className="task-list-card">
        <CardHeader title={scope === 'mine' ? '我的待办' : '团队待办'} subtitle="按截止时间排序；团队仅包含当前部门授权数据" action={<TextLink onClick={() => setScope(scope === 'mine' ? 'team' : 'mine')}>{scope === 'mine' ? '查看团队任务' : '查看我的任务'}</TextLink>} />
        <div className="full-task-list">
          {filteredTasks.map((task) => (
            <div className={`full-task-row ${task.status === '已完成' ? 'is-completed' : ''}`} key={task.id}>
              <WriteButton
                className={`task-check ${task.status === '已完成' ? 'is-checked' : ''}`}
                type="button"
                onClick={() => onToggleTask(task.id)}
                aria-label={`${task.status === '已完成' ? '恢复' : '完成'} ${task.title}`}
              >
                {task.status === '已完成' ? <Check size={15} /> : <Circle size={15} />}
              </WriteButton>
              <span className="full-task-copy">
                <strong>{task.title}</strong>
                <small><Building2 size={13} /> {task.customer} · 来源：{task.source}</small>
              </span>
              <span className={`priority priority-${task.priority}`}>{task.priority}优先级</span>
              <span className="task-owner"><InitialAvatar text={task.assignee} size="small" />{task.assignee}</span>
              <span className={task.status === '已逾期' ? 'due-danger' : 'due-normal'}>
                <Clock3 size={14} /> {task.dueLabel}
              </span>
              <StatusTag label={task.status} />
              <button className="icon-button" type="button" aria-label={`查看 ${task.title}`} onClick={() => setSelectedTask(task)}><MoreHorizontal size={18} /></button>
              <SourceVisitButton task={task} />
            </div>
          ))}
        </div>
        {!filteredTasks.length ? <div className="table-empty">没有找到符合条件的待办</div> : null}
      </Card>
      {selectedTask ? <PreviewDialog title={selectedTask.title} eyebrow="待办详情" onClose={() => setSelectedTask(null)}><RecordAction kind="business-items" id={selectedTask.id} onDone={() => setSelectedTask(null)} /><div className="preview-detail-grid"><DetailValue label="关联组织" value={selectedTask.customer} /><DetailValue label="负责人" value={selectedTask.assignee} /><DetailValue label="截止时间" value={selectedTask.dueLabel} /><DetailValue label="优先级" value={`${selectedTask.priority}优先级`} /><DetailValue label="当前状态" value={selectedTask.status} /><DetailValue label="来源" value={selectedTask.source} /></div><section className="task-description"><h3>补充说明</h3><p>{selectedTask.content || '未填写'}</p></section><AttachmentPanel key={selectedTask.id} itemId={selectedTask.id} /><footer className="preview-dialog-actions"><WriteButton className="button button-primary" type="button" onClick={() => { onToggleTask(selectedTask.id); setSelectedTask(null) }}>{selectedTask.status === '已完成' ? '恢复待办' : '标记完成'}</WriteButton></footer></PreviewDialog> : null}
    </div>
  )
}

function localIsoDate(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function calendarDays(anchor: Date, view: 'week' | 'month') {
  const start = new Date(anchor)
  if (view === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  } else {
    start.setDate(1)
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  }
  return Array.from({ length: view === 'week' ? 7 : 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return { day: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()], date: String(date.getDate()), fullDate: localIsoDate(date), inMonth: date.getMonth() === anchor.getMonth() }
  })
}

export function CalendarPage({ visits, tasks, onSelectVisit, onCreate }: Pick<VisitActions, 'visits' | 'onSelectVisit' | 'onCreate'> & { tasks: Task[] }) {
  const now = useBusinessNow()
  const [manualAnchor, setAnchor] = useState<Date | null>(null)
  const anchor = manualAnchor || now
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [view, setView] = useState<'week' | 'month'>('week')
  const days = useMemo(() => calendarDays(anchor, view), [anchor, view])

  function move(delta: number) {
    setAnchor((current) => {
      const next = new Date(current || now)
      if (view === 'week') next.setDate(next.getDate() + delta * 7)
      else next.setMonth(next.getMonth() + delta, 1)
      return next
    })
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="日历"
        description="按时间查看拜访安排与待办截止日期。"
        actions={
          <WriteButton className="button button-primary" type="button" onClick={onCreate}><Plus size={18} /> 新建日程</WriteButton>
        }
      />
      <TaskPreview task={selectedTask} onClose={() => setSelectedTask(null)} />
      <Card className="calendar-card">
        <div className="calendar-toolbar">
          <div className="month-switcher">
            <button type="button" aria-label={view === 'week' ? '上一周' : '上一月'} onClick={() => move(-1)}><ChevronLeft size={18} /></button>
            <strong>{anchor.getFullYear()}年{anchor.getMonth() + 1}月</strong>
            <button type="button" aria-label={view === 'week' ? '下一周' : '下一月'} onClick={() => move(1)}><ChevronRight size={18} /></button>
            <button className="today-button" type="button" onClick={() => setAnchor(null)}>今天</button>
          </div>
          <div className="calendar-view-switch"><button className={view === 'week' ? 'is-active' : ''} type="button" onClick={() => setView('week')}>周</button><button className={view === 'month' ? 'is-active' : ''} type="button" onClick={() => setView('month')}>月</button></div>
        </div>
        <div className={`week-calendar ${view === 'month' ? 'is-month' : ''}`}>
          {days.map((day) => {
            const dayVisits = visits.filter((visit) => visit.date === day.fullDate).sort((a, b) => a.time.localeCompare(b.time))
            const dayTasks = sortTasks(tasks.filter(task => task.due === day.fullDate))
            return (
              <section className={`calendar-day ${day.fullDate === todayIso() ? 'is-today' : ''} ${!day.inMonth ? 'is-outside-month' : ''}`} key={day.fullDate}>
                <header><span>{day.day}</span><strong>{day.date}</strong></header>
                <div className="calendar-events">
                  {dayVisits.map((visit) => (
                    <button
                      className={`calendar-event event-${statusTone(visit.status)}`}
                      type="button"
                      key={visit.id}
                      onClick={() => onSelectVisit(visit)}
                    >
                      <time>{visit.time}</time><strong>{visit.customer}</strong><small>{visit.contact}</small>
                    </button>
                  ))}
                  {dayTasks.map(task => <button type="button" className="calendar-event event-task" key={task.id} onClick={() => setSelectedTask(task)}><time>待办截止 · {task.dueLabel.split(' ').at(-1)}</time><strong>{task.title}</strong><small>{task.status} · {task.assignee}</small></button>)}
                  {dayVisits.length === 0 && dayTasks.length === 0 ? <span className="empty-day">暂无安排</span> : null}
                </div>
              </section>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

export function ReportsPage(props: { visits: Visit[]; tasks: Task[]; customers: Customer[]; onNotify: (message: string) => void }) {
  return <LiveReports {...props} />
}

function Toolbar({ placeholder, query, onQueryChange, filterLabel, onFilter, onMore, moreLabel }: { placeholder: string; query: string; onQueryChange: (value: string) => void; filterLabel: string; onFilter: () => void; onMore: () => void; moreLabel: string }) {
  return (
    <div className="toolbar">
      <label className="toolbar-search">
        <Search size={17} />
        <input type="search" placeholder={placeholder} value={query} onChange={(event) => onQueryChange(event.target.value)} />
      </label>
      <button className="button button-secondary" type="button" onClick={onFilter}><Filter size={16} /> {filterLabel}</button>
      <button className="icon-button" type="button" aria-label={moreLabel} title={moreLabel} onClick={onMore}><Download size={18} /></button>
    </div>
  )
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return <div><small>{label}</small><strong>{value || '—'}</strong></div>
}

function MiniMetric({
  label,
  value,
  note,
  icon,
}: {
  label: string
  value: string
  note: string
  icon: ReactNode
}) {
  return (
    <Card className="mini-metric">
      <span className="mini-metric-icon">{icon}</span>
      <span><small>{label}</small><strong>{value}</strong><em>{note}</em></span>
    </Card>
  )
}

function statusTone(status: Visit['status']) {
  if (status === '已完成') return 'success'
  if (status === '进行中') return 'primary'
  if (status === '已延期') return 'danger'
  return 'muted'
}
import { OrganizationTree, organizationPath } from './organization-tree'
