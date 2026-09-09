import { WriteButton } from './write-access'
import { useState, type ReactNode } from 'react'
import {
  AlertTriangle,
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
  Plus,
  Search,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useBusinessNow, useBusinessUser } from './business-clock'
import { inPeriod, isOpen, localDay, sortTasks, weekRange } from './business-metrics'
import { LiveReports } from './live-reports'
import { TaskPreview, SourceVisitButton } from './task-preview'
import { PhoneAction, MapAction } from './mobile-actions'
import type { Customer, EntityId, PageKey, Task, Visit } from './types'
import { InitialAvatar, StatusTag } from './ui'


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
  if (!Number.isFinite(date.getTime())) return '未填写日期'
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${dayNames[date.getDay()]}`
}

function groupDateLabel(value: string, today: string) {
  if (value === today) return '今天 · ' + longDateLabel(value)
  const tomorrow = parseDate(today); tomorrow.setDate(tomorrow.getDate() + 1)
  if (value === toIsoDate(tomorrow)) return '明天 · ' + longDateLabel(value)
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
  const now = useBusinessNow()
  const TODAY = localDay(now)
  const user = useBusinessUser()
  const todayVisits = visits.filter((visit) => visit.date === TODAY).sort((a, b) => a.time.localeCompare(b.time))
  const openTasks = sortTasks(tasks.filter(isOpen))
  const overdueTasks = openTasks.filter((task) => task.status === '已逾期')
  const nextVisit = todayVisits.find((visit) => visit.status === '进行中')
    ?? todayVisits.find((visit) => visit.status === '待开始')

  return (
    <div className="mobile-page mobile-dashboard-page">
      <MobilePageTitle
        eyebrow={longDateLabel(TODAY)}
        title={`${now.getHours() < 12 ? '上午好' : now.getHours() < 18 ? '下午好' : '晚上好'}，${user?.displayName || '同事'}`}
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
            <PhoneAction phone={nextVisit.phone} label="联系客户" />
            <MapAction address={nextVisit.location} label="导航到访" />
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
        <WriteButton type="button" onClick={() => onCreate('visit')}><span><Plus size={18} /></span>记拜访</WriteButton>
        <WriteButton type="button" onClick={() => onCreate('task')}><span><CheckCircle2 size={18} /></span>加待办</WriteButton>
        <WriteButton type="button" onClick={() => onCreate('organization')}><span><UsersRound size={18} /></span>录组织</WriteButton>
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
              <WriteButton className="mobile-task-check" type="button" onClick={() => onToggleTask(task.id)} aria-label={`完成 ${task.title}`}><Circle size={19} /></WriteButton>
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
  onUpdateHierarchy,
}: {
  customers: Customer[]
  onUpdateHierarchy?: import('./organization-tree').HierarchyUpdate
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
        title="组织"
        description="维护组织资料，并查看其主要联系人和关联事项。"
        action={<WriteButton className="mobile-round-add" type="button" onClick={onCreate} aria-label="添加组织"><Plus size={20} /></WriteButton>}
      />
      <label className="mobile-search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="搜索组织、联系人或地区" /></label>
      <div className="mobile-filter-chips" role="tablist" aria-label="客户筛选">
        {(['全部', '重点', '有待办'] as const).map((item) => <button className={filter === item ? 'is-active' : ''} type="button" key={item} onClick={() => setFilter(item)}>{item}</button>)}
      </div>
      <OrganizationTree organizations={customers} onUpdate={onUpdateHierarchy} />
      <section className="mobile-customer-list">
        {filteredCustomers.map((customer) => (
          <article className="mobile-customer-card" key={customer.id}>
            <header>
              <InitialAvatar text={customer.shortName} color={customer.color} />
              <span><strong>{customer.name}</strong><small>{organizationPath(customer, customers)}</small><small>{customer.industry} · {customer.region}</small></span>
              <StatusTag label={customer.status} />
            </header>
            <div className="mobile-contact-strip">
              <span><UserRound size={15} /><b>{customer.contact}</b><small>{customer.phone}</small></span>
              <span><Clock3 size={15} /><b>最近拜访</b><small>{customer.lastVisit}</small></span>
            </div>
            <div className="mobile-next-action"><span>下一步</span><strong>{customer.nextAction}</strong>{customer.openTasks ? <b>{customer.openTasks} 项待办</b> : <b className="is-clear">暂无待办</b>}</div>
            <footer>
              <PhoneAction phone={customer.phone} label="打电话" />
              <MapAction address={customer.address} />
              <WriteButton className="is-primary" type="button" onClick={onCreateVisit}><CalendarCheck2 size={16} />约拜访</WriteButton>
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
  const TODAY = localDay(useBusinessNow())
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
            <header><strong>{groupDateLabel(date, TODAY)}</strong><span>{dateVisits.length} 场</span></header>
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
                  <footer><PhoneAction phone={visit.phone} /><MapAction address={visit.location} /><button type="button" onClick={() => onSelectVisit(visit)}><FileText size={15} />记录</button></footer>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
      <WriteButton className="mobile-wide-create" type="button" onClick={onCreate}><Plus size={18} />新建拜访</WriteButton>
    </div>
  )
}

export function MobileTasksPage({
  tasks: allTasks,
  onToggleTask,
  onCreate,
}: {
  tasks: Task[]
  onToggleTask: (id: EntityId) => void
  onCreate: () => void
}) {
  const now = useBusinessNow()
  const TODAY = localDay(now)
  const user = useBusinessUser()
  const [scope, setScope] = useState<'mine' | 'team'>('mine')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const tasks = sortTasks(allTasks.filter(task => scope === 'team' || task.ownerUserId === user?.userId))
  const [filter, setFilter] = useState<'待完成' | '全部' | '已完成'>('待完成')
  const overdue = tasks.filter((task) => task.status === '已逾期')
  const today = tasks.filter((task) => isOpen(task) && task.status !== '已逾期' && task.due === TODAY)
  const later = tasks.filter((task) => isOpen(task) && task.status !== '已逾期' && task.due !== TODAY)
  const done = tasks.filter((task) => task.status === '已完成')
  const groups = filter === '已完成'
    ? [{ title: '已完成', tone: 'done', tasks: done }]
    : filter === '全部'
      ? [{ title: '已经逾期', tone: 'overdue', tasks: overdue }, { title: '今天', tone: 'today', tasks: today }, { title: '接下来', tone: 'later', tasks: later }, { title: '已完成', tone: 'done', tasks: done }, { title: '已取消', tone: 'done', tasks: tasks.filter(task => task.status === '已取消') }]
      : [{ title: '已经逾期', tone: 'overdue', tasks: overdue }, { title: '今天', tone: 'today', tasks: today }, { title: '接下来', tone: 'later', tasks: later }]

  return (
    <div className="mobile-page">
      <MobilePageTitle
        eyebrow="明确负责人和截止时间"
        title={scope === 'mine' ? '我的待办' : '团队待办'}
        description={`${tasks.filter(isOpen).length} 项待完成，${overdue.length} 项已逾期。`}
        action={<WriteButton className="mobile-round-add" type="button" onClick={onCreate} aria-label="新建待办"><Plus size={20} /></WriteButton>}
      />
      <div className="mobile-segment-control" aria-label="待办范围"><button type="button" className={scope === 'mine' ? 'is-active' : ''} onClick={() => setScope('mine')}>我的待办</button><button type="button" className={scope === 'team' ? 'is-active' : ''} onClick={() => setScope('team')}>团队待办</button></div>
      <p className="report-scope">团队仅包含当前部门授权数据；本周新增 {tasks.filter(t => inPeriod(t.createdAt, weekRange(now))).length} 项</p>
      <section className="mobile-task-overview">
        <article><span><ListTodo size={18} /></span><div><strong>{tasks.filter(isOpen).length}</strong><small>待完成</small></div></article>
        <article className="is-danger"><span><AlertTriangle size={18} /></span><div><strong>{overdue.length}</strong><small>已经逾期</small></div></article>
        <article className="is-success"><span><CheckCircle2 size={18} /></span><div><strong>{done.filter(t => inPeriod(t.completedAt, weekRange(now))).length}</strong><small>本周完成</small></div></article>
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
                  <WriteButton className={`mobile-task-check ${task.status === '已完成' ? 'is-checked' : ''}`} type="button" onClick={() => onToggleTask(task.id)} aria-label={`${task.status === '已完成' ? '恢复' : '完成'} ${task.title}`}>{task.status === '已完成' ? <Check size={17} /> : <Circle size={20} />}</WriteButton>
                  <span className="mobile-task-copy"><strong>{task.title}</strong>{task.content ? <details className="task-description"><summary>补充说明</summary><p>{task.content}</p></details> : null}<small><Building2 size={13} />{task.customer}</small><em><Clock3 size={13} />{task.dueLabel}<b className={`priority-dot priority-${task.priority}`}>{task.priority}</b></em></span>
                  <SourceVisitButton task={task} />
                  <button className="mobile-more-button" type="button" aria-label={`查看 ${task.title}`} onClick={() => setSelectedTask(task)}><MoreHorizontal size={19} /></button>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
      <TaskPreview task={selectedTask} onClose={() => setSelectedTask(null)} />
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
  const TODAY = localDay(useBusinessNow())
  const [selected, setSelectedDate] = useState<string | null>(null)
  const selectedDate = selected || TODAY
  const [month, setMonthDate] = useState<Date | null>(null)
  const monthDate = month || parseDate(selectedDate)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [monthOpen, setMonthOpen] = useState(false)
  const weekDays = getWeekDays(selectedDate)
  const monthDays = getMonthDays(monthDate)
  const selectedVisits = visits.filter((visit) => visit.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time))
  const selectedTasks = tasks.filter((task) => task.due === selectedDate)

  function scheduleCount(date: string) {
    return visits.filter((visit) => visit.date === date).length + tasks.filter((task) => task.due === date).length
  }

  function changeMonth(delta: number) {
    const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + delta, 1)
    setMonthDate(nextMonth)
    setSelectedDate(toIsoDate(nextMonth))
  }

  function selectToday() {
    setSelectedDate(null)
    setMonthDate(null)
    setMonthOpen(false)
  }

  return (
    <div className="mobile-page mobile-calendar-page">
      <MobilePageTitle
        eyebrow="拜访与待办统一日程"
        title="日程"
        description="点选日期，只看当天需要处理的事情。"
        action={<WriteButton className="mobile-round-add" type="button" onClick={onCreate} aria-label="新建日程"><Plus size={20} /></WriteButton>}
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
          <button type="button" className="mobile-calendar-event is-task" key={task.id} onClick={() => setSelectedTask(task)}>
            <time><strong>{task.dueLabel.includes(' ') ? task.dueLabel.split(' ').at(-1) : '全天'}</strong><small>截止</small></time>
            <span className={`mobile-event-marker ${task.status === '已逾期' ? 'event-已延期' : 'event-待开始'}`}><i /></span>
            <span><em>待办事项</em><strong>{task.title}</strong><small><Building2 size={13} />{task.customer}</small></span>
            <StatusTag label={task.status} />
          </button>
        ))}
        <TaskPreview task={selectedTask} onClose={() => setSelectedTask(null)} />
        {selectedVisits.length === 0 && selectedTasks.length === 0 ? <MobileEmpty icon={<CalendarDays />} title="这一天暂无安排" hint="可以新建拜访或待办，提前规划时间。" action={<WriteButton type="button" onClick={onCreate}><Plus size={16} />新建日程</WriteButton>} /> : null}
      </section>
    </div>
  )
}

export function MobileReportsPage(props: { visits: Visit[]; tasks: Task[]; customers: Customer[]; onNotify: (message: string) => void }) {
  return <LiveReports {...props} mobile />
}

function MobileEmpty({ icon, title, hint, action }: { icon: ReactNode; title: string; hint: string; action?: ReactNode }) {
  return <div className="mobile-empty-state"><span>{icon}</span><strong>{title}</strong><p>{hint}</p>{action}</div>
}
import { OrganizationTree, organizationPath } from './organization-tree'
