import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react'
import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  ContactRound,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MapPinned,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings,
  X,
} from 'lucide-react'
import { apiRequest, getSession, login, logout, register, restoreSession, type PageResponse } from './api'
import {
  toContact,
  toCustomer,
  toTask,
  toVisit,
  type ApiBusinessItem,
  type ApiContact,
  type ApiOrganization,
} from './api-adapters'
import { LoginPage } from './auth-page'
import { customers as seedCustomers, initialTasks, initialVisits } from './data'
import { ContactsPage, MobileContactsPage } from './master-data-pages'
import {
  MobileCalendarPage,
  MobileCustomersPage,
  MobileDashboardPage,
  MobileReportsPage,
  MobileTasksPage,
  MobileVisitsPage,
} from './mobile-pages'
import { CreateRecordModal, VisitDetailDrawer, type CreateKind } from './overlays'
import {
  CalendarPage,
  CustomersPage,
  DashboardPage,
  ReportsPage,
  TasksPage,
  VisitsPage,
} from './pages'
import { MobileSettingsPage, SettingsPage } from './settings-pages'
import type { Contact, Customer, EntityId, PageKey, SessionUser, Task, Visit } from './types'
import { InitialAvatar } from './ui'
import { useMobileLayout } from './use-mobile-layout'

interface NavItem {
  id: PageKey
  label: string
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}

interface SearchResult {
  type: '拜访' | '甲方组织' | '联系人' | '待办'
  title: string
  subtitle: string
  page: PageKey
  visit?: Visit
}

const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'

const primaryNav: NavItem[] = [
  { id: 'dashboard', label: '工作台', icon: LayoutDashboard },
  { id: 'organizations', label: '甲方组织库', icon: Building2 },
  { id: 'contacts', label: '人脉库', icon: ContactRound },
  { id: 'visits', label: '拜访', icon: MapPinned },
  { id: 'tasks', label: '待办', icon: ListTodo },
  { id: 'calendar', label: '日历', icon: CalendarDays },
  { id: 'reports', label: '统计', icon: BarChart3 },
]

const mobileNav: NavItem[] = [
  { id: 'dashboard', label: '工作台', icon: LayoutDashboard },
  { id: 'organizations', label: '组织', icon: Building2 },
  { id: 'contacts', label: '人脉', icon: ContactRound },
  { id: 'visits', label: '拜访', icon: MapPinned },
  { id: 'tasks', label: '待办', icon: ListTodo },
]

