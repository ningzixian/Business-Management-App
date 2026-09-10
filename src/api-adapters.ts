import type { Contact, Customer, Task, Visit } from './types'

export interface ApiOrganization {
  parentOrganizationId?: string | null
  parentOrganizationName?: string | null
  id: string
  name: string
  shortName?: string
  organizationType: string
  industry?: string
  region?: string
  address?: string
  status: 'key' | 'following' | 'normal' | 'inactive'
  notes?: string
  ownerName?: string
  primaryContactId?: string
  primaryContactName?: string
  primaryContactMobile?: string
  contactCount: number
  itemCount: number
}

export interface ApiContact {
  id: string
  fullName: string
  gender?: string
  mobile?: string
  phone?: string
  email?: string
  wechat?: string
  city?: string
  tags?: string[]
  relationshipLevel: Contact['relationshipLevel']
  status: Contact['status']
  visibility: Contact['visibility']
  ownerName?: string
  primaryOrganizationId?: string
  primaryOrganizationName?: string
  primaryTitle?: string
  affiliationCount: number
  itemCount: number
  affiliations?: Array<{
    organizationId: string
    organizationName: string
    title?: string
    isPrimary?: boolean
    status: 'current' | 'historical'
  }>
}

export interface ApiBusinessItem {
  revision?: string
  events?: Visit['events']
  completedAt?: string
  createdAt?: string
  id: string
  itemType: 'visit' | 'task'
  title: string
  content?: string
  result?: string
  location?: string
  startsAt?: string
  endsAt?: string
  dueAt?: string
  status: string
  priority?: 'high' | 'medium' | 'low'
  isInternal: boolean
  ownerUserId: string
  ownerName: string
  sourceItemId?: string
  participantNames: string[]
  details?: Record<string, unknown>
  organizations: Array<{ id: string; name: string; shortName?: string }>
  contacts: Array<{ id: string; fullName: string; mobile?: string }>
  attachmentCount: number
}

const organizationStatus: Record<ApiOrganization['status'], Customer['status']> = {
  key: '重点跟进',
  following: '正常',
  normal: '正常',
  inactive: '待激活',
}

const visitStatus: Record<string, Visit['status']> = {
  planned: '待开始',
  in_progress: '进行中',
  completed: '已完成',
  postponed: '已延期',
  cancelled: '已取消',
}

const taskStatus: Record<string, Task['status']> = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  overdue: '已逾期',
  cancelled: '已取消',
}

const taskPriority: Record<string, Task['priority']> = { high: '高', medium: '中', low: '低' }

export function organizationColor(name: string) {
  const palette = ['#0d6efd', '#16a36a', '#8c6ad8', '#ee8a21', '#596bc8', '#0f8ca8', '#c05a73']
  const hash = [...name].reduce((result, char) => result + char.charCodeAt(0), 0)
  return palette[hash % palette.length]
}

export function toCustomer(org: ApiOrganization, items: ApiBusinessItem[]): Customer {
  const related = items.filter((item) => item.organizations.some((entry) => entry.id === org.id))
  const visits = related.filter((item) => item.itemType === 'visit' && item.startsAt)
  const openTasks = related.filter((item) => item.itemType === 'task' && !['completed', 'cancelled'].includes(item.status))
  const lastVisit = visits.sort((a, b) => String(b.startsAt).localeCompare(String(a.startsAt)))[0]
  const nextTask = openTasks.sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))[0]
  return {
    id: org.id,
    parentOrganizationId: org.parentOrganizationId,
    parentOrganizationName: org.parentOrganizationName,
    organizationType: org.organizationType,
    name: org.name,
    address: org.address,
    shortName: org.shortName || org.name.slice(0, 1),
    industry: org.industry || '未分类',
    contact: org.primaryContactName || (org.contactCount ? `${org.contactCount} 位联系人` : '暂无联系人'),
    phone: org.primaryContactMobile || '—',
    region: org.region?.trim() || '未填写地区',
    owner: org.ownerName || '未分配',
    lastVisit: lastVisit?.startsAt ? formatDateTime(lastVisit.startsAt) : '暂无拜访',
    nextAction: nextTask?.title || '暂无待办',
    openTasks: openTasks.length,
    status: organizationStatus[org.status],
    color: organizationColor(org.name),
  }
}

