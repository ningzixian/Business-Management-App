import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck2,
  CalendarDays,
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
import type { CSSProperties, ReactNode } from 'react'
import { departmentRanking, weeklyPerformance } from './data'
import type { Customer, EntityId, Task, Visit } from './types'
import {
  Card,
  CardHeader,
  InitialAvatar,
  PageHeader,
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
  visits: Visit[]
  tasks: Task[]
  displayName: string
  onCreate: (kind: 'visit' | 'task' | 'organization' | 'contact') => void
  onSelectVisit: (visit: Visit) => void
  onToggleTask: (taskId: EntityId) => void
}

const todayIso = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

const todayVisits = (visits: Visit[]) => visits.filter((visit) => visit.date === todayIso())

export function DashboardPage({
  visits,
  tasks,
  displayName,
  onCreate,
  onSelectVisit,
  onToggleTask,
}: DashboardProps) {
  const currentVisits = todayVisits(visits)
  const openTasks = tasks.filter((task) => task.status !== '已完成')
  const completedTasks = tasks.filter((task) => task.status === '已完成').length
  const overdueTasks = tasks.filter((task) => task.status === '已逾期').length
  const todayTasks = openTasks.filter((task) => task.due === todayIso()).length
  const completionRate = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())}
        title={`${new Date().getHours() < 12 ? '上午好' : new Date().getHours() < 18 ? '下午好' : '晚上好'}，${displayName}`}
        description={`今天有 ${currentVisits.length} 次客户拜访，${overdueTasks} 项逾期工作需要关注。`}
        actions={
          <>
            <button className="button button-secondary" type="button">
              <Download size={17} />
              导出周报
            </button>
            <button className="button button-primary" type="button" onClick={() => onCreate('visit')}>
              <Plus size={18} />
              新建记录
            </button>
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
        />
        <StatCard
          title="待办事项"
          value={String(openTasks.length)}
          hint={`其中 ${todayTasks} 项今日到期`}
          icon={<ListTodo />}
          tone="green"
        />
        <StatCard
          title="本周已完成"
          value={String(completedTasks)}
          hint={`当前完成率 ${completionRate}%`}
          icon={<CheckCircle2 />}
          tone="cyan"
        />
        <StatCard
          title="逾期事项"
          value={String(overdueTasks)}
          hint="需优先处理"
          icon={<AlertTriangle />}
          tone="orange"
        />
      </section>

      <section className="dashboard-grid dashboard-primary-grid">
        <Card className="performance-card">
          <CardHeader
            title="华东客户拜访计划"
            subtitle="本周计划与完成情况"
            action={
              <button className="compact-select" type="button">
                本周 <ChevronRight size={14} />
              </button>
            }
          />
          <WeeklyChart />
        </Card>

        <Card className="timeline-card">
          <CardHeader title="今日拜访" subtitle="按计划时间排列" action={<TextLink>查看全部</TextLink>} />
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
          <CardHeader title="待办事项" subtitle="优先处理到期任务" action={<TextLink>全部待办</TextLink>} />
          <div className="compact-task-list">
            {openTasks.slice(0, 4).map((task) => (
              <div className="compact-task" key={task.id}>
                <button
                  className={`task-check ${task.status === '已完成' ? 'is-checked' : ''}`}
                  type="button"
                  aria-label={`完成 ${task.title}`}
                  onClick={() => onToggleTask(task.id)}
                >
                  {task.status === '已完成' ? <Check size={14} /> : <Circle size={14} />}
                </button>
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
            <div className="progress-ring" style={{ '--progress': '70%' } as CSSProperties}>
              <span>70%</span>
              <small>完成率</small>
            </div>
            <div className="progress-details">
              <ProgressMetric label="已完成" value="28" progress={70} tone="blue" />
              <ProgressMetric label="进行中" value="9" progress={45} tone="green" />
              <ProgressMetric label="已逾期" value="3" progress={15} tone="orange" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="最新跟进动态" subtitle="部门成员最近操作" action={<TextLink>查看动态</TextLink>} />
          <div className="activity-feed">
            <Activity name="张伟" action="完成了拜访记录" target="华东智造科技有限公司" time="09:45" />
            <Activity name="李明" action="更新了跟进结果" target="上海优品贸易有限公司" time="10:20" />
            <Activity name="王佳" action="创建了拜访计划" target="苏州智造企业服务有限公司" time="10:35" />
          </div>
        </Card>

        <Card className="quick-card">
          <CardHeader title="快捷操作" subtitle="常用业务入口" />
          <div className="quick-grid">
            <button type="button" onClick={() => onCreate('visit')}>
              <span><Plus size={18} /></span>
              新建拜访
            </button>
            <button type="button" onClick={() => onCreate('organization')}>
              <span><UsersRound size={18} /></span>
              添加组织
            </button>
            <button type="button" onClick={() => onCreate('contact')}>
              <span><UsersRound size={18} /></span>
              添加人脉
            </button>
            <button type="button" onClick={() => onCreate('task')}>
              <span><ListTodo size={18} /></span>
              创建待办
            </button>
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
}: {
  title: string
  value: string
  hint: string
  icon: ReactNode
  tone: 'blue' | 'green' | 'cyan' | 'orange'
}) {
  return (
    <article className={`stat-card stat-${tone}`}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-copy">
        <small>{title}</small>
        <strong>{value}</strong>
        <em>{hint}</em>
      </span>
      <ArrowRight className="stat-arrow" size={18} />
    </article>
  )
}

function WeeklyChart() {
  const max = Math.max(...weeklyPerformance.map((item) => item.planned))

  return (
    <div className="weekly-chart" aria-label="本周拜访计划图表">
      <div className="chart-legend">
        <span><i className="legend-planned" />计划拜访</span>
        <span><i className="legend-completed" />已完成</span>
      </div>
      <div className="chart-body">
        <div className="chart-axis" aria-hidden="true">
          <span>15</span><span>10</span><span>5</span><span>0</span>
        </div>
        <div className="chart-columns">
          {weeklyPerformance.map((item, index) => (
            <div className={`chart-column ${index === 4 ? 'is-today' : ''}`} key={item.day}>
              <div className="bar-area">
                <span
                  className="bar-planned"
                  style={{ height: `${Math.max(12, (item.planned / max) * 100)}%` }}
                />
                <span
                  className="bar-completed"
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
}: {
  customers: Customer[]
  onCreate: () => void
}) {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="独立主数据"
        title="甲方组织库"
        description="独立维护公司、子公司及组织信息，并通过任职关系关联人脉。"
        actions={
          <button className="button button-primary" type="button" onClick={onCreate}>
            <Plus size={18} /> 添加组织
          </button>
        }
      />
      <Toolbar placeholder="搜索组织名称、主要联系人或负责人" />
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
          {customerList.map((customer) => <CustomerRow customer={customer} key={customer.id} />)}
        </div>
      </Card>
    </div>
  )
}

function CustomerRow({ customer }: { customer: Customer }) {
  return (
    <button className="table-row customer-row" type="button">
      <span className="customer-cell">
        <InitialAvatar text={customer.shortName} color={customer.color} />
        <span><strong>{customer.name}</strong><small>{customer.industry}</small></span>
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

export function VisitsPage({ visits, onCreate, onSelectVisit }: VisitActions) {
  return (
    <div className="page-stack">
      <PageHeader
        title="拜访"
        description="从拜访计划到跟进结果，完整记录每一次客户沟通。"
        actions={
          <button className="button button-primary" type="button" onClick={onCreate}>
            <Plus size={18} /> 新建拜访
          </button>
        }
      />
      <Toolbar placeholder="搜索客户、联系人、地点或事项" />
      <div className="filter-tabs" role="tablist" aria-label="拜访筛选">
        <button className="is-active" type="button">全部 <span>{visits.length}</span></button>
        <button type="button">今日 <span>{todayVisits(visits).length}</span></button>
        <button type="button">待开始 <span>{visits.filter((item) => item.status === '待开始').length}</span></button>
        <button type="button">进行中 <span>{visits.filter((item) => item.status === '进行中').length}</span></button>
        <button type="button">已完成 <span>{visits.filter((item) => item.status === '已完成').length}</span></button>
      </div>
      <Card className="visit-list-card">
        <div className="visit-list-heading">
          <span>日期与时间</span><span>客户与联系人</span><span>地点</span><span>拜访事项</span><span>负责人</span><span>状态</span><span />
        </div>
        <div className="visit-list">
          {visits.map((visit) => (
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
      </Card>
    </div>
  )
}

export function TasksPage({
  tasks,
  onToggleTask,
  onCreate,
}: {
  tasks: Task[]
  onToggleTask: (id: EntityId) => void
  onCreate: () => void
}) {
  const done = tasks.filter((task) => task.status === '已完成').length
  const overdue = tasks.filter((task) => task.status === '已逾期').length

  return (
    <div className="page-stack">
      <PageHeader
        title="待办"
        description="明确负责人和截止时间，让每次拜访都有后续。"
        actions={
          <button className="button button-primary" type="button" onClick={onCreate}>
            <Plus size={18} /> 新建待办
          </button>
        }
      />
      <section className="task-summary">
        <Card><span>全部任务</span><strong>{tasks.length}</strong><small>本周新增 6 项</small></Card>
        <Card><span>进行中</span><strong>{tasks.filter((item) => item.status === '进行中').length}</strong><small>请按计划推进</small></Card>
        <Card><span>已完成</span><strong>{done}</strong><small>完成率 {Math.round((done / tasks.length) * 100)}%</small></Card>
        <Card className="danger-card"><span>已逾期</span><strong>{overdue}</strong><small>需要立即处理</small></Card>
      </section>
      <Toolbar placeholder="搜索待办名称、客户或负责人" />
      <Card className="task-list-card">
        <CardHeader title="我的待办" subtitle="按截止时间排序" action={<TextLink>查看团队任务</TextLink>} />
        <div className="full-task-list">
          {tasks.map((task) => (
            <div className={`full-task-row ${task.status === '已完成' ? 'is-completed' : ''}`} key={task.id}>
              <button
                className={`task-check ${task.status === '已完成' ? 'is-checked' : ''}`}
                type="button"
                onClick={() => onToggleTask(task.id)}
                aria-label={`${task.status === '已完成' ? '恢复' : '完成'} ${task.title}`}
              >
                {task.status === '已完成' ? <Check size={15} /> : <Circle size={15} />}
              </button>
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
              <button className="icon-button" type="button" aria-label="更多操作"><MoreHorizontal size={18} /></button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export function CalendarPage({ visits, onSelectVisit }: Pick<VisitActions, 'visits' | 'onSelectVisit'>) {
  const days = [
    { day: '周一', date: '31', fullDate: '2026-08-31' },
    { day: '周二', date: '1', fullDate: '2026-09-01' },
    { day: '周三', date: '2', fullDate: '2026-09-02' },
    { day: '周四', date: '3', fullDate: '2026-09-03' },
    { day: '周五', date: '4', fullDate: '2026-09-04' },
    { day: '周六', date: '5', fullDate: '2026-09-05' },
    { day: '周日', date: '6', fullDate: '2026-09-06' },
  ]

  return (
    <div className="page-stack">
      <PageHeader
        title="日历"
        description="按时间查看拜访安排与待办截止日期。"
        actions={
          <button className="button button-primary" type="button"><Plus size={18} /> 新建日程</button>
        }
      />
      <Card className="calendar-card">
        <div className="calendar-toolbar">
          <div className="month-switcher">
            <button type="button" aria-label="上一周"><ChevronLeft size={18} /></button>
            <strong>2026年9月</strong>
            <button type="button" aria-label="下一周"><ChevronRight size={18} /></button>
            <button className="today-button" type="button">今天</button>
          </div>
          <div className="calendar-view-switch"><button className="is-active" type="button">周</button><button type="button">月</button></div>
        </div>
        <div className="week-calendar">
          {days.map((day) => {
            const dayVisits = visits.filter((visit) => visit.date === day.fullDate)
            return (
              <section className={`calendar-day ${day.fullDate === '2026-09-04' ? 'is-today' : ''}`} key={day.fullDate}>
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
                  {dayVisits.length === 0 ? <span className="empty-day">暂无安排</span> : null}
                </div>
              </section>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

export function ReportsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="统计"
        description="洞察部门客户覆盖、拜访质量与行动项执行情况。"
        actions={
          <button className="button button-secondary" type="button"><Download size={17} /> 导出报表</button>
        }
      />
      <section className="report-filter-bar">
        <button type="button"><CalendarDays size={16} /> 2026年9月1日 — 9月30日</button>
        <button type="button"><UsersRound size={16} /> 全部成员</button>
        <button type="button"><MapPin size={16} /> 全部地区</button>
      </section>
      <section className="stat-grid report-stat-grid">
        <StatCard title="累计拜访" value="76" hint="环比 +12.6%" icon={<CalendarCheck2 />} tone="blue" />
        <StatCard title="覆盖客户" value="47" hint="新增客户 8 家" icon={<Building2 />} tone="green" />
        <StatCard title="行动项完成率" value="87.5%" hint="环比 +4.2%" icon={<TrendingUp />} tone="cyan" />
        <StatCard title="平均跟进时长" value="1.8天" hint="缩短 0.4 天" icon={<Clock3 />} tone="orange" />
      </section>
      <section className="report-grid">
        <Card>
          <CardHeader title="月度拜访趋势" subtitle="最近六个月拜访数量与完成率" />
          <TrendChart />
        </Card>
        <Card>
          <CardHeader title="客户行业分布" subtitle="按已覆盖客户统计" />
          <IndustryChart />
        </Card>
      </section>
      <Card className="ranking-card">
        <CardHeader title="团队执行情况" subtitle="本月数据，截至今日" action={<TextLink>完整排名</TextLink>} />
        <div className="ranking-table">
          <div className="ranking-row ranking-head"><span>成员</span><span>拜访</span><span>待办完成</span><span>完成率</span></div>
          {departmentRanking.map((member, index) => (
            <div className="ranking-row" key={member.name}>
              <span><b>{index + 1}</b><InitialAvatar text={member.name} size="small" />{member.name}</span>
              <span>{member.visits}</span><span>{member.tasks}</span>
              <span><ProgressBar value={member.rate} /><strong>{member.rate}%</strong></span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function TrendChart() {
  const values = [42, 51, 48, 63, 68, 76]
  return (
    <div className="trend-chart">
      <div className="trend-grid-lines"><span /><span /><span /><span /></div>
      <svg viewBox="0 0 600 190" role="img" aria-label="三月至九月拜访趋势">
        <defs>
          <linearGradient id="trendArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#1677ff" stopOpacity="0.24" />
            <stop offset="1" stopColor="#1677ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M24 145 L134 123 L244 130 L354 91 L464 72 L576 42 L576 174 L24 174 Z" fill="url(#trendArea)" />
        <path d="M24 145 L134 123 L244 130 L354 91 L464 72 L576 42" fill="none" stroke="#1677ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {[24, 134, 244, 354, 464, 576].map((x, i) => <circle key={x} cx={x} cy={[145, 123, 130, 91, 72, 42][i]} r="6" fill="#fff" stroke="#1677ff" strokeWidth="4" />)}
      </svg>
      <div className="trend-labels">
        {['4月', '5月', '6月', '7月', '8月', '9月'].map((label, index) => <span key={label}><strong>{values[index]}</strong>{label}</span>)}
      </div>
    </div>
  )
}

function IndustryChart() {
  const industries = [
    { name: '智能制造', value: 32, color: '#146de0' },
    { name: '商贸零售', value: 24, color: '#19a46b' },
    { name: '软件信息', value: 18, color: '#6b74df' },
    { name: '物流供应链', value: 14, color: '#ed8b2c' },
    { name: '其他', value: 12, color: '#9aa9bc' },
  ]
  return (
    <div className="industry-chart">
      <div className="donut-chart"><span><strong>47</strong>覆盖客户</span></div>
      <div className="industry-legend">
        {industries.map((item) => <div key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><strong>{item.value}%</strong></div>)}
      </div>
    </div>
  )
}

function Toolbar({ placeholder }: { placeholder: string }) {
  return (
    <div className="toolbar">
      <label className="toolbar-search">
        <Search size={17} />
        <input type="search" placeholder={placeholder} />
      </label>
      <button className="button button-secondary" type="button"><Filter size={16} /> 筛选</button>
      <button className="icon-button" type="button" aria-label="更多操作"><MoreHorizontal size={19} /></button>
    </div>
  )
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
