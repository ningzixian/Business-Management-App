import { useEffect, useRef, useState } from 'react'
import { apiRequest, getSession } from './api'
import { useBusinessUser } from './business-clock'
import { WriteButton } from './write-access'
import { checkedFile, fileAccept, saveAttachment } from './attachment-files'
import type { EntityId } from './types'

interface Attachment { id: string; fileName: string; mimeType: string; sizeBytes: string; checksumSha256: string }
interface AttachmentList { items: Attachment[]; enabled: boolean; maxUploadBytes: number }
export function AttachmentPanel({ itemId }: { itemId: EntityId }) {
  const user = useBusinessUser()
  const [data, setData] = useState<AttachmentList | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const alive = useRef(false)
  const lock = useRef(false)
  const chooser = useRef<HTMLInputElement>(null)
  const demo = user?.userId === 'demo'
  const sameUser = () => alive.current && (demo || (getSession()?.user.userId === user?.userId && getSession()?.user.departmentId === user?.departmentId))
  const refresh = async () => {
    const result = await apiRequest<AttachmentList>(`/business-items/${itemId}/attachments`, { signal: controller.current?.signal })
    if (sameUser()) { setData(result); setUncertain(false) }
  }
  useEffect(() => {
    alive.current = true; setData(null); setMessage(''); setConfirmId(null); setUncertain(false)
    controller.current = new AbortController()
    if (!demo) void refresh().catch(e => { if (sameUser()) setMessage(e.message) })
    return () => { alive.current = false; controller.current?.abort() }
  }, [itemId, user?.userId])

  async function run(action: () => Promise<void>, writing = false) {
    if (lock.current) return
    lock.current = true; setBusy(true); setMessage('')
    try { await action() } catch (reason) {
      if (sameUser()) { setMessage(reason instanceof Error ? reason.message : '操作失败，请重试'); if (writing) setUncertain(true) }
    } finally { lock.current = false; if (sameUser()) setBusy(false) }
  }
  async function upload(file: File | undefined) {
    if (!file || !data) return
    let normalized: File
    try { normalized = checkedFile(file, data.maxUploadBytes) } catch (e) { setMessage((e as Error).message); return }
    await run(async () => {
      const body = new FormData(); body.append('file', normalized)
      await apiRequest(`/business-items/${itemId}/attachments`, { method: 'POST', body, signal: controller.current?.signal, timeoutMs: 120000 })
      await refresh(); if (sameUser()) setMessage('附件已上传')
    }, true)
  }
  async function download(file: Attachment) {
    await run(async () => {
      const blob = await apiRequest<Blob>(`/attachments/${file.id}`, { responseType: 'blob', signal: controller.current?.signal, timeoutMs: 120000 })
      if (!sameUser()) return
      if (blob.size !== Number(file.sizeBytes)) throw new Error('下载内容不完整，请重试')
      if (globalThis.crypto?.subtle) {
        const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
        const actual = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
        if (actual !== file.checksumSha256) throw new Error('附件校验失败，未保存文件')
      }
      if (sameUser()) { const saved = await saveAttachment(blob, file.fileName, file.checksumSha256); if (sameUser()) setMessage(saved) }
    })
  }
  return <section className="attachment-panel" data-dialog-busy={busy}><h3>附件</h3>
    <p>{demo ? '演示模式不上传真实文件' : '先保存事项，再上传附件。支持图片、Office/PDF、文本和录音文件；文件不会公开分享。'}</p>
    {!demo ? <>
      <div className="attachment-toolbar"><button className="button button-secondary" type="button" disabled={busy} onClick={() => void run(refresh)}>刷新附件</button>
        <WriteButton className="button button-secondary" type="button" disabled={busy || !data?.enabled || uncertain} onClick={() => chooser.current?.click()}>上传附件</WriteButton>
        <input ref={chooser} hidden type="file" disabled={busy} accept={fileAccept} onChange={e => { void upload(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {data ? <small>{data.enabled ? `单个文件最大 ${Math.floor(data.maxUploadBytes / 1024 / 1024)} MB。手机可在文件选择器中选择照片或录音。` : '服务器未启用附件存储，上传不可用。'}</small> : <small>附件列表尚未加载，加载失败可点击刷新。</small>}
      {uncertain ? <p role="alert">上传或删除结果未确认。请先刷新列表核实，避免重复上传。</p> : null}
      {data?.items.map(file => <article className="attachment-row" key={file.id}><div><strong>{file.fileName}</strong><small>{(Number(file.sizeBytes) / 1024).toFixed(1)} KB</small></div>
        <button type="button" disabled={busy} onClick={() => void download(file)}>下载</button>
        <WriteButton type="button" disabled={busy || uncertain} onClick={() => setConfirmId(file.id)}>删除</WriteButton>
        {confirmId === file.id ? <div className="attachment-confirm"><span>确认删除此附件？删除后无法通过本应用恢复。</span><WriteButton type="button" disabled={busy} onClick={() => void run(async () => { await apiRequest(`/attachments/${file.id}`, { method: 'DELETE', signal: controller.current?.signal }); setConfirmId(null); await refresh(); if (sameUser()) setMessage('附件已删除，后台清理存储') }, true)}>确认删除</WriteButton><button type="button" disabled={busy} onClick={() => setConfirmId(null)}>取消</button></div> : null}
      </article>)}
      {data && !data.items.length ? <p>暂无附件</p> : null}
    </> : null}
    {busy ? <p role="status">正在处理附件，请稍候…</p> : null}{message ? <p role="status">{message}</p> : null}
  </section>
}
