import { useEffect, useState, type ReactNode } from 'react'
import { DialogLayer } from './dialog-layer'

// Keep the focus/history layer mounted until the exit transition completes.
export function MobileMenuLayer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const [present, setPresent] = useState(open)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    let frame = 0, nextFrame = 0, timer = 0
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (open) {
      setPresent(true)
      frame = requestAnimationFrame(() => { nextFrame = requestAnimationFrame(() => setVisible(true)) })
    } else {
      setVisible(false)
      timer = window.setTimeout(() => setPresent(false), reduced ? 0 : 220)
    }
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(nextFrame); clearTimeout(timer) }
  }, [open])
  return present ? <DialogLayer className={`mobile-menu-backdrop${visible ? ' is-visible' : ''}`} onClose={onClose} protect={false}>{children}</DialogLayer> : null
}
