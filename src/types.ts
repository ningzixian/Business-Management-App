export type PageKey =
  | 'dashboard'
  | 'organizations'
  | 'contacts'
  | 'visits'
  | 'tasks'
  | 'calendar'
  | 'reports'
  | 'settings'

export type VisitStatus = '已完成' | '进行中' | '待开始' | '已延期' | '已取消'
export type TaskStatus = '待处理' | '进行中' | '已完成' | '已逾期' | '已取消'
export type Priority = '高' | '中' | '低'
export type EntityId = string | number

export interface Visit {
  revision?: string
  events?: Array<{ id: string; action: string; createdAt: string; actorName?: string }>
  ownerUserId?: string
  completedAt?: string
  createdAt?: string
  id: EntityId
  organizationIds?: string[]
  contactIds?: string[]
  customer: string
  shortName: string
  contact: string
  phone: string
  owner: string
  participants: string[]
  date: string
  time: string
  endTime: string
  location: string
  region: string
  matter: string
  result: string
  status: VisitStatus
  color: string
}

export interface Task {
  revision?: string
  sourceItemId?: string
  ownerUserId?: string
  completedAt?: string
  createdAt?: string
  dueAt?: string
  content?: string
  id: EntityId
  organizationIds?: string[]
  contactIds?: string[]
  isInternal?: boolean
  title: string
  customer: string
  assignee: string
  due: string
  dueLabel: string
  priority: Priority
  status: TaskStatus
  source: string
}

export interface Customer {
  address?: string
  parentOrganizationId?: string | null
  parentOrganizationName?: string | null
  organizationType?: string
  id: EntityId
  name: string
  shortName: string
  industry: string
  contact: string
  phone: string
  region: string
  owner: string
  lastVisit: string
  nextAction: string
  openTasks: number
  status: '重点跟进' | '正常' | '待激活'
  color: string
}

export interface ContactAffiliation {
  id?: EntityId
  organizationId: string
  organizationName: string
  organizationUnitId?: string
  organizationUnitName?: string
  title?: string
  relationshipRole?: string
  isPrimary: boolean
  status: 'current' | 'historical'
  startDate?: string
  endDate?: string
}

export interface Contact {
  id: EntityId
  fullName: string
  gender?: string
  mobile: string
  phone?: string
  email?: string
  wechat?: string
  city?: string
  tags: string[]
  relationshipLevel: 'key' | 'important' | 'normal' | 'new'
  status: 'provisional' | 'active' | 'inactive'
  visibility: 'department' | 'private'
  ownerName: string
  primaryOrganizationId?: string
  primaryOrganizationName?: string
  primaryTitle?: string
  affiliationCount: number
  itemCount: number
  affiliations?: ContactAffiliation[]
}

export interface SessionUser {
  userId: string
  departmentId: string
  username: string
  displayName: string
  role: 'admin' | 'manager' | 'member' | 'readonly'
}
