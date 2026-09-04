import { useEffect, useMemo, useState, type ComponentType } from 'react'
import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  ListTodo,
  MapPinned,
  Menu,
  Plus,
  Search,
  Settings,
  UsersRound,
  X,
} from 'lucide-react'
import { customers as seedCustomers, initialTasks, initialVisits } from './data'
import { CreateRecordModal, VisitDetailDrawer, type CreateKind } from './overlays'
import {
  CalendarPage,
  CustomersPage,
  DashboardPage,
  ReportsPage,
  SettingsPage,
  TasksPage,
  VisitsPage,
} from './pages'
import type { Customer, PageKey, Task, Visit } from './types'
import { InitialAvatar } from './ui'

interface NavItem {
  id: PageKey
  label: string
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}

interface SearchResult {
  type: '拜访' | '客户' | '待办'
  title: string
  subtitle: string
  page: PageKey
  visit?: Visit
}

const primaryNav: NavItem[] = [
  { id: 'dashboard', label: '工作台', icon: LayoutDashboard },
  { id: 'customers', label: '客户', icon: UsersRound },
  { id: 'visits', label: '拜访', icon: MapPinned },
  { id: 'tasks', label: '待办', icon: ListTodo },
  { id: 'calendar', label: '日历', icon: CalendarDays },
  { id: 'reports', label: '统计', icon: BarChart3 },
]

const mobileNav: NavItem[] = [
  { id: 'dashboard', label: '工作台', icon: LayoutDashboard },
  { id: 'customers', label: '客户', icon: UsersRound },
  { id: 'visits', label: '拜访', icon: MapPinned },
  { id: 'tasks', label: '待办', icon: ListTodo },
  { id: 'settings', label: '我的', icon: Settings },
]

