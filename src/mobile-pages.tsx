import { useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  FileText,
  ListTodo,
  MapPin,
  MoreHorizontal,
  Navigation,
  Phone,
  Plus,
  Search,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { departmentRanking } from './data'
import type { Customer, EntityId, PageKey, Task, Visit } from './types'
import { InitialAvatar, StatusTag } from './ui'

const TODAY = '2026-09-04'

const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const shortDayNames = ['日', '一', '二', '三', '四', '五', '六']

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`)
}

function toIsoDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function longDateLabel(value: string) {
  const date = parseDate(value)
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${dayNames[date.getDay()]}`
}

function groupDateLabel(value: string) {
  if (value === TODAY) return '今天 · 9月4日'
  if (value === '2026-09-05') return '明天 · 9月5日'
  const date = parseDate(value)
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${dayNames[date.getDay()]}`
}

function getWeekDays(value: string) {
  const selected = parseDate(value)
  const mondayOffset = (selected.getDay() + 6) % 7
  const monday = new Date(selected)
  monday.setDate(selected.getDate() - mondayOffset)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return date
  })
}

function getMonthDays(value: Date) {
  const firstDay = new Date(value.getFullYear(), value.getMonth(), 1)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const firstCell = new Date(firstDay)
  firstCell.setDate(firstDay.getDate() - mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell)
    date.setDate(firstCell.getDate() + index)
    return date
  })
}

function MobilePageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <header className="mobile-page-title">
      <div>
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </header>
  )
}

function MobileSectionTitle({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <header className="mobile-section-title">
      <div><h2>{title}</h2>{hint ? <span>{hint}</span> : null}</div>
      {action}
    </header>
  )
}

function MobileMetric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: string }) {
  return (
    <article className={`mobile-metric metric-${tone}`}>
      <span>{icon}</span>
      <div><strong>{value}</strong><small>{label}</small></div>
    </article>
  )
}

export function MobileDashboardPage({
  visits,
  tasks,
  onCreate,
  onNavigate,
  onSelectVisit,
  onToggleTask,
}: {
  visits: Visit[]
  tasks: Task[]
  onCreate: (kind: 'visit' | 'task' | 'organization' | 'contact') => void
  onNavigate: (page: PageKey) => void
  onSelectVisit: (visit: Visit) => void
  onToggleTask: (taskId: EntityId) => void
}) {
  const todayVisits = visits.filter((visit) => visit.date === TODAY).sort((a, b) => a.time.localeCompare(b.time))
  const openTasks = tasks.filter((task) => task.status !== '已完成')
  const overdueTasks = openTasks.filter((task) => task.status === '已逾期')
  const nextVisit = todayVisits.find((visit) => visit.status === '进行中')
    ?? todayVisits.find((visit) => visit.status === '待开始')
    ?? todayVisits[0]

  return (
    <div className="mobile-page mobile-dashboard-page">
      <MobilePageTitle
        eyebrow="9月4日 · 星期五"
        title="上午好，张伟"
        description="先处理眼前的拜访和到期事项。"
        action={<button className="mobile-title-action" type="button" onClick={() => onNavigate('calendar')}><CalendarDays size={18} /><span>日程</span></button>}
      />

      {nextVisit ? (
        <section className="mobile-focus-card">
          <header>
            <span className="mobile-live-dot" />
            <strong>{nextVisit.status === '进行中' ? '正在进行' : '下一场拜访'}</strong>
            <time>{nextVisit.time}–{nextVisit.endTime}</time>
          </header>
          <button className="mobile-focus-main" type="button" onClick={() => onSelectVisit(nextVisit)}>
            <InitialAvatar text={nextVisit.shortName} color={nextVisit.color} size="large" />
            <span>
              <strong>{nextVisit.customer}</strong>
              <small>{nextVisit.contact} · {nextVisit.region}</small>
              <em>{nextVisit.matter}</em>
            </span>
            <ChevronRight size={19} />
          </button>
          <div className="mobile-context-actions">
            <button type="button"><Phone size={16} /> 联系客户</button>
            <button type="button"><Navigation size={16} /> 导航到访</button>
            <button type="button" onClick={() => onSelectVisit(nextVisit)}><FileText size={16} /> 详情</button>
          </div>
        </section>
      ) : null}

      <section className="mobile-metric-row" aria-label="今日概览">
        <MobileMetric icon={<CalendarCheck2 />} label="今日拜访" value={String(todayVisits.length)} tone="blue" />
        <MobileMetric icon={<ListTodo />} label="待办事项" value={String(openTasks.length)} tone="green" />
        <MobileMetric icon={<AlertTriangle />} label="已经逾期" value={String(overdueTasks.length)} tone="orange" />
      </section>

      <section className="mobile-quick-create" aria-label="快速创建">
        <button type="button" onClick={() => onCreate('visit')}><span><Plus size={18} /></span>记拜访</button>
        <button type="button" onClick={() => onCreate('task')}><span><CheckCircle2 size={18} /></span>加待办</button>
        <button type="button" onClick={() => onCreate('organization')}><span><UsersRound size={18} /></span>录组织</button>
      </section>

      <section className="mobile-section">
        <MobileSectionTitle
          title="今日日程"
          hint={`${todayVisits.length} 项安排`}
          action={<button className="mobile-text-action" type="button" onClick={() => onNavigate('calendar')}>查看日历 <ChevronRight size={15} /></button>}
        />
        <div className="mobile-agenda-list">
          {todayVisits.slice(0, 4).map((visit) => (
            <button className="mobile-agenda-row" type="button" key={visit.id} onClick={() => onSelectVisit(visit)}>
              <time><strong>{visit.time}</strong><small>{visit.endTime}</small></time>
              <span className={`mobile-agenda-line agenda-${visit.status}`} />
              <span className="mobile-agenda-copy">
                <strong>{visit.customer}</strong>
                <small><MapPin size={13} />{visit.region}</small>
              </span>
              <StatusTag label={visit.status} />
            </button>
          ))}
        </div>
      </section>

      <section className="mobile-section">
        <MobileSectionTitle
          title="优先待办"
          hint="按截止时间排序"
          action={<button className="mobile-text-action" type="button" onClick={() => onNavigate('tasks')}>全部 <ChevronRight size={15} /></button>}
        />
        <div className="mobile-home-task-list">
          {openTasks.slice(0, 3).map((task) => (
            <div className={`mobile-home-task ${task.status === '已逾期' ? 'is-overdue' : ''}`} key={task.id}>
              <button className="mobile-task-check" type="button" onClick={() => onToggleTask(task.id)} aria-label={`完成 ${task.title}`}><Circle size={19} /></button>
              <span><strong>{task.title}</strong><small>{task.customer}</small></span>
              <time>{task.dueLabel}</time>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export function MobileCustomersPage({
  customers,
  onCreate,
  onCreateVisit,
}: {
  customers: Customer[]
  onCreate: () => void
  onCreateVisit: () => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'全部' | '重点' | '有待办'>('全部')
  const filteredCustomers = customers.filter((customer) => {
    const matchesQuery = `${customer.name}${customer.contact}${customer.region}`.toLowerCase().includes(query.trim().toLowerCase())
    const matchesFilter = filter === '全部'
      || (filter === '重点' && customer.status === '重点跟进')
      || (filter === '有待办' && customer.openTasks > 0)
    return matchesQuery && matchesFilter
  })

  return (
    <div className="mobile-page">
      <MobilePageTitle
        eyebrow={`独立主数据 · ${customers.length} 个组织`}
        title="甲方组织库"
        description="维护组织资料，并查看其主要联系人和关联事项。"
        action={<button className="mobile-round-add" type="button" onClick={onCreate} aria-label="添加组织"><Plus size={20} /></button>}
      />
      <label className="mobile-search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="搜索组织、联系人或地区" /></label>
      <div className="mobile-filter-chips" role="tablist" aria-label="客户筛选">
        {(['全部', '重点', '有待办'] as const).map((item) => <button className={filter === item ? 'is-active' : ''} type="button" key={item} onClick={() => setFilter(item)}>{item}</button>)}
      </div>
      <section className="mobile-customer-list">
        {filteredCustomers.map((customer) => (
          <article className="mobile-customer-card" key={customer.id}>
            <header>
              <InitialAvatar text={customer.shortName} color={customer.color} />
              <span><strong>{customer.name}</strong><small>{customer.industry} · {customer.region}</small></span>
              <StatusTag label={customer.status} />
            </header>
            <div className="mobile-contact-strip">
              <span><UserRound size={15} /><b>{customer.contact}</b><small>{customer.phone}</small></span>
              <span><Clock3 size={15} /><b>最近拜访</b><small>{customer.lastVisit}</small></span>
            </div>
            <div className="mobile-next-action"><span>下一步</span><strong>{customer.nextAction}</strong>{customer.openTasks ? <b>{customer.openTasks} 项待办</b> : <b className="is-clear">暂无待办</b>}</div>
            <footer>
              <button type="button"><Phone size={16} />打电话</button>
              <button type="button"><Navigation size={16} />导航</button>
              <button className="is-primary" type="button" onClick={onCreateVisit}><CalendarCheck2 size={16} />约拜访</button>
            </footer>
          </article>
        ))}
        {filteredCustomers.length === 0 ? <MobileEmpty icon={<Search />} title="没有找到组织" hint="换个关键词或筛选条件试试。" /> : null}
      </section>
    </div>
  )
}

export function MobileVisitsPage({
  visits,
  onCreate,
  onOpenCalendar,
  onSelectVisit,
}: {
  visits: Visit[]
  onCreate: () => void
  onOpenCalendar: () => void
  onSelectVisit: (visit: Visit) => void
}) {
  const [filter, setFilter] = useState<'全部' | '今天' | '待拜访' | '已完成'>('全部')
  const filteredVisits = visits.filter((visit) => {
    if (filter === '今天') return visit.date === TODAY
    if (filter === '待拜访') return visit.status === '待开始' || visit.status === '进行中'
    if (filter === '已完成') return visit.status === '已完成'
    return true
  }).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
  const groups = filteredVisits.reduce<Record<string, Visit[]>>((result, visit) => {
    result[visit.date] = [...(result[visit.date] ?? []), visit]
    return result
  }, {})

  return (
    <div className="mobile-page">
      <MobilePageTitle
        eyebrow="计划、签到、记录、跟进"
        title="客户拜访"
        description="按日期查看每一次客户沟通。"
        action={<button className="mobile-title-action" type="button" onClick={onOpenCalendar}><CalendarDays size={18} /><span>日历</span></button>}
      />
      <div className="mobile-segment-control" role="tablist" aria-label="拜访筛选">
        {(['全部', '今天', '待拜访', '已完成'] as const).map((item) => <button className={filter === item ? 'is-active' : ''} type="button" key={item} onClick={() => setFilter(item)}>{item}</button>)}
      </div>
      <section className="mobile-visit-groups">
        {Object.entries(groups).map(([date, dateVisits]) => (
          <div className="mobile-visit-group" key={date}>
            <header><strong>{groupDateLabel(date)}</strong><span>{dateVisits.length} 场</span></header>
            <div>
              {dateVisits.sort((a, b) => a.time.localeCompare(b.time)).map((visit) => (
                <article className="mobile-visit-card" key={visit.id}>
                  <button className="mobile-visit-main" type="button" onClick={() => onSelectVisit(visit)}>
                    <time><strong>{visit.time}</strong><small>{visit.endTime}</small></time>
                    <span className={`mobile-visit-rail rail-${visit.status}`}><i /></span>
                    <span className="mobile-visit-copy">
                      <span><strong>{visit.customer}</strong><StatusTag label={visit.status} /></span>
                      <small>{visit.contact} · {visit.owner}</small>
                      <em>{visit.matter}</em>
                      <small><MapPin size={13} />{visit.region}</small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                  <footer><button type="button"><Phone size={15} />联系</button><button type="button"><Navigation size={15} />导航</button><button type="button" onClick={() => onSelectVisit(visit)}><FileText size={15} />记录</button></footer>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
      <button className="mobile-wide-create" type="button" onClick={onCreate}><Plus size={18} />新建拜访</button>
    </div>
  )
}

export function MobileTasksPage({
  tasks,
  onToggleTask,
  onCreate,
}: {
  tasks: Task[]
  onToggleTask: (id: EntityId) => void
  onCreate: () => void
}) {
  const [filter, setFilter] = useState<'待完成' | '全部' | '已完成'>('待完成')
  const overdue = tasks.filter((task) => task.status === '已逾期')
  const today = tasks.filter((task) => task.status !== '已完成' && task.status !== '已逾期' && task.due === TODAY)
  const later = tasks.filter((task) => task.status !== '已完成' && task.status !== '已逾期' && task.due !== TODAY)
  const done = tasks.filter((task) => task.status === '已完成')
  const groups = filter === '已完成'
    ? [{ title: '已完成', tone: 'done', tasks: done }]
    : filter === '全部'
      ? [{ title: '已经逾期', tone: 'overdue', tasks: overdue }, { title: '今天', tone: 'today', tasks: today }, { title: '接下来', tone: 'later', tasks: later }, { title: '已完成', tone: 'done', tasks: done }]
      : [{ title: '已经逾期', tone: 'overdue', tasks: overdue }, { title: '今天', tone: 'today', tasks: today }, { title: '接下来', tone: 'later', tasks: later }]

  return (
    <div className="mobile-page">
      <MobilePageTitle
        eyebrow="明确负责人和截止时间"
        title="我的待办"
        description={`${tasks.filter((task) => task.status !== '已完成').length} 项待完成，${overdue.length} 项已逾期。`}
        action={<button className="mobile-round-add" type="button" onClick={onCreate} aria-label="新建待办"><Plus size={20} /></button>}
      />
      <section className="mobile-task-overview">
        <article><span><ListTodo size={18} /></span><div><strong>{tasks.length - done.length}</strong><small>待完成</small></div></article>
        <article className="is-danger"><span><AlertTriangle size={18} /></span><div><strong>{overdue.length}</strong><small>已经逾期</small></div></article>
        <article className="is-success"><span><CheckCircle2 size={18} /></span><div><strong>{done.length}</strong><small>本周完成</small></div></article>
      </section>
      <div className="mobile-segment-control mobile-task-segments" role="tablist" aria-label="待办筛选">
        {(['待完成', '全部', '已完成'] as const).map((item) => <button className={filter === item ? 'is-active' : ''} type="button" key={item} onClick={() => setFilter(item)}>{item}</button>)}
      </div>
      <section className="mobile-task-groups">
        {groups.filter((group) => group.tasks.length).map((group) => (
          <div className={`mobile-task-group group-${group.tone}`} key={group.title}>
            <header><strong>{group.title}</strong><span>{group.tasks.length}</span></header>
            <div>
              {group.tasks.map((task) => (
                <article className={`mobile-task-row ${task.status === '已完成' ? 'is-completed' : ''}`} key={task.id}>
                  <button className={`mobile-task-check ${task.status === '已完成' ? 'is-checked' : ''}`} type="button" onClick={() => onToggleTask(task.id)} aria-label={`${task.status === '已完成' ? '恢复' : '完成'} ${task.title}`}>{task.status === '已完成' ? <Check size={17} /> : <Circle size={20} />}</button>
                  <span className="mobile-task-copy"><strong>{task.title}</strong><small><Building2 size={13} />{task.customer}</small><em><Clock3 size={13} />{task.dueLabel}<b className={`priority-dot priority-${task.priority}`}>{task.priority}</b></em></span>
                  <button className="mobile-more-button" type="button" aria-label="更多操作"><MoreHorizontal size={19} /></button>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}

export function MobileCalendarPage({
  visits,
  tasks,
  onCreate,
  onSelectVisit,
}: {
  visits: Visit[]
  tasks: Task[]
  onCreate: () => void
  onSelectVisit: (visit: Visit) => void
}) {
  const [selectedDate, setSelectedDate] = useState(TODAY)
  const [monthDate, setMonthDate] = useState(() => parseDate(TODAY))
  const [monthOpen, setMonthOpen] = useState(false)
  const weekDays = getWeekDays(selectedDate)
  const monthDays = getMonthDays(monthDate)
  const selectedVisits = visits.filter((visit) => visit.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time))
  const selectedTasks = tasks.filter((task) => task.due === selectedDate && task.status !== '已完成')

  function scheduleCount(date: string) {
    return visits.filter((visit) => visit.date === date).length + tasks.filter((task) => task.due === date && task.status !== '已完成').length
  }

  function changeMonth(delta: number) {
    const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + delta, 1)
    setMonthDate(nextMonth)
    setSelectedDate(toIsoDate(nextMonth))
  }

  function selectToday() {
    setSelectedDate(TODAY)
    setMonthDate(parseDate(TODAY))
    setMonthOpen(false)
  }

  return (
    <div className="mobile-page mobile-calendar-page">
      <MobilePageTitle
        eyebrow="拜访与待办统一日程"
        title="日程"
        description="点选日期，只看当天需要处理的事情。"
        action={<button className="mobile-round-add" type="button" onClick={onCreate} aria-label="新建日程"><Plus size={20} /></button>}
      />
      <section className="mobile-calendar-card">
        <header className="mobile-calendar-toolbar">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="上个月"><ChevronLeft size={19} /></button>
          <button className="mobile-month-button" type="button" onClick={() => setMonthOpen((value) => !value)}>{monthDate.getFullYear()}年{monthDate.getMonth() + 1}月 <ChevronDown className={monthOpen ? 'is-open' : ''} size={16} /></button>
          <button type="button" onClick={() => changeMonth(1)} aria-label="下个月"><ChevronRight size={19} /></button>
          <button className="mobile-today-button" type="button" onClick={selectToday}>今天</button>
        </header>

        {monthOpen ? (
          <div className="mobile-month-view">
            <div className="mobile-month-weekdays">{['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="mobile-month-grid">
              {monthDays.map((day) => {
                const date = toIsoDate(day)
                const count = scheduleCount(date)
                const outside = day.getMonth() !== monthDate.getMonth()
                return (
                  <button className={`${date === selectedDate ? 'is-selected' : ''} ${date === TODAY ? 'is-today' : ''} ${outside ? 'is-outside' : ''}`} type="button" key={date} onClick={() => { setSelectedDate(date); setMonthOpen(false) }}>
                    <span>{day.getDate()}</span>{count ? <i>{count > 3 ? '3+' : count}</i> : null}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="mobile-week-strip">
            {weekDays.map((day) => {
              const date = toIsoDate(day)
              const count = scheduleCount(date)
              return (
                <button className={`${date === selectedDate ? 'is-selected' : ''} ${date === TODAY ? 'is-today' : ''}`} type="button" key={date} onClick={() => setSelectedDate(date)}>
                  <small>{shortDayNames[day.getDay()]}</small><strong>{day.getDate()}</strong><span>{Array.from({ length: Math.min(count, 3) }, (_, index) => <i key={index} />)}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="mobile-calendar-agenda">
        <MobileSectionTitle title={selectedDate === TODAY ? '今天' : longDateLabel(selectedDate)} hint={`${selectedVisits.length} 场拜访 · ${selectedTasks.length} 项待办`} />
        <div className="mobile-day-summary"><CalendarCheck2 size={17} /><span>{longDateLabel(selectedDate)}</span><b>{selectedVisits.length + selectedTasks.length} 项安排</b></div>
        {selectedVisits.map((visit) => (
          <button className="mobile-calendar-event" type="button" key={visit.id} onClick={() => onSelectVisit(visit)}>
            <time><strong>{visit.time}</strong><small>{visit.endTime}</small></time>
            <span className={`mobile-event-marker event-${visit.status}`}><i /></span>
            <span><em>客户拜访</em><strong>{visit.customer}</strong><small><MapPin size={13} />{visit.region} · {visit.contact}</small></span>
            <StatusTag label={visit.status} />
          </button>
        ))}
        {selectedTasks.map((task) => (
          <article className="mobile-calendar-event is-task" key={task.id}>
            <time><strong>{task.dueLabel.includes(' ') ? task.dueLabel.split(' ').at(-1) : '全天'}</strong><small>截止</small></time>
            <span className={`mobile-event-marker ${task.status === '已逾期' ? 'event-已延期' : 'event-待开始'}`}><i /></span>
            <span><em>待办事项</em><strong>{task.title}</strong><small><Building2 size={13} />{task.customer}</small></span>
            <b className={`mobile-priority-badge priority-${task.priority}`}>{task.priority}</b>
          </article>
        ))}
        {selectedVisits.length === 0 && selectedTasks.length === 0 ? <MobileEmpty icon={<CalendarDays />} title="这一天暂无安排" hint="可以新建拜访或待办，提前规划时间。" action={<button type="button" onClick={onCreate}><Plus size={16} />新建日程</button>} /> : null}
      </section>
    </div>
  )
}

export function MobileReportsPage() {
  const maxVisits = Math.max(...departmentRanking.map((member) => member.visits))
  return (
    <div className="mobile-page">
      <MobilePageTitle eyebrow="2026年9月" title="业务简报" description="手机端只呈现需要快速判断的核心指标。" />
      <section className="mobile-report-hero">
        <span>本月完成率</span><strong>87.5%</strong><small>较上月提升 6.2%</small><i><b style={{ width: '87.5%' }} /></i>
      </section>
      <section className="mobile-report-kpis">
        <MobileMetric icon={<CalendarCheck2 />} label="累计拜访" value="76" tone="blue" />
        <MobileMetric icon={<Building2 />} label="覆盖客户" value="42" tone="green" />
        <MobileMetric icon={<CheckCircle2 />} label="完成待办" value="96" tone="cyan" />
        <MobileMetric icon={<AlertTriangle />} label="逾期事项" value="7" tone="orange" />
      </section>
      <section className="mobile-section mobile-ranking-card">
        <MobileSectionTitle title="成员执行情况" hint="按本月拜访数" />
        <div className="mobile-ranking-list">
          {departmentRanking.map((member, index) => (
            <article key={member.name}>
              <b>{index + 1}</b><InitialAvatar text={member.name} size="small" /><span><strong>{member.name}</strong><small>{member.tasks} 项待办 · 完成率 {member.rate}%</small><i><em style={{ width: `${(member.visits / maxVisits) * 100}%` }} /></i></span><strong>{member.visits}<small>次</small></strong>
            </article>
          ))}
        </div>
      </section>
      <section className="mobile-insight-card"><span><BarChart3 size={19} /></span><div><strong>本周观察</strong><p>客户拜访完成度稳定，逾期待办主要集中在报价和演示准备，建议今天优先清理。</p></div><ChevronRight size={18} /></section>
    </div>
  )
}

function MobileEmpty({ icon, title, hint, action }: { icon: ReactNode; title: string; hint: string; action?: ReactNode }) {
  return <div className="mobile-empty-state"><span>{icon}</span><strong>{title}</strong><p>{hint}</p>{action}</div>
}
