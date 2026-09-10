import { useEffect, useRef, useState, type ReactNode } from 'react'

type Layer = { root: HTMLElement; dismiss: () => void; focus: () => void }
const layers: Layer[] = []
const marker = '__bamDialog'
let removingHistory = false
function syncHistory() {
  if (removingHistory) return
  if (layers.length && !history.state?.[marker]) history.pushState({ ...history.state, [marker]: true }, '')
  if (!layers.length && history.state?.[marker]) { removingHistory = true; history.back() }
}
window.addEventListener('popstate', () => {
  if (removingHistory) { removingHistory = false; queueMicrotask(syncHistory); return }
  layers.at(-1)?.dismiss()
  queueMicrotask(syncHistory)
})

// Native Back and the browser history share the same dismissal path.
window.addEventListener('bam-native-back', event => {
  if (layers.length) { event.preventDefault(); event.stopImmediatePropagation(); layers.at(-1)?.dismiss() }
})

export function hasOpenDialogs() { return layers.length > 0 }

export function DialogLayer({ children, className, onClose, protect = true, savedVersion }: {
  children: ReactNode; className: string; onClose: () => void; protect?: boolean; savedVersion?: string
}) {
  const root = useRef<HTMLDivElement>(null)
  const dirty = useRef(false)
  useEffect(() => { dirty.current = false }, [savedVersion])
  const [dismissMessage, setDismissMessage] = useState('')
  const close = useRef(onClose)
  close.current = onClose
  const allow = () => {
    if (root.current?.querySelector('button[type="submit"]:disabled, [data-dialog-busy="true"]')) {
      setDismissMessage('正在保存或处理附件，请等待完成后再关闭。')
      return false
    }
    setDismissMessage('')
    return !dirty.current || window.confirm('有尚未保存的修改，确定放弃并关闭吗？')
  }
  const layer = useRef<Layer | null>(null)
  useEffect(() => {
    const node = root.current!
    const previous = document.activeElement as HTMLElement | null
    const dialog = node.querySelector<HTMLElement>('[role="dialog"]') || node
    dialog.tabIndex = -1
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(el => el.getClientRects().length && !el.closest('[inert]'))
    // Focusing a form control while a full-screen dialog is mounting makes some
    // Android WebViews scroll that control into view. Focus the dialog container
    // instead and explicitly preserve the current scroll position.
    const focusDialog = () => dialog.focus({ preventScroll: true })
    const entry: Layer = { root: node, dismiss: () => { if (allow()) close.current() }, focus: focusDialog }
    layer.current = entry
    layers.push(entry)
    const overflow = document.body.style.overflow
    if (layers.length === 1) document.body.dataset.dialogOverflow = overflow
    document.body.style.overflow = 'hidden'
    entry.focus()
    const resetScroll = () => {
      dialog.scrollTop = 0
      dialog.querySelectorAll<HTMLElement>('.record-form, .preview-dialog-body, .account-form').forEach(element => { element.scrollTop = 0 })
    }
    resetScroll()
    const resetFrame = requestAnimationFrame(resetScroll)
    queueMicrotask(syncHistory)
    const key = (event: KeyboardEvent) => {
      if (layers.at(-1) !== entry) return
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); entry.dismiss() }
      if (event.key === 'Tab') {
        const targets = focusable(), index = targets.indexOf(document.activeElement as HTMLElement)
        event.preventDefault()
        ;(targets.length ? targets[(index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length] : dialog).focus()
      }
    }
    const focus = (event: FocusEvent) => { if (layers.at(-1) === entry && !dialog.contains(event.target as Node)) entry.focus() }
    const unload = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = '' } }
    document.addEventListener('keydown', key, true)
    document.addEventListener('focusin', focus)
    window.addEventListener('beforeunload', unload)
    return () => {
      cancelAnimationFrame(resetFrame)
      layers.splice(layers.indexOf(entry), 1)
      document.removeEventListener('keydown', key, true)
      document.removeEventListener('focusin', focus)
      window.removeEventListener('beforeunload', unload)
      if (!layers.length) document.body.style.overflow = document.body.dataset.dialogOverflow || ''
      queueMicrotask(() => {
        syncHistory()
        if (!layers.length) window.dispatchEvent(new Event('bam-dialogs-closed'))
        if (previous?.isConnected && (!layers.length || layers.at(-1)!.root.contains(previous))) previous.focus()
        else layers.at(-1)?.focus()
      })
    }
  }, [])
  return <div ref={root} className={className} role="presentation"
    onInputCapture={event => { if (protect && !(event.target as HTMLElement).closest('.attachment-panel')) dirty.current = true }}
    onChangeCapture={event => { if (protect && !(event.target as HTMLElement).closest('.attachment-panel')) dirty.current = true }}
    onMouseDown={event => { if (event.target === event.currentTarget && layers.at(-1) === layer.current) layer.current?.dismiss() }}
    onClickCapture={event => {
      if (layers.at(-1) !== layer.current) return
      const button = (event.target as HTMLElement).closest('button')
      if (!button) return
      const label = button.getAttribute('aria-label') || button.textContent?.trim()
      if (label === '关闭' || label === '取消' || button.closest('.record-kind-tabs')) {
        if (!allow()) { event.preventDefault(); event.stopPropagation() }
        else if (button.closest('.record-kind-tabs')) dirty.current = false
      }
    }}>{children}{dismissMessage ? <div className="dialog-dismiss-message" role="status">{dismissMessage}</div> : null}</div>
}
