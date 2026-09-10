import { RecordAction } from './record-maintenance'
import type { Task } from './types'
import { PreviewDialog, StatusTag } from './ui'
import { useBusinessNow, OpenSourceVisit } from './business-clock'
import { useContext } from 'react'
import { currentTask } from './business-metrics'
import { AttachmentPanel } from './attachments'

export function SourceVisitButton({ task }: { task: Task }) {
  const openSource = useContext(OpenSourceVisit)
  return task.sourceItemId ? <button type="button" onClick={() => openSource(task.sourceItemId!)}>查看来源拜访</button> : null
}

export function TaskPreview({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const now = useBusinessNow()
  const openSource = useContext(OpenSourceVisit)
  if (!task) return null
  task = currentTask(task, now)
  return <PreviewDialog title={task.title} eyebrow="待办详情" onClose={onClose}><RecordAction kind="business-items" id={task.id} onDone={onClose} /><div className="preview-detail-grid"><div><small>负责人</small><strong>{task.assignee}</strong></div><div><small>截止时间</small><strong>{task.dueLabel}</strong></div><div><small>关联组织</small><strong>{task.customer}</strong></div><div><small>当前状态</small><StatusTag label={task.status} /></div></div><section className="task-description"><h3>补充说明</h3><p>{task.content || '未填写'}</p></section><AttachmentPanel key={task.id} itemId={task.id} />{task.sourceItemId ? <button type="button" onClick={() => { onClose(); openSource(task.sourceItemId!) }}>查看来源拜访</button> : null}</PreviewDialog>
}