const pageTitles: Record<PageKey, string> = {
  dashboard: '工作台',
  organizations: '甲方组织库',
  contacts: '人脉库',
  visits: '拜访',
  tasks: '待办',
  calendar: '日历',
  reports: '统计',
  settings: '设置',
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

function demoContacts(customers: Customer[]): Contact[] {
  return customers.map((customer, index) => ({
    id: `demo-contact-${index + 1}`,
    fullName: customer.contact,
    mobile: customer.phone,
    city: customer.region.split('·')[0]?.trim(),
    tags: customer.status === '重点跟进' ? ['重点组织', '主要联系人'] : ['主要联系人'],
    relationshipLevel: customer.status === '重点跟进' ? 'key' : 'normal',
    status: 'active',
    visibility: 'department',
    ownerName: customer.owner,
    primaryOrganizationId: String(customer.id),
    primaryOrganizationName: customer.name,
    affiliationCount: 1,
    itemCount: customer.openTasks,
  }))
}

function reopenedTaskStatus(task: Task): Task['status'] {
  const timeMatch = task.dueLabel.match(/(\d{1,2}):(\d{2})/)
  const deadlineTime = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : '23:59'
  const deadline = new Date(`${task.due}T${deadlineTime}:00`)
  return Number.isNaN(deadline.getTime()) || deadline.getTime() >= Date.now() ? '待处理' : '已逾期'
}

export default function App() {
  const [page, setPage] = useState<PageKey>('dashboard')
  const [visits, setVisits] = useState<Visit[]>(() => demoMode ? readStored('bam-visits-v2', initialVisits) : [])
  const [tasks, setTasks] = useState<Task[]>(() => demoMode ? readStored('bam-tasks', initialTasks) : [])
  const [organizationList, setOrganizationList] = useState<Customer[]>(() => demoMode ? readStored('bam-customers', seedCustomers) : [])
  const [contactList, setContactList] = useState<Contact[]>(() => demoMode ? readStored('bam-contacts-v0.2', demoContacts(seedCustomers)) : [])
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createKind, setCreateKind] = useState<CreateKind>('visit')
  const [searchQuery, setSearchQuery] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(() => demoMode ? demoUser : getSession()?.user || null)
  const [authReady, setAuthReady] = useState(demoMode)
  const [dataLoading, setDataLoading] = useState(!demoMode)
  const [dataError, setDataError] = useState('')
  const isMobileLayout = useMobileLayout()

  const loadRemoteData = useCallback(async (showLoading = true) => {
    if (demoMode) return
    if (showLoading) setDataLoading(true)
    setDataError('')
    try {
      const [organizationResponse, contactResponse, itemResponse] = await Promise.all([
        apiRequest<PageResponse<ApiOrganization>>('/organizations?pageSize=100'),
        apiRequest<PageResponse<ApiContact>>('/contacts?pageSize=100'),
        apiRequest<PageResponse<ApiBusinessItem>>('/business-items?pageSize=100'),
      ])
      const items = itemResponse.items
      setOrganizationList(organizationResponse.items.map((organization) => toCustomer(organization, items)))
      setContactList(contactResponse.items.map(toContact))
      setVisits(items.filter((item) => item.itemType === 'visit').map(toVisit))
      setTasks(items.filter((item) => item.itemType === 'task').map(toTask))
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '数据加载失败'
      setDataError(message)
      throw reason
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (demoMode) return
    const updateSession = (event: Event) => setSessionUser((event as CustomEvent).detail?.user || null)
    window.addEventListener('bam-auth-change', updateSession)
    void restoreSession().then((restored) => setSessionUser(restored?.user || null)).finally(() => setAuthReady(true))
    return () => window.removeEventListener('bam-auth-change', updateSession)
  }, [])

  useEffect(() => {
    if (!demoMode && authReady && sessionUser) void loadRemoteData().catch(() => undefined)
  }, [authReady, loadRemoteData, sessionUser])

  useEffect(() => {
    if (demoMode) localStorage.setItem('bam-visits-v2', JSON.stringify(visits))
  }, [visits])
  useEffect(() => {
    if (demoMode) localStorage.setItem('bam-tasks', JSON.stringify(tasks))
  }, [tasks])
  useEffect(() => {
    if (demoMode) localStorage.setItem('bam-customers', JSON.stringify(organizationList))
  }, [organizationList])
  useEffect(() => {
    if (demoMode) localStorage.setItem('bam-contacts-v0.2', JSON.stringify(contactList))
  }, [contactList])
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
      .slice(0, 2)
      .map((visit) => ({ type: '拜访' as const, title: visit.customer, subtitle: `${visit.date} ${visit.time} · ${visit.contact}`, page: 'visits' as PageKey, visit }))
    const organizationResults = organizationList
      .filter((organization) => `${organization.name}${organization.contact}${organization.region}`.toLowerCase().includes(normalized))
      .slice(0, 2)
      .map((organization) => ({ type: '甲方组织' as const, title: organization.name, subtitle: `${organization.contact} · ${organization.region}`, page: 'organizations' as PageKey }))
    const contactResults = contactList
      .filter((contact) => `${contact.fullName}${contact.mobile}${contact.primaryOrganizationName || ''}`.toLowerCase().includes(normalized))
      .slice(0, 2)
      .map((contact) => ({ type: '联系人' as const, title: contact.fullName, subtitle: `${contact.primaryOrganizationName || '独立人脉'} · ${contact.mobile}`, page: 'contacts' as PageKey }))
    const taskResults = tasks
      .filter((task) => `${task.title}${task.customer}${task.assignee}`.toLowerCase().includes(normalized))
      .slice(0, 2)
      .map((task) => ({ type: '待办' as const, title: task.title, subtitle: `${task.assignee} · ${task.dueLabel}`, page: 'tasks' as PageKey }))
    return [...visitResults, ...organizationResults, ...contactResults, ...taskResults].slice(0, 8)
  }, [contactList, organizationList, searchQuery, tasks, visits])

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

  async function addVisit(visit: Visit) {
    if (demoMode) {
      setVisits((current) => [visit, ...current])
    } else {
      const startsAt = new Date(`${visit.date}T${visit.time || '00:00'}:00`).toISOString()
      const endsAt = visit.endTime ? new Date(`${visit.date}T${visit.endTime}:00`).toISOString() : undefined
      const created = await apiRequest<ApiBusinessItem>('/business-items', {
        method: 'POST',
        body: JSON.stringify({
          itemType: 'visit',
          title: visit.matter.slice(0, 80),
          content: visit.matter,
          result: visit.result,
          location: visit.location,
          startsAt,
          endsAt,
          status: 'planned',
          participantNames: visit.participants,
          organizationIds: visit.organizationIds || [],
          contactIds: visit.contactIds || [],
          details: { createdFrom: isMobileLayout ? 'mobile' : 'web' },
        }),
      })
      setVisits((current) => [toVisit(created), ...current])
    }
    setCreateOpen(false)
    setPage('visits')
    setToast('拜访记录已保存')
  }

  async function addTask(task: Task) {
    if (demoMode) {
      setTasks((current) => [task, ...current])
    } else {
      const time = task.dueLabel.match(/\d{1,2}:\d{2}/)?.[0] || '23:59'
      const created = await apiRequest<ApiBusinessItem>('/business-items', {
        method: 'POST',
        body: JSON.stringify({
          itemType: 'task',
          title: task.title,
          dueAt: new Date(`${task.due}T${time}:00`).toISOString(),
          status: 'pending',
          priority: ({ 高: 'high', 中: 'medium', 低: 'low' } as const)[task.priority],
          isInternal: task.isInternal || false,
          organizationIds: task.organizationIds || [],
          contactIds: task.contactIds || [],
          details: { createdFrom: isMobileLayout ? 'mobile' : 'web' },
        }),
      })
      setTasks((current) => [toTask(created), ...current])
    }
    setCreateOpen(false)
    setPage('tasks')
    setToast('待办事项已创建')
  }

  async function addOrganization(organization: Customer) {
    if (demoMode) {
      setOrganizationList((current) => [organization, ...current])
    } else {
      const created = await apiRequest<ApiOrganization>('/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: organization.name,
          shortName: organization.shortName,
          industry: organization.industry,
          region: organization.region,
          status: organization.status === '重点跟进' ? 'key' : 'normal',
          source: '界面新增',
        }),
      })
      setOrganizationList((current) => [toCustomer({ ...created, contactCount: created.contactCount || 0, itemCount: created.itemCount || 0 }, []), ...current])
    }
    setCreateOpen(false)
    setPage('organizations')
    setToast('甲方组织已添加')
  }

  async function addContact(contact: Contact) {
    if (demoMode) {
      setContactList((current) => [contact, ...current])
    } else {
      const affiliations = contact.primaryOrganizationId ? [{
        organizationId: contact.primaryOrganizationId,
        title: contact.primaryTitle,
        relationshipRole: '关键联系人',
        isPrimary: true,
        status: 'current',
        confidence: 80,
      }] : []
      const created = await apiRequest<ApiContact>('/contacts', {
        method: 'POST',
        body: JSON.stringify({
          fullName: contact.fullName,
          mobile: contact.mobile === '待补充' ? undefined : contact.mobile,
          phone: contact.phone,
          email: contact.email,
          wechat: contact.wechat,
          city: contact.city,
          tags: contact.tags,
          relationshipLevel: contact.relationshipLevel,
          status: contact.status,
          visibility: contact.visibility,
          source: '界面新增',
          affiliations,
        }),
      })
      setContactList((current) => [toContact({ ...created, affiliationCount: created.affiliationCount || affiliations.length, itemCount: created.itemCount || 0 }), ...current])
    }
    setCreateOpen(false)
    setPage('contacts')
    setToast('人脉档案已添加')
  }

  async function toggleTask(taskId: EntityId) {
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return
    const nextStatus = task.status === '已完成' ? reopenedTaskStatus(task) : '已完成'
    if (demoMode) {
      setTasks((current) => current.map((item) => item.id === taskId ? { ...item, status: nextStatus } : item))
    } else {
      const apiStatus = nextStatus === '已完成' ? 'completed' : nextStatus === '已逾期' ? 'overdue' : 'pending'
      const updated = await apiRequest<ApiBusinessItem>(`/business-items/${taskId}`, { method: 'PATCH', body: JSON.stringify({ status: apiStatus }) })
      setTasks((current) => current.map((item) => item.id === taskId ? toTask(updated) : item))
    }
    setToast('待办状态已更新')
  }

  async function handleLogin(username: string, password: string) {
    const loggedIn = await login(username, password)
    setSessionUser(loggedIn.user)
  }

  async function handleRegister(username: string, displayName: string, password: string) {
    const registered = await register(username, displayName, password)
    setSessionUser(registered.user)
    setToast('账号注册成功')
  }

  async function handleLogout() {
    if (demoMode) {
      setToast('演示模式不退出登录')
      return
    }
    await logout()
    setSessionUser(null)
  }

  function renderPage() {
    if (isMobileLayout) {
      switch (page) {
        case 'organizations':
          return <MobileCustomersPage customers={organizationList} onCreate={() => openCreate('organization')} onCreateVisit={() => openCreate('visit')} />
        case 'contacts':
          return <MobileContactsPage contacts={contactList} onCreate={() => openCreate('contact')} onCreateVisit={() => openCreate('visit')} />
        case 'visits':
          return <MobileVisitsPage visits={visits} onCreate={() => openCreate('visit')} onOpenCalendar={() => navigate('calendar')} onSelectVisit={setSelectedVisit} />
        case 'tasks':
          return <MobileTasksPage tasks={tasks} onToggleTask={(id) => void toggleTask(id)} onCreate={() => openCreate('task')} />
        case 'calendar':
          return <MobileCalendarPage visits={visits} tasks={tasks} onCreate={() => openCreate('visit')} onSelectVisit={setSelectedVisit} />
        case 'reports':
          return <MobileReportsPage />
        case 'settings':
          return <MobileSettingsPage user={sessionUser!} demoMode={demoMode} onLogout={() => void handleLogout()} onNotify={setToast} />
        default:
          return <MobileDashboardPage visits={visits} tasks={tasks} onCreate={openCreate} onNavigate={navigate} onSelectVisit={setSelectedVisit} onToggleTask={(id) => void toggleTask(id)} />
      }
    }

    switch (page) {
      case 'organizations':
        return <CustomersPage customers={organizationList} onCreate={() => openCreate('organization')} />
      case 'contacts':
        return <ContactsPage contacts={contactList} onCreate={() => openCreate('contact')} />
      case 'visits':
        return <VisitsPage visits={visits} onCreate={() => openCreate('visit')} onSelectVisit={setSelectedVisit} />
      case 'tasks':
        return <TasksPage tasks={tasks} onToggleTask={(id) => void toggleTask(id)} onCreate={() => openCreate('task')} />
      case 'calendar':
        return <CalendarPage visits={visits} onSelectVisit={setSelectedVisit} />
      case 'reports':
        return <ReportsPage />
      case 'settings':
        return <SettingsPage user={sessionUser!} demoMode={demoMode} onLogout={() => void handleLogout()} onNotify={setToast} />
      default:
        return <DashboardPage visits={visits} tasks={tasks} displayName={sessionUser?.displayName || '同事'} onCreate={openCreate} onSelectVisit={setSelectedVisit} onToggleTask={(id) => void toggleTask(id)} />
    }
  }

  if (!authReady) return <LoadingScreen label="正在检查登录状态…" />
  if (!sessionUser) return <LoginPage onLogin={handleLogin} onRegister={handleRegister} />
  if (dataLoading && !organizationList.length && !visits.length) return <LoadingScreen label="正在同步部门数据…" />
  if (dataError && !organizationList.length && !visits.length) {
    return <ServiceError message={dataError} onRetry={() => void loadRemoteData()} onLogout={() => void handleLogout()} />
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand-block"><span className="brand-mark"><ClipboardList size={22} /></span><span className="brand-copy"><strong>商务活动管理</strong><small>部门业务协作平台 · v0.2.0</small></span></div>
        <nav className="sidebar-nav">
          <span className="nav-group-label">业务与主数据</span>
          {primaryNav.map((item) => (
            <button className={page === item.id ? 'is-active' : ''} type="button" key={item.id} onClick={() => navigate(item.id)}>
              <item.icon size={19} strokeWidth={1.9} /><span>{item.label}</span>
              {item.id === 'tasks' && tasks.filter((task) => task.status !== '已完成').length ? <b>{tasks.filter((task) => task.status !== '已完成').length}</b> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className={page === 'settings' ? 'sidebar-settings is-active' : 'sidebar-settings'} type="button" onClick={() => navigate('settings')}><Settings size={19} /><span>设置</span></button>
          <button className="user-panel" type="button" onClick={() => void handleLogout()} title="退出登录"><InitialAvatar text={sessionUser.displayName} size="small" /><span><strong>{sessionUser.displayName}</strong><small>{roleLabel(sessionUser.role)} · 点击退出</small></span><LogOut size={15} /></button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="mobile-brand"><button className="icon-button menu-button" type="button" onClick={() => setMobileMenuOpen(true)} aria-label="打开菜单"><Menu size={21} /></button><span className="brand-mark"><ClipboardList size={19} /></span><span><strong>部门小管家</strong><small>{pageTitles[page]}</small></span></div>
          <label className="global-search"><Search size={18} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} type="search" placeholder="搜索组织、人脉、拜访或待办" /><kbd>Ctrl K</kbd></label>
          <div className="topbar-actions">
            <button className="date-button" type="button"><CalendarDays size={17} /><span>{new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(new Date())}</span><ChevronDown size={14} /></button>
            <div className="notification-wrap"><button className="icon-button notification-button" type="button" onClick={() => setNotificationsOpen((value) => !value)} aria-label="通知"><Bell size={19} />{tasks.some((task) => task.status === '已逾期') ? <b>{tasks.filter((task) => task.status === '已逾期').length}</b> : null}</button>{notificationsOpen ? <NotificationPopover onClose={() => setNotificationsOpen(false)} /> : null}</div>
            <button className="topbar-user" type="button" onClick={() => navigate('settings')}><InitialAvatar text={sessionUser.displayName} size="small" /><span>{sessionUser.displayName}</span><ChevronDown size={14} /></button>
          </div>
          {searchQuery ? (
            <div className="search-popover">
              <header><span>搜索结果</span><button type="button" onClick={() => setSearchQuery('')}><X size={15} /></button></header>
              {searchResults.length ? searchResults.map((result, index) => (
                <button type="button" key={`${result.type}-${result.title}-${index}`} onClick={() => { navigate(result.page); if (result.visit) setSelectedVisit(result.visit) }}>
                  <span>{result.type}</span><p><strong>{result.title}</strong><small>{result.subtitle}</small></p>
                </button>
              )) : <p className="no-result">没有找到相关记录</p>}
            </div>
          ) : null}
        </header>
        {dataError ? <div className="sync-warning"><span>数据同步失败：{dataError}</span><button type="button" onClick={() => void loadRemoteData(false)}><RefreshCw size={14} />重试</button></div> : null}
        <main className="main-content">{renderPage()}</main>
      </section>

      <nav className="mobile-bottom-nav" aria-label="移动端导航">
        {mobileNav.map((item) => (
          <button className={page === item.id || (page === 'calendar' && item.id === 'visits') || (page === 'reports' && item.id === 'dashboard') ? 'is-active' : ''} type="button" key={item.id} onClick={() => navigate(item.id)}>
            <item.icon size={20} strokeWidth={1.9} /><span>{item.label}</span>
            {item.id === 'tasks' && tasks.filter((task) => task.status === '已逾期').length ? <b>{tasks.filter((task) => task.status === '已逾期').length}</b> : null}
          </button>
        ))}
      </nav>
      <button className="mobile-fab" type="button" onClick={() => openCreate('visit')} aria-label="新建记录"><Plus size={25} /></button>

      {mobileMenuOpen ? (
        <div className="mobile-menu-backdrop" role="presentation" onMouseDown={() => setMobileMenuOpen(false)}>
          <aside className="mobile-menu" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span className="brand-mark"><ClipboardList size={20} /></span><strong>部门小管家</strong></div><button className="icon-button" type="button" onClick={() => setMobileMenuOpen(false)}><X size={20} /></button></header>
            <nav>{primaryNav.map((item) => <button className={page === item.id ? 'is-active' : ''} type="button" key={item.id} onClick={() => navigate(item.id)}><item.icon size={19} />{item.label}</button>)}<button type="button" onClick={() => navigate('settings')}><Settings size={19} />我的设置</button><button type="button" onClick={() => void handleLogout()}><LogOut size={19} />退出登录</button></nav>
          </aside>
        </div>
      ) : null}

      <CreateRecordModal
        open={createOpen}
        initialKind={createKind}
        onClose={() => setCreateOpen(false)}
        onAddVisit={addVisit}
        onAddTask={addTask}
        onAddOrganization={addOrganization}
        onAddContact={addContact}
        organizations={organizationList}
        contacts={contactList}
      />
      <VisitDetailDrawer visit={selectedVisit} onClose={() => setSelectedVisit(null)} onCreateTask={() => { setSelectedVisit(null); openCreate('task') }} />
      {toast ? <div className="toast"><CheckCircle2 size={18} />{toast}</div> : null}
    </div>
  )
}

const demoUser: SessionUser = { userId: 'demo', departmentId: 'demo', username: 'demo', displayName: '张伟', role: 'manager' }

function roleLabel(role: SessionUser['role']) {
  return ({ admin: '系统管理员', manager: '部门经理', member: '部门成员', readonly: '只读用户' } as const)[role]
}

function LoadingScreen({ label }: { label: string }) {
  return <main className="system-state-screen"><span className="system-state-logo"><ClipboardList size={28} /></span><strong>{label}</strong><small>商务活动管理 v0.2.0</small></main>
}

function ServiceError({ message, onRetry, onLogout }: { message: string; onRetry: () => void; onLogout: () => void }) {
  return <main className="system-state-screen error-state"><span className="system-state-logo"><RefreshCw size={28} /></span><strong>业务服务暂时不可用</strong><p>{message}</p><div><button className="button button-primary" type="button" onClick={onRetry}>重新连接</button><button className="button button-secondary" type="button" onClick={onLogout}>退出登录</button></div></main>
}

function NotificationPopover({ onClose }: { onClose: () => void }) {
  return (
    <div className="notification-popover">
      <header><strong>通知</strong><button type="button" onClick={onClose}>全部已读</button></header>
      <div>
        <button type="button"><span className="notice-icon notice-danger"><ListTodo size={16} /></span><p><strong>待办提醒</strong><small>请优先处理已逾期事项</small><time>刚刚</time></p></button>
        <button type="button"><span className="notice-icon"><MapPinned size={16} /></span><p><strong>主数据关联提示</strong><small>新建事项需要关联组织或人脉</small><time>系统</time></p></button>
        <button type="button"><span className="notice-icon notice-success"><CheckCircle2 size={16} /></span><p><strong>双库同步正常</strong><small>组织库与人脉库保持独立关联</small><time>系统</time></p></button>
      </div>
      <footer><button type="button">查看全部通知</button></footer>
    </div>
  )
}
