import type { SessionUser } from './types'

export interface ApiSession {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: SessionUser
}

export interface PageResponse<T> {
  items: T[]
  meta: { total: number; page: number; pageSize: number; pageCount: number }
}

export async function fetchAllPages<T>(path: string): Promise<PageResponse<T>> {
  const first = await apiRequest<PageResponse<T>>(`${path}?pageSize=100&page=1`)
  const items = [...first.items]
  for (let page = 2; page <= first.meta.pageCount; page += 1) {
    const next = await apiRequest<PageResponse<T>>(`${path}?pageSize=100&page=${page}`)
    items.push(...next.items)
  }
  return { ...first, items }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const SESSION_KEY = 'bam-auth-session-v0.2'
const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
let session = readSession()
let refreshInFlight: Promise<ApiSession> | null = null

function readSession(): ApiSession | null {
  try {
    const value = localStorage.getItem(SESSION_KEY)
    return value ? JSON.parse(value) as ApiSession : null
  } catch {
    return null
  }
}

function saveSession(next: ApiSession | null) {
  session = next
  if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next))
  else localStorage.removeItem(SESSION_KEY)
  window.dispatchEvent(new CustomEvent('bam-auth-change', { detail: next }))
}

function clientLabel() {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
  return `${mobile ? '部门小管家' : '商务活动管理'} · ${navigator.platform || 'Web'}`.slice(0, 120)
}

export function getSession() {
  return session
}

export function apiBaseUrl() {
  return API_BASE
}

export async function login(username: string, password: string) {
  const result = await rawRequest<ApiSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, clientLabel: clientLabel() }),
    headers: { 'Content-Type': 'application/json' },
  })
  saveSession(result)
  return result
}

export async function register(username: string, displayName: string, password: string) {
  const result = await rawRequest<ApiSession>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, displayName, password, clientLabel: clientLabel() }),
    headers: { 'Content-Type': 'application/json' },
  })
  saveSession(result)
  return result
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const result = await apiRequest<ApiSession>('/auth/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword, clientLabel: clientLabel() }),
  })
  saveSession(result)
  return result
}

export async function restoreSession() {
  if (!session) return null
  try {
    const current = await apiRequest<{ user: SessionUser }>('/auth/me')
    if (session) saveSession({ ...session, user: current.user })
    return session
  } catch {
    saveSession(null)
    return null
  }
}

export async function logout() {
  const current = session
  try {
    if (current) {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: current.refreshToken, clientLabel: clientLabel() }),
      })
    }
  } finally {
    saveSession(null)
  }
}

export interface ApiRequestOptions extends RequestInit { responseType?: 'blob'; timeoutMs?: number }
export async function apiRequest<T = unknown>(path: string, init: ApiRequestOptions = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  if (!(init.body instanceof FormData) && init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`)
  headers.set('X-Client-Platform', /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'web')

  try {
    return await rawRequest<T>(path, { ...init, headers })
  } catch (error) {
    const cannotRefresh = ['/auth/login', '/auth/register', '/auth/refresh'].includes(path)
    if (retry && error instanceof ApiError && error.status === 401 && session?.refreshToken && !cannotRefresh) {
      await refreshSession()
      return apiRequest<T>(path, init, false)
    }
    throw error
  }
}

async function refreshSession() {
  if (!session?.refreshToken) throw new ApiError('登录状态已失效', 401)
  if (!refreshInFlight) {
    const refreshToken = session.refreshToken
    refreshInFlight = rawRequest<ApiSession>('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken, clientLabel: clientLabel() }),
    }).then((next) => {
      saveSession(next)
      return next
    }).catch((error) => {
      saveSession(null)
      throw error
    }).finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

async function rawRequest<T>(path: string, init: ApiRequestOptions): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), init.timeoutMs || 20000)
  const cancel = () => controller.abort()
  if (init.signal?.aborted) controller.abort()
  init.signal?.addEventListener('abort', cancel, { once: true })
  try {
    const response = await fetch(`${API_BASE}${path}`, { ...init, signal: controller.signal })
    const contentType = response.headers.get('content-type') || ''
    if (response.ok && init.responseType === 'blob') return await response.blob() as T
    const data = contentType.includes('application/json') ? await response.json() as unknown : await response.text()
    if (!response.ok) {
      const payload = data as { message?: string | string[] }
      const message = Array.isArray(payload?.message) ? payload.message.join('；') : payload?.message
      throw new ApiError(message || `请求失败（${response.status}）`, response.status, data)
    }
    return data as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    const message = controller.signal.aborted ? '请求超时或已取消' : '无法连接业务服务或读取响应'
    const hint = init.method && init.method !== 'GET' ? '；保存结果未确认，请刷新核实后再重试' : '，请检查网络后重试'
    throw new ApiError(message + hint, controller.signal.aborted ? 408 : 0)
  } finally {
    clearTimeout(timer)
    init.signal?.removeEventListener('abort', cancel)
  }
}
