import { BusinessClock, BusinessSession, OpenSourceVisit, useLiveClock } from './business-clock'
import { useNotifications } from './notifications'
import { MobileMenuLayer } from './mobile-menu-layer'
import { TaskPreview } from './task-preview'
import { currentTask, isOpen, itemRegion } from './business-metrics'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
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
import { apiRequest, fetchAllPages, getSession, login, logout, register, restoreSession } from './api'
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
import { WriteAccess, WriteButton } from './write-access'

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
  { id: 'organizations', label: '组织', icon: Building2 },
  { id: 'contacts', label: '人脉', icon: ContactRound },
  { id: 'visits', label: '拜访', icon: MapPinned },
  { id: 'tasks', label: '待办', icon: ListTodo },
  { id: 'calendar', label: '日历', icon: CalendarDays },
  { id: 'reports', label: '统计', icon: BarChart3 },
]

const mobileNav: NavItem[] = [
  { id: 'dashboard', label: '工作台', icon: LayoutDashboard },
  { id: 'visits', label: '拜访', icon: MapPinned },
  { id: 'tasks', label: '待办', icon: ListTodo },
  { id: 'calendar', label: '日历', icon: CalendarDays },
  { id: 'reports', label: '统计', icon: BarChart3 },
]

const pageTitles: Record<PageKey, string> = {
  dashboard: '工作台',
  organizations: '组织',
  contacts: '人脉',
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
  const [storedVisits, setVisits] = useState<Visit[]>(() => demoMode ? readStored('bam-visits-v2', initialVisits) : [])
  const [storedTasks, setTasks] = useState<Task[]>(() => demoMode ? readStored('bam-tasks', initialTasks) : [])
  const [organizationList, setOrganizationList] = useState<Customer[]>(() => demoMode ? readStored('bam-customers', seedCustomers) : [])
  const [contactList, setContactList] = useState<Contact[]>(() => demoMode ? readStored('bam-contacts-v0.2', demoContacts(seedCustomers)) : [])
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null)
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null)
  const [sourceVisit, setSourceVisit] = useState<Visit | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createKind, setCreateKind] = useState<CreateKind>('visit')
  const [searchQuery, setSearchQuery] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationTask, setNotificationTask] = useState<Task | null>(null)
  const notificationRef = useRef<HTMLDivElement>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(() => demoMode ? demoUser : getSession()?.user || null)
  const [authReady, setAuthReady] = useState(demoMode)
  const [dataLoading, setDataLoading] = useState(!demoMode)
  const [dataError, setDataError] = useState('')
  const isMobileLayout = useMobileLayout()
  const now = useLiveClock()
  const visits = useMemo(() => storedVisits.map(visit => ({ ...visit, region: itemRegion(visit, organizationList) })), [storedVisits, organizationList])
  const tasks = useMemo(() => storedTasks.map(task => currentTask(task, now)), [storedTasks, now])
  const notices = useNotifications(sessionUser, demoMode, storedTasks)
  useEffect(() => {
    const back = (event: Event) => {
      if (notificationsOpen || mobileMenuOpen || page !== 'dashboard') {
        event.preventDefault()
        if (notificationsOpen) setNotificationsOpen(false)
        else if (mobileMenuOpen) setMobileMenuOpen(false)
        else setPage('dashboard')
      }
    }
    window.addEventListener('bam-native-back', back)
    return () => window.removeEventListener('bam-native-back', back)
  }, [notificationsOpen, mobileMenuOpen, page])
  const canWrite = sessionUser !== null && sessionUser.role !== 'readonly'
  const pendingTasks = useRef(new Set<EntityId>())
  const [writeBusy, setWriteBusy] = useState(false)
  const sessionIdentity = useRef(sessionUser ? `${sessionUser.userId}:${sessionUser.departmentId}:${sessionUser.role}` : '')
  const loadGeneration = useRef(0)

  useEffect(() => {
    if (demoMode || !selectedVisit) return
    let active = true
    const id = selectedVisit.id
    const identity = sessionIdentity.current
    void apiRequest<ApiBusinessItem>(`/business-items/${id}`).then(item => {
      if (active && identity === sessionIdentity.current) setSelectedVisit(current => current?.id === id ? toVisit(item) : current)
    }).catch(reason => { if (active) setToast(`详情加载失败：${reason instanceof Error ? reason.message : '请重试'}`) })
    return () => { active = false }
  }, [selectedVisit?.id])

  function assertCanWrite() {
    if (!canWrite) throw new Error('当前账号为只读账号，不能修改业务数据')
    const current = demoMode ? sessionUser : getSession()?.user
    if (!current || current.userId !== sessionUser?.userId || current.departmentId !== sessionUser?.departmentId || current.role !== sessionUser?.role) {
      throw new Error('登录身份已变化，请重新打开表单')
    }
  }

  const loadRemoteData = useCallback(async (showLoading = true) => {
    if (demoMode) return
    const requestingUser = getSession()?.user.userId
    const generation = ++loadGeneration.current
    if (showLoading) setDataLoading(true)
    setDataError('')
    try {
      const [organizationResponse, contactResponse, itemResponse] = await Promise.all([
        fetchAllPages<ApiOrganization>('/organizations'),
        fetchAllPages<ApiContact>('/contacts'),
        fetchAllPages<ApiBusinessItem>('/business-items'),
      ])
      const items = itemResponse.items
      if (getSession()?.user.userId !== requestingUser || loadGeneration.current !== generation) return
      setOrganizationList(organizationResponse.items.map((organization) => toCustomer(organization, items)))
      setContactList(contactResponse.items.map(toContact))
      setVisits(items.filter((item) => item.itemType === 'visit').map(toVisit))
      setTasks(items.filter((item) => item.itemType === 'task').map(toTask))
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '数据加载失败'
      if (loadGeneration.current === generation) setDataError(message)
    } finally {
      if (loadGeneration.current === generation) setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (demoMode) return
    const updateSession = (event: Event) => {
      const next = (event as CustomEvent).detail?.user || null
      const identity = next ? `${next.userId}:${next.departmentId}:${next.role}` : ''
      if (sessionIdentity.current !== identity) {
        sessionIdentity.current = identity
        loadGeneration.current++
        setOrganizationList([]); setContactList([]); setVisits([]); setTasks([])
        setSelectedVisit(null); setEditingVisit(null); setSourceVisit(null); setCreateOpen(false); setSearchQuery(''); setDataError('')
        setDataLoading(Boolean(next))
      }
      setSessionUser(next)
    }
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

  useEffect(() => {
    if (!notificationsOpen) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) setNotificationsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [notificationsOpen])

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
    if (!canWrite) return
    setEditingVisit(null); setSourceVisit(null)
    setCreateKind(kind)
    setCreateOpen(true)
  }

  async function addVisit(visit: Visit) {
    assertCanWrite()
    if (editingVisit) {
      let updated = visit
      if (!demoMode) {
        updated = toVisit(await apiRequest<ApiBusinessItem>(`/business-items/${visit.id}`, { method: 'PATCH', body: JSON.stringify({
          expectedRevision: editingVisit.revision, title: visit.matter.slice(0, 80), content: visit.matter,
          status: ({ '待开始': 'planned', '进行中': 'in_progress', '已完成': 'completed', '已延期': 'postponed', '已取消': 'cancelled' } as const)[visit.status],
          result: visit.result, location: visit.location, startsAt: new Date(`${visit.date}T${visit.time}:00`).toISOString(),
          endsAt: visit.endTime ? new Date(`${visit.date}T${visit.endTime}:00`).toISOString() : null,
          participantNames: visit.participants, organizationIds: visit.organizationIds || [], contactIds: visit.contactIds || [],
        }) }))
      }
      assertCanWrite()
      setVisits(current => current.map(item => item.id === visit.id ? updated : item))
      setSelectedVisit(updated); setEditingVisit(null); setCreateOpen(false); setToast('拜访修改已保存')
      return
    }
    visit = { ...visit, ownerUserId: sessionUser?.userId, createdAt: now.toISOString(), owner: sessionUser?.displayName || visit.owner }
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
      assertCanWrite()
      setVisits((current) => [toVisit(created), ...current])
    }
    setCreateOpen(false)
    setPage('visits')
    setToast('拜访记录已保存')
  }

  async function addTask(task: Task) {
    assertCanWrite()
    task = { ...task, ownerUserId: sessionUser?.userId, createdAt: now.toISOString(), assignee: sessionUser?.displayName || task.assignee }
    if (demoMode) {
      setTasks((current) => [task, ...current])
    } else {
      const time = task.dueLabel.match(/\d{1,2}:\d{2}/)?.[0] || '23:59'
      const created = await apiRequest<ApiBusinessItem>('/business-items', {
        method: 'POST',
        body: JSON.stringify({
          itemType: 'task',
          sourceItemId: task.sourceItemId,
          title: task.title,
          content: task.content || '',
          dueAt: new Date(`${task.due}T${time}:00`).toISOString(),
          status: 'pending',
          priority: ({ 高: 'high', 中: 'medium', 低: 'low' } as const)[task.priority],
          isInternal: task.isInternal || false,
          organizationIds: task.organizationIds || [],
          contactIds: task.contactIds || [],
          details: { createdFrom: isMobileLayout ? 'mobile' : 'web' },
        }),
      })
      assertCanWrite()
      setTasks((current) => [toTask(created), ...current])
    }
    setCreateOpen(false)
    setPage('tasks')
    setToast('待办事项已创建')
  }

  async function addOrganization(organization: Customer) {
    assertCanWrite()
    if (demoMode) {
      setOrganizationList((current) => [organization, ...current])
    } else {
      const created = await apiRequest<ApiOrganization>('/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: organization.name,
          shortName: organization.shortName,
          parentOrganizationId: organization.parentOrganizationId || null,
          organizationType: organization.organizationType || 'company',
          industry: organization.industry,
          region: organization.region,
          status: organization.status === '重点跟进' ? 'key' : 'normal',
          source: '界面新增',
        }),
      })
      assertCanWrite()
      setOrganizationList((current) => [toCustomer({ ...created, contactCount: created.contactCount || 0, itemCount: created.itemCount || 0 }, []), ...current])
    }
    setCreateOpen(false)
    setPage('organizations')
    setToast('甲方组织已添加')
  }

  async function updateHierarchy(id: string, parentId: string | null) {
    assertCanWrite()
    if (!demoMode) await apiRequest(`/organizations/${id}`, { method: 'PATCH', body: JSON.stringify({ parentOrganizationId: parentId }) })
    assertCanWrite()
    setOrganizationList((current) => current.map((org) => String(org.id) === id ? { ...org, parentOrganizationId: parentId, parentOrganizationName: current.find((parent) => String(parent.id) === parentId)?.name || null } : org))
    setToast('组织层级已更新')
  }

  async function addContact(contact: Contact) {
    assertCanWrite()
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
      assertCanWrite()
      setContactList((current) => [toContact({ ...created, affiliationCount: created.affiliationCount || affiliations.length, itemCount: created.itemCount || 0 }), ...current])
    }
    setCreateOpen(false)
    setPage('contacts')
    setToast('人脉档案已添加')
  }

  async function toggleTask(taskId: EntityId) {
    if (!canWrite || pendingTasks.current.has(taskId)) return
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return
    pendingTasks.current.add(taskId)
    setWriteBusy(true)
    try {
    const nextStatus = task.status === '已完成' ? reopenedTaskStatus(task) : '已完成'
    if (demoMode) {
      setTasks((current) => current.map((item) => item.id === taskId ? { ...item, status: nextStatus, completedAt: nextStatus === '已完成' ? now.toISOString() : undefined } : item))
    } else {
      const apiStatus = nextStatus === '已完成' ? 'completed' : nextStatus === '已逾期' ? 'overdue' : 'pending'
      const updated = await apiRequest<ApiBusinessItem>(`/business-items/${taskId}`, { method: 'PATCH', body: JSON.stringify({ status: apiStatus }) })
      assertCanWrite()
      setTasks((current) => current.map((item) => item.id === taskId ? toTask(updated) : item))
    }
    setToast('待办状态已更新')
    } catch (reason) {
      setToast(`操作失败，界面保留原状态：${reason instanceof Error ? reason.message : '请稍后重试'}`)
    } finally {
      pendingTasks.current.delete(taskId)
      setWriteBusy(pendingTasks.current.size > 0)
    }
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
    try {
      await logout()
    } catch {
      setToast('本机已退出；服务器会话注销未确认')
    } finally {
      setSessionUser(null)
    }
  }

  function renderPage() {
    if (isMobileLayout) {
      switch (page) {
        case 'organizations':
          return <MobileCustomersPage customers={organizationList} onCreate={() => openCreate('organization')} onCreateVisit={() => openCreate('visit')} onUpdateHierarchy={sessionUser?.role === 'readonly' ? undefined : updateHierarchy} />
        case 'contacts':
          return <MobileContactsPage contacts={contactList} onCreate={() => openCreate('contact')} onCreateVisit={() => openCreate('visit')} />
        case 'visits':
          return <MobileVisitsPage visits={visits} onCreate={() => openCreate('visit')} onOpenCalendar={() => navigate('calendar')} onSelectVisit={setSelectedVisit} />
        case 'tasks':
          return <MobileTasksPage tasks={tasks} onToggleTask={(id) => void toggleTask(id)} onCreate={() => openCreate('task')} />
        case 'calendar':
          return <MobileCalendarPage visits={visits} tasks={tasks} onCreate={() => openCreate('visit')} onSelectVisit={setSelectedVisit} />
        case 'reports':
          return <MobileReportsPage visits={visits} tasks={tasks} customers={organizationList} onNotify={setToast} />
        case 'settings':
          return <MobileSettingsPage user={sessionUser!} demoMode={demoMode} onLogout={() => void handleLogout()} onNotify={setToast} />
        default:
          return <MobileDashboardPage visits={visits} tasks={tasks} onCreate={openCreate} onNavigate={navigate} onSelectVisit={setSelectedVisit} onToggleTask={(id) => void toggleTask(id)} />
      }
    }

    switch (page) {
      case 'organizations':
        return <CustomersPage customers={organizationList} onCreate={() => openCreate('organization')} onNotify={setToast} onUpdateHierarchy={sessionUser?.role === 'readonly' ? undefined : updateHierarchy} />
      case 'contacts':
        return <ContactsPage contacts={contactList} onCreate={() => openCreate('contact')} />
      case 'visits':
        return <VisitsPage visits={visits} onCreate={() => openCreate('visit')} onSelectVisit={setSelectedVisit} onNotify={setToast} />
      case 'tasks':
        return <TasksPage tasks={tasks} onToggleTask={(id) => void toggleTask(id)} onCreate={() => openCreate('task')} onNotify={setToast} />
      case 'calendar':
        return <CalendarPage visits={visits} tasks={tasks} onSelectVisit={setSelectedVisit} onCreate={() => openCreate('visit')} />
      case 'reports':
        return <ReportsPage visits={visits} tasks={tasks} customers={organizationList} onNotify={setToast} />
      case 'settings':
        return <SettingsPage user={sessionUser!} demoMode={demoMode} onLogout={() => void handleLogout()} onNotify={setToast} />
      default:
        return <DashboardPage visits={visits} tasks={tasks} customers={organizationList} displayName={sessionUser?.displayName || '同事'} onCreate={openCreate} onSelectVisit={setSelectedVisit} onToggleTask={(id) => void toggleTask(id)} onNavigate={navigate} onNotify={setToast} />
    }
  }

  if (!authReady) return <LoadingScreen label="正在检查登录状态…" />
  if (!sessionUser) return <LoginPage onLogin={handleLogin} onRegister={handleRegister} />
  if (dataLoading && !organizationList.length && !visits.length) return <LoadingScreen label="正在同步部门数据…" />
  if (dataError && !organizationList.length && !visits.length) {
    return <ServiceError message={dataError} onRetry={() => void loadRemoteData()} onLogout={() => void handleLogout()} />
  }

  return (
    <BusinessClock.Provider value={now}><BusinessSession.Provider value={sessionUser}><OpenSourceVisit.Provider value={id => {
      const source = visits.find(visit => String(visit.id) === id)
      if (source) setSelectedVisit(source)
      else setToast('来源拜访已删除或当前账号不可访问')
    }}><WriteAccess.Provider value={{ canWrite, busy: writeBusy }}><div className="app-shell">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand-block"><span className="brand-mark"><ClipboardList size={22} /></span><span className="brand-copy"><strong>商务活动管理</strong><small>部门业务协作平台 · v0.2.0</small></span></div>
        <nav className="sidebar-nav">
          <span className="nav-group-label">业务与主数据</span>
          {primaryNav.map((item) => (
            <button className={page === item.id ? 'is-active' : ''} type="button" key={item.id} onClick={() => navigate(item.id)}>
              <item.icon size={19} strokeWidth={1.9} /><span>{item.label}</span>
              {item.id === 'tasks' && tasks.filter(isOpen).length ? <b>{tasks.filter(isOpen).length}</b> : null}
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
            <button className="date-button" type="button" onClick={() => navigate('calendar')}><CalendarDays size={17} /><span>{new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(new Date())}</span><ChevronDown size={14} /></button>
            <div className="notification-wrap" ref={notificationRef}><button className="icon-button notification-button" type="button" onClick={() => { setNotificationsOpen((value) => !value); void notices.refresh() }} aria-label="通知" aria-expanded={notificationsOpen}><Bell size={19} />{notices.unread ? <b>{notices.unread}</b> : null}</button>{notificationsOpen ? <NotificationPopover notices={notices} onClose={() => setNotificationsOpen(false)} onOpen={async id => {
              const identity = sessionIdentity.current
              try { const item = await apiRequest<ApiBusinessItem>(`/business-items/${id}`); if (identity !== sessionIdentity.current) return; setNotificationTask(toTask(item)); setNotificationsOpen(false) }
              catch (reason) { setToast(`通知对应记录无法打开：${reason instanceof Error ? reason.message : '请重试'}`) }
            }} /> : null}</div>
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
          <button className={page === item.id ? 'is-active' : ''} type="button" key={item.id} onClick={() => navigate(item.id)}>
            <item.icon size={20} strokeWidth={1.9} /><span>{item.label}</span>
            {item.id === 'tasks' && tasks.filter((task) => task.status === '已逾期').length ? <b>{tasks.filter((task) => task.status === '已逾期').length}</b> : null}
          </button>
        ))}
      </nav>
      <WriteButton className="mobile-fab" type="button" onClick={() => openCreate('visit')} aria-label="新建记录"><Plus size={25} /></WriteButton>

        <MobileMenuLayer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
          <aside role="dialog" aria-modal="true" aria-label="导航菜单" className="mobile-menu" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span className="brand-mark"><ClipboardList size={20} /></span><strong>部门小管家</strong></div><button className="icon-button" type="button" aria-label="关闭菜单" onClick={() => setMobileMenuOpen(false)}><X size={20} /></button></header>
            <nav>{primaryNav.map((item) => <button className={page === item.id ? 'is-active' : ''} type="button" key={item.id} onClick={() => navigate(item.id)}><item.icon size={19} />{item.label}</button>)}<button type="button" onClick={() => navigate('settings')}><Settings size={19} />我的设置</button><button type="button" onClick={() => void handleLogout()}><LogOut size={19} />退出登录</button></nav>
          </aside>
        </MobileMenuLayer>

      <TaskPreview task={notificationTask} onClose={() => setNotificationTask(null)} />
      <CreateRecordModal
        key={`${sessionUser.userId}:${editingVisit?.id || 'new'}:${sourceVisit?.id || ''}`}
        editingVisit={editingVisit}
        sourceVisit={sourceVisit}
        open={createOpen && canWrite}
        initialKind={createKind}
        onClose={() => setCreateOpen(false)}
        onAddVisit={addVisit}
        onAddTask={addTask}
        onAddOrganization={addOrganization}
        onAddContact={addContact}
        organizations={organizationList}
        contacts={contactList}
        onNotify={setToast}
      />
      <VisitDetailDrawer visit={selectedVisit} tasks={tasks} onClose={() => setSelectedVisit(null)} onEdit={() => {
        if (!demoMode && !selectedVisit?.events) { setToast('请等待详情加载完成后编辑'); return }
        setEditingVisit(selectedVisit); setSourceVisit(null); setCreateKind('visit'); setCreateOpen(true); setSelectedVisit(null)
      }} onCreateTask={() => { openCreate('task'); setSourceVisit(selectedVisit); setSelectedVisit(null) }} onNotify={setToast} />
      {toast ? <div className="toast" role="status">{toast.startsWith('操作失败') ? <X size={18} /> : <CheckCircle2 size={18} />}{toast}</div> : null}
    </div></WriteAccess.Provider></OpenSourceVisit.Provider></BusinessSession.Provider></BusinessClock.Provider>
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

function NotificationPopover({ notices, onClose, onOpen }: { notices: ReturnType<typeof useNotifications>; onClose: () => void; onOpen: (id: string) => Promise<void> }) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement
    ref.current?.querySelector<HTMLElement>('button')?.focus()
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); close.current(); previous?.focus() } }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])
  return <div ref={ref} className="notification-popover" role="region" aria-label="通知列表">
    <header><strong>通知 · {notices.unread} 条未读</strong><button disabled={notices.busy || !notices.unread} type="button" onClick={() => void notices.markRead(notices.items, true)}>全部已读</button></header>
    <p className="notice-scope">部门逾期待办提醒；完成或取消后自动移出。</p>
    {notices.error ? <p role="alert">{notices.error}<button type="button" onClick={() => void notices.refresh()}>重试</button></p> : null}
    <div className="notification-items">{notices.items.map(item => <button key={item.id} type="button" disabled={notices.busy} className={item.read ? 'notice-read' : 'notice-unread'} onClick={async () => { if (await notices.markRead([item])) await onOpen(item.id) }}>
      <span className="notice-icon notice-danger"><ListTodo size={16} /></span><p><strong>{item.title}</strong><small>{item.read ? '已读' : '未读'} · 逾期待办</small><time>{new Date(item.dueAt).toLocaleString('zh-CN')}</time></p>
    </button>)}</div>
    {!notices.items.length && !notices.error ? <p className="notice-scope">暂无逾期待办通知</p> : null}
  </div>
}
