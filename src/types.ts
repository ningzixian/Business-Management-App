export type PageKey =
  | 'dashboard'
  | 'customers'
  | 'visits'
  | 'tasks'
  | 'calendar'
  | 'reports'
  | 'settings'

export type VisitStatus = '已完成' | '进行中' | '待开始' | '已延期'
export type TaskStatus = '待处理' | '进行中' | '已完成' | '已逾期'
export type Priority = '高' | '中' | '低'

export interface Visit {
  id: number
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
  id: number
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
  id: number
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