export function toContact(contact: ApiContact): Contact {
  const primaryAffiliation = contact.affiliations?.find((item) => item.isPrimary && item.status === 'current')
    || contact.affiliations?.find((item) => item.status === 'current')
  return {
    id: contact.id,
    fullName: contact.fullName,
    gender: contact.gender,
    mobile: contact.mobile || '待补充',
    phone: contact.phone,
    email: contact.email,
    wechat: contact.wechat,
    city: contact.city,
    tags: contact.tags || [],
    relationshipLevel: contact.relationshipLevel,
    status: contact.status,
    visibility: contact.visibility,
    ownerName: contact.ownerName || '未分配',
    primaryOrganizationId: contact.primaryOrganizationId || primaryAffiliation?.organizationId,
    primaryOrganizationName: contact.primaryOrganizationName || primaryAffiliation?.organizationName,
    primaryTitle: contact.primaryTitle || primaryAffiliation?.title,
    affiliationCount: contact.affiliationCount || contact.affiliations?.length || 0,
    itemCount: contact.itemCount || 0,
  }
}

export function toVisit(item: ApiBusinessItem): Visit {
  const start = item.startsAt ? new Date(item.startsAt) : null
  const end = item.endsAt ? new Date(item.endsAt) : null
  const organization = item.organizations[0]
  const contact = item.contacts[0]
  const customerName = organization?.name || '仅关联人脉'
  return {
    revision: item.revision,
    events: item.events,
    ownerUserId: item.ownerUserId,
    completedAt: item.completedAt,
    createdAt: item.createdAt,
    id: item.id,
    organizationIds: item.organizations.map((entry) => entry.id),
    contactIds: item.contacts.map((entry) => entry.id),
    customer: customerName,
    shortName: organization?.shortName || customerName.slice(0, 1),
    contact: contact?.fullName || '未关联联系人',
    phone: contact?.mobile || '—',
    owner: item.ownerName,
    participants: item.participantNames || [],
    date: start ? toLocalDate(start) : '',
    time: start ? toLocalTime(start) : '',
    endTime: end ? toLocalTime(end) : '',
    location: item.location || '待补充',
    region: '未填写地区',
    matter: item.content || item.title,
    result: item.result || '待拜访后填写。',
    status: visitStatus[item.status] || '待开始',
    color: organizationColor(customerName),
  }
}

export function toTask(item: ApiBusinessItem): Task {
  const due = item.dueAt ? new Date(item.dueAt) : null
  return {
    revision: item.revision,
    sourceItemId: item.sourceItemId,
    ownerUserId: item.ownerUserId,
    completedAt: item.completedAt,
    createdAt: item.createdAt,
    dueAt: item.dueAt,
    id: item.id,
    organizationIds: item.organizations.map((entry) => entry.id),
    contactIds: item.contacts.map((entry) => entry.id),
    isInternal: item.isInternal,
    title: item.title,
    content: item.content || '',
    customer: item.organizations[0]?.name || (item.contacts[0]?.fullName ? `联系人：${item.contacts[0].fullName}` : '部门内部'),
    assignee: item.ownerName,
    due: due ? toLocalDate(due) : '',
    dueLabel: due ? formatDateTime(due.toISOString()) : '未填写截止时间',
    priority: taskPriority[item.priority || 'medium'] || '中',
    status: taskStatus[item.status] || '待处理',
    source: item.sourceItemId ? '关联事项' : item.isInternal ? '部门内部' : '独立待办',
  }
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return `${date.getMonth() + 1}月${date.getDate()}日 ${toLocalTime(date)}`
}

function toLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toLocalTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
