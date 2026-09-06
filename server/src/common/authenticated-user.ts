import type { Request } from 'express'

export type UserRole = 'admin' | 'manager' | 'member' | 'readonly'

export interface AuthenticatedUser {
  userId: string
  departmentId: string
  username: string
  displayName: string
  role: UserRole
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser
}