const pageTitles: Record<PageKey, string> = {
  dashboard: '工作台',
  customers: '客户',
  visits: '拜访',
  tasks: '待办',
  calendar: '日历',
  reports: '统计',
  settings: '设置',
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

export default function App() {
  const [page, setPage] = useState<PageKey>('dashboard')
  const [visits, setVisits] = useState<Visit[]>(() => readStored('bam-visits-v2', initialVisits))
  const [tasks, setTasks] = useState<Task[]>(() => readStored('bam-tasks', initialTasks))
  const [customerList, setCustomerList] = useState<Customer[]>(() => readStored('bam-customers', seedCustomers))
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createKind, setCreateKind] = useState<CreateKind>('visit')
  const [searchQuery, setSearchQuery] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => localStorage.setItem('bam-visits-v2', JSON.stringify(visits)), [visits])
  useEffect(() => localStorage.setItem('bam-tasks', JSON.stringify(tasks)), [tasks])
  useEffect(() => localStorage.setItem('bam-customers', JSON.stringify(customerList)), [customerList])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const searchResults = useMemo<SearchResult[]>(() => {
    const normalized = searchQuery.trim().toLowerCase()
    if (!normalized) return []
    const visitResults = visits
      .filter((visit) => `${visit.customer}${visit.contact}${visit.location}${visit.matter}`.toLowerCase().includes(normalized))
      .slice(0, 3)
      .map((visit) => ({ type: '拜访' as const, title: visit.customer, subtitle: `${visit.date} ${visit.time} · ${visit.contact}`, page: 'visits' as PageKey, visit }))
    const customerResults = customerList
      .filter((customer) => `${customer.name}${customer.contact}${customer.region}`.toLowerCase().includes(normalized))
      .slice(0, 3)
      .map((customer) => ({ type: '客户' as const, title: customer.name, subtitle: `${customer.contact} · ${customer.region}`, page: 'customers' as PageKey }))
    const taskResults = tasks
      .filter((task) => `${task.title}${task.customer}${task.assignee}`.toLowerCase().includes(normalized))
      .slice(0, 3)
      .map((task) => ({ type: '待办' as const, title: task.title, subtitle: `${task.assignee} · ${task.dueLabel}`, page: 'tasks' as PageKey }))
    return [...visitResults, ...customerResults, ...taskResults].slice(0, 6)
  }, [customerList, searchQuery, tasks, visits])

  function navigate(nextPage: PageKey) {
    setPage(nextPage)
    setMobileMenuOpen(false)
    setSearchQuery('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openCreate(kind: CreateKind) {
    setCreateKind(kind)
    setCreateOpen(true)
  }

  function addVisit(visit: Visit) {
    setVisits((current) => [visit, ...current])
    setCreateOpen(false)
    setPage('visits')
    setToast('拜访记录已保存')
  }

  function addTask(task: Task) {
    setTasks((current) => [task, ...current])
    setCreateOpen(false)
    setPage('tasks')
    setToast('待办事项已创建')
  }

  function addCustomer(customer: Customer) {
    setCustomerList((current) => [customer, ...current])
    setCreateOpen(false)
    setPage('customers')
    setToast('客户档案已添加')
  }

  function toggleTask(taskId: number) {
    setTasks((current) => current.map((task) => (
      task.id === taskId
        ? { ...task, status: task.status === '已完成' ? '待处理' : '已完成' }
        : task
    )))
    setToast('待办状态已更新')
  }

  function renderPage() {
    switch (page) {
      case 'customers':
        return <CustomersPage customers={customerList} onCreate={() => openCreate('customer')} />
      case 'visits':
        return <VisitsPage visits={visits} onCreate={() => openCreate('visit')} onSelectVisit={setSelectedVisit} />
      case 'tasks':
        return <TasksPage tasks={tasks} onToggleTask={toggleTask} onCreate={() => openCreate('task')} />
      case 'calendar':
        return <CalendarPage visits={visits} onSelectVisit={setSelectedVisit} />
      case 'reports':
        return <ReportsPage />
      case 'settings':
        return <SettingsPage />
      default:
        return (
          <DashboardPage
            visits={visits}
            tasks={tasks}
            onCreate={() => openCreate('visit')}
            onSelectVisit={setSelectedVisit}
            onToggleTask={toggleTask}
          />
        )
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand-block">
          <span className="brand-mark"><ClipboardList size={22} /></span>
          <span className="brand-copy"><strong>商务活动管理</strong><small>部门业务协作平台</small></span>
        </div>
        <nav className="sidebar-nav">
          <span className="nav-group-label">业务管理</span>
          {primaryNav.map((item) => (
            <button className={page === item.id ? 'is-active' : ''} type="button" key={item.id} onClick={() => navigate(item.id)}>
              <item.icon size={19} strokeWidth={1.9} />
              <span>{item.label}</span>
              {item.id === 'tasks' ? <b>12</b> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className={page === 'settings' ? 'sidebar-settings is-active' : 'sidebar-settings'} type="button" onClick={() => navigate('settings')}>
            <Settings size={19} /><span>设置</span>
          </button>
          <button className="user-panel" type="button">
            <InitialAvatar text="张伟" size="small" />
            <span><strong>张伟</strong><small>市场部 · 销售经理</small></span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <button className="icon-button menu-button" type="button" onClick={() => setMobileMenuOpen(true)} aria-label="打开菜单"><Menu size={21} /></button>
            <span className="brand-mark"><ClipboardList size={19} /></span>
            <span><strong>部门小管家</strong><small>{pageTitles[page]}</small></span>
          </div>
          <label className="global-search">
            <Search size={18} />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} type="search" placeholder="搜索客户、拜访、待办" />
            <kbd>Ctrl K</kbd>
          </label>
          <div className="topbar-actions">
            <button className="date-button" type="button"><CalendarDays size={17} /><span>2026年9月4日</span><ChevronDown size={14} /></button>
            <div className="notification-wrap">
              <button className="icon-button notification-button" type="button" onClick={() => setNotificationsOpen((value) => !value)} aria-label="通知">
                <Bell size={19} /><b>3</b>
              </button>
              {notificationsOpen ? <NotificationPopover onClose={() => setNotificationsOpen(false)} /> : null}
            </div>
            <button className="topbar-user" type="button"><InitialAvatar text="张伟" size="small" /><span>张伟</span><ChevronDown size={14} /></button>
          </div>
          {searchQuery ? (
            <div className="search-popover">
              <header><span>搜索结果</span><button type="button" onClick={() => setSearchQuery('')}><X size={15} /></button></header>
              {searchResults.length ? searchResults.map((result, index) => (
                <button
                  type="button"
                  key={`${result.type}-${result.title}-${index}`}
                  onClick={() => {
                    navigate(result.page)
                    if (result.visit) setSelectedVisit(result.visit)
                  }}
                >
                  <span>{result.type}</span><p><strong>{result.title}</strong><small>{result.subtitle}</small></p>
                </button>
              )) : <p className="no-result">没有找到相关记录</p>}
            </div>
          ) : null}
        </header>
        <main className="main-content">{renderPage()}</main>
      </section>

      <nav className="mobile-bottom-nav" aria-label="移动端导航">
        {mobileNav.map((item) => (
          <button className={page === item.id ? 'is-active' : ''} type="button" key={item.id} onClick={() => navigate(item.id)}>
            <item.icon size={20} strokeWidth={1.9} /><span>{item.label}</span>
            {item.id === 'tasks' ? <b>3</b> : null}
          </button>
        ))}
      </nav>
      <button className="mobile-fab" type="button" onClick={() => openCreate('visit')} aria-label="新建记录"><Plus size={25} /></button>

      {mobileMenuOpen ? (
        <div className="mobile-menu-backdrop" role="presentation" onMouseDown={() => setMobileMenuOpen(false)}>
          <aside className="mobile-menu" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span className="brand-mark"><ClipboardList size={20} /></span><strong>部门小管家</strong></div><button className="icon-button" type="button" onClick={() => setMobileMenuOpen(false)}><X size={20} /></button></header>
            <nav>{primaryNav.map((item) => <button className={page === item.id ? 'is-active' : ''} type="button" key={item.id} onClick={() => navigate(item.id)}><item.icon size={19} />{item.label}</button>)}</nav>
          </aside>
        </div>
      ) : null}

      <CreateRecordModal
        open={createOpen}
        initialKind={createKind}
        onClose={() => setCreateOpen(false)}
        onAddVisit={addVisit}
        onAddTask={addTask}
        onAddCustomer={addCustomer}
      />
      <VisitDetailDrawer
        visit={selectedVisit}
        onClose={() => setSelectedVisit(null)}
        onCreateTask={() => {
          setSelectedVisit(null)
          openCreate('task')
        }}
      />
      {toast ? <div className="toast"><CheckCircle2 size={18} />{toast}</div> : null}
    </div>
  )
}

function NotificationPopover({ onClose }: { onClose: () => void }) {
  return (
    <div className="notification-popover">
      <header><strong>通知</strong><button type="button" onClick={onClose}>全部已读</button></header>
      <div>
        <button type="button"><span className="notice-icon notice-danger"><ListTodo size={16} /></span><p><strong>待办即将逾期</strong><small>“准备苏州智造产品演示环境”已到截止时间</small><time>10分钟前</time></p></button>
        <button type="button"><span className="notice-icon"><MapPinned size={16} /></span><p><strong>拜访即将开始</strong><small>14:00 苏州智造企业服务有限公司</small><time>30分钟前</time></p></button>
        <button type="button"><span className="notice-icon notice-success"><CheckCircle2 size={16} /></span><p><strong>记录已提交</strong><small>李明提交了优品贸易客户拜访记录</small><time>1小时前</time></p></button>
      </div>
      <footer><button type="button">查看全部通知</button></footer>
    </div>
  )
}
