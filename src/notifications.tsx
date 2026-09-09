import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest } from './api'
import type { SessionUser } from './types'

export interface Reminder { id: string; title: string; dueAt: string; read: boolean }

export function useNotifications(user: SessionUser | null, demo: boolean, refreshKey: unknown) {
  const [items, setItems] = useState<Reminder[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const identity = user ? `${user.departmentId}:${user.userId}` : ''
  const generation = useRef(0)
  const writing = useRef(false)
  const currentIdentity = useRef(identity)
  currentIdentity.current = identity
  const refresh = useCallback(async () => {
    const request = ++generation.current
    if (!identity || demo) { setItems([]); setError(''); return }
    try {
      const result = await apiRequest<{ items: Reminder[] }>('/notifications')
      if (request === generation.current) { setItems(result.items); setError('') }
    } catch (reason) {
      if (request === generation.current) setError(reason instanceof Error ? reason.message : '通知加载失败')
    }
  }, [identity, demo])
  useEffect(() => {
    setItems([])
    void refresh()
    const timer = window.setInterval(() => void refresh(), 60_000)
    window.addEventListener('focus', refresh)
    return () => { generation.current++; clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [refresh])
  useEffect(() => { void refresh() }, [refresh, refreshKey])
  async function markRead(selected: Reminder[], all = false) {
    if (writing.current) return false
    const owner = identity
    writing.current = true
    setBusy(true)
    try {
      if (all) await apiRequest('/notifications/read-all', { method: 'PUT' })
      else for (const item of selected.filter(item => !item.read)) {
        if (owner !== currentIdentity.current) return false
        await apiRequest(`/notifications/${item.id}/read`, { method: 'PUT' })
      }
      if (owner !== currentIdentity.current) return false
      await refresh()
      return true
    } catch (reason) {
      if (owner === currentIdentity.current) setError(`已读保存失败，请重试：${reason instanceof Error ? reason.message : '网络异常'}`)
      return false
    } finally { writing.current = false; setBusy(false) }
  }
  return { items, error, busy, refresh, markRead, unread: items.filter(item => !item.read).length }
}
