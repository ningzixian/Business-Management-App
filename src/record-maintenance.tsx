import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { apiRequest, fetchAllPages, getSession } from './api'
import { useBusinessUser } from './business-clock'
import { PreviewDialog } from './ui'
import type { EntityId } from './types'
import './record-maintenance.css'

type Kind = 'organizations' | 'contacts' | 'business-items'
type Row = { id: string; revision?: string; [key: string]: unknown }
type Field = { key: string; label: string; max?: number; required?: boolean; type?: string; options?: string[][] }
const orgFields: Field[] = [
  { key: 'name', label: '组织名称', required: true, max: 240 }, { key: 'shortName', label: '简称', max: 100 },
  { key: 'organizationType', label: '组织类型', options: [['company','公司'],['subsidiary','子公司'],['department','部门'],['government','政府'],['institution','事业单位'],['other','其他']] },
  { key: 'industry', label: '行业', max: 120 }, { key: 'region', label: '地区', max: 160 }, { key: 'address', label: '地址', max: 500 },
  { key: 'unifiedSocialCreditCode', label: '统一社会信用代码', max: 32 }, { key: 'website', label: '网站', max: 300 },
  { key: 'status', label: '状态', options: [['key','重点'],['following','跟进中'],['normal','正常'],['inactive','停用']] },
  { key: 'source', label: '来源', max: 120 }, { key: 'notes', label: '备注', type: 'textarea', max: 4000 },
]
const contactFields: Field[] = [
  { key: 'fullName', label: '姓名', required: true, max: 120 }, { key: 'gender', label: '性别', max: 20 },
  { key: 'mobile', label: '手机', type: 'tel', max: 40 }, { key: 'phone', label: '电话', type: 'tel', max: 60 },
  { key: 'email', label: '邮箱', type: 'email', max: 240 }, { key: 'wechat', label: '微信', max: 120 }, { key: 'city', label: '城市', max: 120 },
  { key: 'relationshipLevel', label: '关系等级', options: [['key','核心'],['important','重要'],['normal','一般'],['new','新联系']] },
  { key: 'status', label: '状态', options: [['provisional','待完善'],['active','有效'],['inactive','停用']] },
  { key: 'source', label: '来源', max: 120 }, { key: 'notes', label: '备注', type: 'textarea', max: 4000 },
]
const taskFields: Field[] = [
  { key: 'title', label: '待办标题', required: true, max: 300 }, { key: 'content', label: '补充说明', type: 'textarea', max: 10000 },
  { key: 'dueAt', label: '截止时间', type: 'datetime-local' },
  { key: 'priority', label: '优先级', options: [['high','高'],['medium','中'],['low','低']] },
  { key: 'status', label: '状态', options: [['pending','待处理'],['in_progress','进行中'],['completed','已完成'],['cancelled','已取消']] },
]
const affiliationFields: Field[] = [
  { key: 'title', label: '职务', max: 160 }, { key: 'relationshipRole', label: '关系角色', max: 120 },
  { key: 'status', label: '任职状态', options: [['current','当前任职'],['historical','历史任职']] },
  { key: 'startDate', label: '开始日期', type: 'date' }, { key: 'endDate', label: '结束日期', type: 'date' },
  { key: 'notes', label: '备注', type: 'textarea', max: 2000 },
]
const Maintenance = createContext<(kind: Kind, id: EntityId, close?: () => void) => void>(() => undefined)
export function RecordAction({ kind, id, onDone, label = '管理记录' }: { kind: Kind; id: EntityId; onDone?: () => void; label?: string }) {
  const open = useContext(Maintenance)
  return <button className="button button-secondary" type="button" onClick={() => open(kind, id, onDone)}>{label}</button>
}
export function RecordMaintenanceProvider({ children, refresh, enabled }: { children: ReactNode; refresh: () => Promise<unknown>; enabled: boolean }) {
  const [target, setTarget] = useState<{ kind: Kind; id: string; close?: () => void } | null>(null)
  return <Maintenance.Provider value={(kind, id, close) => { if (enabled) setTarget({ kind, id: String(id), close }); else window.alert('演示模式不保存修改，请登录实际服务后操作。') }}>{children}
    {target ? <MaintenanceDialog key={`${target.kind}/${target.id}`} kind={target.kind} id={target.id} onClose={() => setTarget(null)} onSaved={async () => { target.close?.(); if (await refresh() === false) throw new Error('列表同步失败') }} /> : null}
  </Maintenance.Provider>
}
function localInput(value: unknown) {
  if (!value) return ''
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function FieldInput({ field, value, set }: { field: Field; value: unknown; set: (value: string) => void }) {
  const props = { value: String(value ?? ''), onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(event.target.value), required: field.required }
  return <label>{field.label}{field.options ? <select {...props}>{field.options.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select> : field.type === 'textarea' ? <textarea {...props} maxLength={field.max} rows={3} /> : <input {...props} type={field.type || 'text'} maxLength={field.max} minLength={field.key === 'name' ? 2 : field.required ? 1 : undefined} />}</label>
}
function MaintenanceDialog({ kind, id, onClose, onSaved }: { kind: Kind; id: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const user = useBusinessUser(), canWrite = !!user && user.role !== 'readonly', canDelete = user?.role === 'admin' || user?.role === 'manager'
  const [record, setRecord] = useState<Row | null>(null), [draft, setDraft] = useState<Record<string, unknown>>({})
  const [organizations, setOrganizations] = useState<Row[]>([]), [contacts, setContacts] = useState<Row[]>([])
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [affiliation, setAffiliation] = useState<Row | null>(null)
  const pending = useRef(false)
  const path = `/${kind}/${id}`
  const initialize = (row: Row) => { setRecord(row); setDraft({ ...row, dueAt: localInput(row.dueAt), tags: Array.isArray(row.tags) ? row.tags.join('，') : '' }) }
  useEffect(() => {
    let active = true
    Promise.all([apiRequest<Row>(path), fetchAllPages<Row>('/organizations'), kind === 'business-items' ? fetchAllPages<Row>('/contacts') : Promise.resolve({ items: [] as Row[] })])
      .then(([row, orgs, people]) => { if (active) { initialize(row); setOrganizations(orgs.items); setContacts(people.items) } }).catch(err => { if (active) setError(err.message) })
    return () => { active = false }
  }, [path, kind])
  const fields = kind === 'organizations' ? orgFields : kind === 'contacts' ? contactFields : taskFields
  const isVisit = record?.itemType === 'visit'
  const openAffiliation = (row: Row) => {
    if (!record) return
    const changed = contactFields.some(field => String(draft[field.key] ?? '') !== String(record[field.key] ?? '')) || String(draft.tags) !== (Array.isArray(record.tags) ? record.tags.join('，') : '')
    if (changed) { setError('请先保存档案修改，再维护任职关系，避免丢失未保存的输入。'); return }
    setError(''); setAffiliation(row)
  }
  const mutate = async (url: string, method: string, body?: unknown, deleting = false) => {
    if (pending.current) return
    const currentUser = getSession()?.user
    if (!user || currentUser?.userId !== user.userId || currentUser?.role !== user.role || currentUser?.departmentId !== user.departmentId) { setError('登录身份已变化，请重新打开记录'); return }
    if (!record?.revision) { setError('未取得记录版本，请关闭后重试；服务器需升级后才支持此操作。'); return }
    pending.current = true
    setBusy(true); setError(''); setMessage('')
    try {
      await apiRequest(url, { method, headers: record?.revision ? { 'If-Match': record.revision } : {}, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
      if (!deleting) initialize(await apiRequest<Row>(path))
      setAffiliation(null)
      try { await onSaved() } catch { setMessage('修改已保存，但列表同步失败，请刷新页面。'); return }
      if (deleting) onClose()
      else setMessage('保存成功，相关列表与统计已刷新。')
    } catch (err) { setError(err instanceof Error ? err.message : '操作失败，请稍后重试') }
    finally { pending.current = false; setBusy(false) }
  }
  const save = () => {
    if (!record) return
    const body: Record<string, unknown> = {}
    // Submit changed fields only: untouched hidden/history relations and metadata must survive.
    for (const field of fields) {
      const old = field.key === 'dueAt' ? localInput(record.dueAt) : String(record[field.key] ?? '')
      const value = String(draft[field.key] ?? '')
      if (value !== old) body[field.key] = field.key === 'dueAt' ? value ? new Date(value).toISOString() : null : field.key === 'email' && !value ? null : value
    }
    if (kind === 'organizations' && draft.parentOrganizationId !== record.parentOrganizationId) body.parentOrganizationId = draft.parentOrganizationId || null
    if (kind === 'contacts' && String(draft.tags) !== (Array.isArray(record.tags) ? record.tags.join('，') : '')) body.tags = String(draft.tags).split(/[,，]/).map(tag => tag.trim()).filter(Boolean)
    if (kind === 'business-items') {
      body.expectedRevision = record.revision
      for (const key of ['organizationIds','contactIds','isInternal']) if (draft[key] !== record[key] && draft[key] !== undefined) body[key] = draft[key]
    }
    void mutate(path, 'PATCH', body)
  }
  const remove = () => {
    const impact = kind === 'organizations' ? '有下级组织时不能删除；人脉及历史事项保留。' : kind === 'contacts' ? '此人的任职关系将一并停用，组织与历史事项保留。' : '该事项将不再显示；关联组织、人脉、其他待办保留，附件将进入清理队列。'
    if (window.confirm(`确定删除“${String(record?.name || record?.fullName || record?.title || '')}”吗？\n${impact}\n本版本不提供恢复入口。`)) void mutate(path, 'DELETE', undefined, true)
  }
  return <PreviewDialog savedVersion={record?.revision} title={kind === 'organizations' ? '组织档案管理' : kind === 'contacts' ? '人脉档案管理' : isVisit ? '拜访记录管理' : '待办管理'} onClose={onClose}>
    <div className="record-maintenance" data-dialog-busy={busy}>
      {error ? <p role="alert" className="maintenance-error">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
      {!record ? <p>{error ? '无法打开记录，请关闭并刷新列表后重试。' : '正在读取最新记录…'}</p> : <>
        <p className="maintenance-hint">负责人：{String(record.ownerName || '未分配')} · {canWrite ? '保存前会检查记录版本，冲突时不会覆盖。' : '当前账号仅可查看。'}</p>
        {isVisit ? <p>请使用拜访详情中的“编辑记录”修改内容。</p> : <form onSubmit={event => { event.preventDefault(); save() }}>
          <fieldset disabled={!canWrite || busy}><div className="maintenance-grid">
            {fields.map(field => <FieldInput key={field.key} field={field} value={draft[field.key]} set={value => setDraft(old => ({ ...old, [field.key]: value }))} />)}
            {kind === 'organizations' ? <label>上级组织<select value={String(draft.parentOrganizationId || '')} onChange={event => setDraft(old => ({ ...old, parentOrganizationId: event.target.value || null }))}><option value="">无上级（顶级组织）</option>{organizations.filter(row => row.id !== id).map(row => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select></label> : null}
            {kind === 'contacts' ? <label>标签（逗号分隔）<input value={String(draft.tags || '')} onChange={event => setDraft(old => ({ ...old, tags: event.target.value }))} /></label> : null}
          </div>
          {kind === 'business-items' ? record.sourceItemId ? <p>此待办来自拜访，保留来源及原关联。如需改关联，请先核对来源拜访。</p> : <>
            <label><input type="checkbox" checked={!!draft.isInternal} onChange={event => setDraft(old => ({ ...old, isInternal: event.target.checked }))} /> 内部事项（可不关联组织、人脉）</label>
            {(['organizations','contacts'] as const).map(collection => {
              const key = collection === 'organizations' ? 'organizationIds' : 'contactIds'
              const selected = (draft[key] as string[] | undefined) || ((record[collection] || []) as Row[]).map(row => row.id)
              return <fieldset key={key} className="maintenance-relations"><legend>{collection === 'organizations' ? '关联组织' : '关联人脉'}</legend>{(collection === 'organizations' ? organizations : contacts).map(row => <label key={row.id}><input type="checkbox" checked={selected.includes(row.id)} onChange={event => setDraft(old => ({ ...old, [key]: event.target.checked ? [...selected, row.id] : selected.filter(value => value !== row.id) }))} />{String(row.name || row.fullName)}</label>)}</fieldset>
            })}
          </> : null}
          </fieldset>
          {canWrite ? <button type="submit" className="button button-primary" disabled={busy}>保存修改</button> : null}
        </form>}
        {kind === 'contacts' ? <section className="maintenance-affiliations"><h3>任职关系</h3><p>离职请改为历史任职；仅误录时删除。</p>
          {((record.affiliations || []) as Row[]).map(row => <article key={row.id}><strong>{String(row.organizationName)} · {String(row.title || '未填职务')}</strong><p>{row.status === 'current' ? '当前任职' : '历史任职'}{row.isPrimary ? ' · 主要任职' : ''}</p>{canWrite ? <button type="button" disabled={busy} onClick={() => openAffiliation({ ...row, startDate: String(row.startDate || '').slice(0,10), endDate: String(row.endDate || '').slice(0,10) })}>编辑任职</button> : null}{canDelete ? <button type="button" disabled={busy} onClick={() => { if (contactFields.some(field => String(draft[field.key] ?? '') !== String(record[field.key] ?? '')) || String(draft.tags) !== (Array.isArray(record.tags) ? record.tags.join('，') : '')) { setError('请先保存档案修改，再删除任职关系'); return }; if (window.confirm('仅删除这条误录任职，不删除人脉、组织或事项，确定吗？')) void mutate(`${path}/affiliations/${row.id}`, 'DELETE') }}>删除误录</button> : null}</article>)}
          {canWrite ? <button type="button" className="button button-secondary" disabled={busy} onClick={() => openAffiliation({ id: '', organizationId: '', status: 'current', isPrimary: false })}>添加任职</button> : null}
        </section> : null}
        {canDelete ? <button type="button" className="button maintenance-danger" disabled={busy} onClick={remove}>删除记录</button> : null}
      </>}
    </div>
    {affiliation ? <PreviewDialog title={affiliation.id ? '编辑任职关系' : '添加任职关系'} onClose={() => setAffiliation(null)}><form className="record-maintenance" onSubmit={event => {
      event.preventDefault()
      const body: Record<string, unknown> = { organizationId: affiliation.organizationId, status: affiliation.status, isPrimary: affiliation.status === 'current' && !!affiliation.isPrimary }
      for (const field of affiliationFields) body[field.key] = affiliation[field.key] || (field.type === 'date' ? null : '')
      if (affiliation.organizationId !== ((record?.affiliations || []) as Row[]).find(row => row.id === affiliation.id)?.organizationId) body.organizationUnitId = null
      void mutate(`${path}/affiliations${affiliation.id ? `/${affiliation.id}` : ''}`, affiliation.id ? 'PATCH' : 'POST', body)
    }}><fieldset disabled={busy}><label>任职组织<select required value={String(affiliation.organizationId)} onChange={event => setAffiliation(old => ({ ...old!, organizationId: event.target.value }))}><option value="">请选择组织</option>{organizations.map(row => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select></label>{affiliationFields.map(field => <FieldInput key={field.key} field={field} value={affiliation[field.key]} set={value => setAffiliation(old => ({ ...old!, [field.key]: value }))} />)}<label><input type="checkbox" checked={affiliation.status === 'current' && !!affiliation.isPrimary} disabled={affiliation.status !== 'current'} onChange={event => setAffiliation(old => ({ ...old!, isPrimary: event.target.checked }))} /> 设为主要任职</label></fieldset>{error ? <p role="alert">{error}</p> : null}<button className="button button-primary" type="submit" disabled={busy}>保存任职</button></form></PreviewDialog> : null}
  </PreviewDialog>
}
