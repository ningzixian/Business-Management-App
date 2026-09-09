import { createContext, useContext, useEffect, useState } from 'react'
import type { SessionUser } from './types'

export const BusinessClock = createContext(new Date())
export const BusinessSession = createContext<SessionUser | null>(null)
export const OpenSourceVisit = createContext<(id: string) => void>(() => undefined)
export const useBusinessUser = () => useContext(BusinessSession)
export const useBusinessNow = () => useContext(BusinessClock)
export function useLiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const update = () => {
      clearTimeout(timer)
      const date = new Date(); setNow(date)
      const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
      timer = setTimeout(update, Math.min(30000, midnight.getTime() - date.getTime() + 10))
    }
    update()
    window.addEventListener('focus', update); window.addEventListener('pageshow', update)
    document.addEventListener('visibilitychange', update)
    return () => { clearTimeout(timer); window.removeEventListener('focus', update); window.removeEventListener('pageshow', update); document.removeEventListener('visibilitychange', update) }
  }, [])
  return now
}
