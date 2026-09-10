import { DialogLayer } from './dialog-layer'
import type { CSSProperties, ReactNode } from 'react'
import { ChevronRight, X } from 'lucide-react'

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <section className={`card ${className}`.trim()}>{children}</section>
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <header className="card-header">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </header>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow ? <span className="page-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  )
}

export function StatusTag({ label }: { label: string }) {
  const tone =
    label.includes('完成') || label === '正常'
      ? 'success'
      : label.includes('进行') || label.includes('重点')
        ? 'primary'
        : label.includes('逾期') || label.includes('延期')
          ? 'danger'
          : label === '待激活'
            ? 'muted'
            : 'warning'

  return <span className={`status-tag status-${tone}`}>{label}</span>
}

export function InitialAvatar({
  text,
  color = '#0d6efd',
  size = 'medium',
}: {
  text: string
  color?: string
  size?: 'small' | 'medium' | 'large'
}) {
  return (
    <span
      className={`initial-avatar avatar-${size}`}
      style={{ '--avatar-color': color } as CSSProperties}
      aria-hidden="true"
    >
      {text.slice(0, 1)}
    </span>
  )
}

export function ProgressBar({
  value,
  tone = 'blue',
}: {
  value: number
  tone?: 'blue' | 'green' | 'orange'
}) {
  return (
    <span className="progress-track" aria-label={`完成度 ${value}%`}>
      <span
        className={`progress-value progress-${tone}`}
        style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
      />
    </span>
  )
}

export function TextLink({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button className="text-link" type="button" onClick={onClick}>
      {children}
      <ChevronRight size={15} aria-hidden="true" />
    </button>
  )
}

export function PreviewDialog({ title, eyebrow = '详情', children, onClose, savedVersion }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; savedVersion?: string }) {
  return (
    <DialogLayer className="modal-backdrop" onClose={onClose} savedVersion={savedVersion}>
      <section className="record-modal preview-dialog" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header"><div><span>{eyebrow}</span><h2>{title}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button></header>
        <div className="preview-dialog-body">{children}</div>
      </section>
    </DialogLayer>
  )
}
