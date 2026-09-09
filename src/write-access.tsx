import { createContext, useContext, type ButtonHTMLAttributes } from 'react'

export const WriteAccess = createContext({ canWrite: false, busy: false })

/** Write controls are absent for readonly users; API authorization remains mandatory. */
export function WriteButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { canWrite, busy } = useContext(WriteAccess)
  if (!canWrite) return null
  return <button {...props} disabled={props.disabled || busy} aria-busy={busy || undefined} />
}
