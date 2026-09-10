import { RecordAction } from './record-maintenance'
import { DialogLayer } from './dialog-layer'
import { WriteButton } from './write-access'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  FileText,
  ListTodo,
  MapPin,
  Mic,
  Navigation,
  Phone,
  Plus,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import type { Contact, Customer, Task, Visit } from './types'
import { dialPhone, openMapSearch } from './client-actions'
import { InitialAvatar, StatusTag } from './ui'
import { useMobileLayout } from './use-mobile-layout'
import { useBusinessUser } from './business-clock'
import { draftKey, readDraft, writeDraft } from './visit-draft'
import { TaskPreview } from './task-preview'
import { AttachmentPanel } from './attachments'

export type CreateKind = 'visit' | 'task' | 'organization' | 'contact'

type AddHandler<T> = (record: T) => void | Promise<void>

export function CreateRecordModal({
  open,
  initialKind,
  onClose,
  onAddVisit,
  onAddTask,
  onAddOrganization,
  onAddContact,
  organizations,
  contacts,
  onNotify,
  editingVisit,
  sourceVisit,
}: {
  open: boolean
  initialKind: CreateKind
  onClose: () => void
  onAddVisit: AddHandler<Visit>
  onAddTask: AddHandler<Task>
  onAddOrganization: AddHandler<Customer>
  onAddContact: AddHandler<Contact>
  organizations: Customer[]
  contacts: Contact[]
  onNotify: (message: string) => void
  editingVisit?: Visit | null
  sourceVisit?: Visit | null
}) {
  const [kind, setKind] = useState<CreateKind>(initialKind)
  const isMobileLayout = useMobileLayout()

  useEffect(() => {
    if (open) setKind(initialKind)
  }, [initialKind, open])

  if (!open) return null

  return (
    <DialogLayer className="modal-backdrop" onClose={onClose}>
      <section
        className="record-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <span>{isMobileLayout ? '移动端快速记录' : '快速创建'}</span>
            <h2 id="record-modal-title">{isMobileLayout ? ({ visit: '新建拜访', task: '新建待办', organization: '添加组织', contact: '添加联系人' }[kind]) : '新建记录'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </header>

        {!editingVisit && !sourceVisit ? <div className="record-kind-tabs" role="tablist" aria-label="记录类型">
          <button className={kind === 'visit' ? 'is-active' : ''} type="button" onClick={() => setKind('visit')}>
            <CalendarDays size={17} /> 拜访记录
          </button>
          <button className={kind === 'task' ? 'is-active' : ''} type="button" onClick={() => setKind('task')}>
            <ListTodo size={17} /> 待办事项
          </button>
          <button className={kind === 'organization' ? 'is-active' : ''} type="button" onClick={() => setKind('organization')}>
            <Building2 size={17} /> 甲方组织
          </button>
          <button className={kind === 'contact' ? 'is-active' : ''} type="button" onClick={() => setKind('contact')}>
            <UserRound size={17} /> 人脉档案
          </button>
        </div> : <p className="record-context-note">{editingVisit ? '编辑拜访记录 · 保存时校验最新版本' : `来源拜访：${sourceVisit?.matter}`}</p>}

        {kind === 'visit' ? <VisitForm initial={editingVisit} onClose={onClose} onAdd={onAddVisit} organizations={organizations} contacts={contacts} onNotify={onNotify} /> : null}
        {kind === 'task' ? <TaskForm sourceVisit={sourceVisit} onClose={onClose} onAdd={onAddTask} organizations={organizations} contacts={contacts} /> : null}
        {kind === 'organization' ? <OrganizationForm organizations={organizations} onClose={onClose} onAdd={onAddOrganization} /> : null}
        {kind === 'contact' ? <ContactForm onClose={onClose} onAdd={onAddContact} organizations={organizations} /> : null}
      </section>
    </DialogLayer>
  )
}

function VisitForm({
  initial,
  onClose,
  onAdd,
  organizations,
  contacts,
  onNotify,
}: {
  initial?: Visit | null
  onClose: () => void
  onAdd: AddHandler<Visit>
  organizations: Customer[]
  contacts: Contact[]
  onNotify: (message: string) => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [organizationIds, setOrganizationIds] = useState<string[]>(initial?.organizationIds || [])
  const [contactIds, setContactIds] = useState<string[]>(initial?.contactIds || [])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const isMobileLayout = useMobileLayout()
  const user = useBusinessUser()
  const key = user ? draftKey(user.departmentId, user.userId) : draftKey('demo', 'demo')
  const [hasDraft, setHasDraft] = useState(false)
  useEffect(() => {
    if (initial) return
    try { setHasDraft(Boolean(readDraft(key))) } catch { setHasDraft(true); setError('草稿损坏或无法读取，可重试恢复或放弃草稿') }
  }, [key, initial])
  function discardDraft() {
    try { localStorage.removeItem(key); setHasDraft(false); setError(''); onNotify('已放弃已保存草稿') }
    catch { setError('无法删除草稿，请检查设备存储权限') }
  }
  function restoreDraft() {
    try {
      const draft = readDraft(key)
      if (!draft) { setHasDraft(false); return }
      for (const [name, value] of Object.entries(draft.values)) {
        const field = formRef.current?.elements.namedItem(name)
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = value
      }
      const orgIds = draft.organizationIds.filter(id => organizations.some(o => String(o.id) === id))
      const peopleIds = draft.contactIds.filter(id => contacts.some(c => String(c.id) === id))
      setOrganizationIds(orgIds); setContactIds(peopleIds)
      setError(orgIds.length !== draft.organizationIds.length || peopleIds.length !== draft.contactIds.length ? '部分关联已不可用，已移除，请核对后提交' : '')
      onNotify('草稿已恢复，请核对后保存')
    } catch { setError('草稿损坏或无法读取，可放弃草稿后重新填写') }
  }

  function goToDetails() {
    const fields = Array.from(formRef.current?.querySelectorAll<HTMLInputElement>('.visit-step-primary input[required]') ?? [])
    const invalidField = fields.find((field) => !field.checkValidity())
    if (invalidField) {
      invalidField.reportValidity()
      return
    }
    if (!organizationIds.length && !contactIds.length) {
      setError('请至少选择一个甲方组织或联系人')
      return
    }
    setError('')
    setStep(2)
    formRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function locateVisit() {
    if (!navigator.geolocation) {
      onNotify('当前浏览器不支持定位')
      return
    }
    onNotify('正在获取位置…')
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const locationInput = formRef.current?.elements.namedItem('location') as HTMLInputElement | null
      if (locationInput) locationInput.value = `纬度 ${coords.latitude.toFixed(6)}，经度 ${coords.longitude.toFixed(6)}`
      onNotify('位置已填入')
    }, () => onNotify('定位失败，请检查浏览器位置权限'))
  }

  function saveDraft() {
    if (!formRef.current) return
    try {
      const values = Object.fromEntries(Array.from(new FormData(formRef.current), ([k, v]) => [k, String(v)]))
      writeDraft(key, { values, organizationIds, contactIds }); setHasDraft(true); setError('')
      onNotify('拜访草稿已保存在当前设备，仅当前账号可恢复')
    } catch { setError('草稿保存失败，请检查存储空间和权限；输入已保留') }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organizationIds.length && !contactIds.length) {
      setStep(1)
      setError('请至少选择一个甲方组织或联系人')
      return
    }
    const values = new FormData(event.currentTarget)
    const organization = organizations.find((item) => organizationIds.includes(String(item.id)))
    const contact = contacts.find((item) => contactIds.includes(String(item.id)))
    const customer = organization?.name || '仅关联人脉'
    const dateTime = String(values.get('dateTime') || defaultDateTime(1))
    const participants = String(values.get('participants') || '')
      .split(/[、,，]/)
      .map((name) => name.trim())
      .filter(Boolean)
    if (submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    setError('')
    try {
      await onAdd({
        ...initial,
        id: initial?.id || Date.now(),
        organizationIds,
        contactIds,
        customer,
        shortName: organization?.shortName || customer.slice(0, 1),
        contact: contact?.fullName || '未关联联系人',
        phone: contact?.mobile || '—',
        owner: '当前用户',
        participants,
        date: dateTime.slice(0, 10),
        time: dateTime.slice(11, 16),
        endTime: String(values.get('endTime') || ''),
        location: String(values.get('location') || '待补充'),
        region: String(values.get('location') || '待补充'),
        matter: String(values.get('matter') || '待补充拜访事项'),
        result: String(values.get('result') || '待拜访后填写。'),
        status: initial ? String(values.get('status') || initial.status) as Visit['status'] : '待开始',
        color: '#0d6efd',
      })
      if (!initial) {
        try { localStorage.removeItem(key); setHasDraft(false) }
        catch { onNotify('记录已保存，但草稿清理失败，请重新打开后手动放弃草稿，勿重复提交') }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，请稍后重试')
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  return (
    <form className="record-form visit-record-form" ref={formRef} onSubmit={handleSubmit}>
      {!initial && hasDraft ? <div className="visit-draft-banner" role="status"><span>当前账号有已保存的拜访草稿。</span><div><button className="button button-secondary" type="button" onClick={restoreDraft}>恢复草稿</button><button className="button button-secondary" type="button" onClick={discardDraft}>放弃草稿</button></div></div> : null}
      <div className="mobile-form-progress" aria-label={`第 ${step} 步，共 2 步`}>
        <span className={step >= 1 ? 'is-active' : ''}><b>1</b><small>客户与时间</small></span>
        <i />
        <span className={step >= 2 ? 'is-active' : ''}><b>2</b><small>事项与记录</small></span>
      </div>
      <div className="form-grid">
        <div className={`visit-step-panel visit-step-primary ${!isMobileLayout || step === 1 ? 'is-active' : ''}`}>
          <RelationPicker
            organizations={organizations}
            contacts={contacts}
            organizationIds={organizationIds}
            contactIds={contactIds}
            onOrganizationIdsChange={setOrganizationIds}
            onContactIdsChange={setContactIds}
          />
          <label className="field"><span>拜访时间 <b>*</b></span><input name="dateTime" type="datetime-local" defaultValue={initial ? `${initial.date}T${initial.time}` : defaultDateTime(1)} required /></label>
          <label className="field"><span>结束时间</span><input name="endTime" type="time" defaultValue={initial?.endTime} /></label>
          <label className="field"><span>参与人</span><input name="participants" defaultValue={initial ? initial.participants.join('、') : user?.displayName || ''} placeholder="多人请用顿号分隔" /></label>
          <label className="field field-wide field-with-action">
            <span>地点 <b>*</b></span>
            <span className="input-action-wrap"><input name="location" defaultValue={initial?.location} required placeholder="请输入拜访地点" /><button type="button" aria-label="定位" onClick={locateVisit}><Navigation size={17} /></button></span>
          </label>
        </div>
        <div className={`visit-step-panel visit-step-details ${!isMobileLayout || step === 2 ? 'is-active' : ''}`}>
          {initial ? <label className="field field-wide"><span>拜访状态</span><select name="status" defaultValue={initial.status}>{(['待开始', '进行中', '已完成', '已延期', '已取消'] as const).map(status => <option key={status}>{status}</option>)}</select></label> : null}
          <label className="field field-wide"><span>拜访事项 <b>*</b></span><textarea name="matter" defaultValue={initial?.matter} required maxLength={10000} placeholder="本次拜访需要沟通和确认的具体事项" /></label>
          <label className="field field-wide"><span>跟进结果</span><textarea name="result" defaultValue={initial?.result} maxLength={10000} placeholder="可在拜访结束后补充沟通结果和下一步计划" /></label>
          <div className="attachment-actions field-wide">
            <button type="button" disabled title="保存后在拜访详情上传照片"><Camera size={17} /> 拍照附件</button>
            <button type="button" disabled title="保存后在拜访详情上传录音文件"><Mic size={17} /> 录音附件</button>
            <span>请先保存拜访，再在详情上传照片、文档或录音文件；暂不提供在线录音转写。</span>
          </div>
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {!initial && isMobileLayout ? <button className="button button-secondary" type="button" disabled={submitting} onClick={saveDraft}>保存草稿</button> : null}
      <footer className="modal-footer">
        {isMobileLayout ? (
          step === 1 ? (
            <><button className="button button-secondary" type="button" onClick={onClose}>取消</button><button className="button button-primary" type="button" onClick={event => { event.preventDefault(); goToDetails() }}>下一步 <ArrowRight size={17} /></button></>
          ) : (
            <><button className="button button-secondary" type="button" onClick={() => setStep(1)}><ChevronLeft size={17} />上一步</button><button className="button button-primary" type="submit" disabled={submitting}><CheckCircle2 size={17} />{submitting ? '保存中…' : '保存拜访'}</button></>
          )
        ) : (
          <><button className="button button-secondary" type="button" onClick={onClose}>取消</button>{!initial ? <button className="button button-secondary save-draft" type="button" onClick={saveDraft}>保存草稿</button> : null}<button className="button button-primary" type="submit" disabled={submitting}><CheckCircle2 size={17} /> {submitting ? '保存中…' : '保存记录'}</button></>
        )}
      </footer>
    </form>
  )
}

function TaskForm({
  sourceVisit,
  onClose,
  onAdd,
  organizations,
  contacts,
}: {
  sourceVisit?: Visit | null
  onClose: () => void
  onAdd: AddHandler<Task>
  organizations: Customer[]
  contacts: Contact[]
}) {
  const [organizationIds, setOrganizationIds] = useState<string[]>(sourceVisit?.organizationIds || [])
  const [contactIds, setContactIds] = useState<string[]>(sourceVisit?.contactIds || [])
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isInternal && !organizationIds.length && !contactIds.length) {
      setError('外部待办请至少关联一个甲方组织或联系人')
      return
    }
    const values = new FormData(event.currentTarget)
    const due = String(values.get('due') || defaultDateTime(24))
    const organization = organizations.find((item) => organizationIds.includes(String(item.id)))
    if (submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    setError('')
    try {
      await onAdd({
        id: Date.now(),
        sourceItemId: sourceVisit ? String(sourceVisit.id) : undefined,
        organizationIds,
        contactIds,
        isInternal,
        title: String(values.get('title') || '未命名待办'),
        content: String(values.get('description') || ''),
        customer: isInternal ? '部门内部' : organization?.name || '仅关联人脉',
        assignee: '当前用户',
        due: due.slice(0, 10),
        dueLabel: `${due.slice(5, 7)}月${due.slice(8, 10)}日 ${due.slice(11, 16)}`,
        priority: (String(values.get('priority') || '中') as Task['priority']),
        status: '待处理',
        source: sourceVisit ? '来源拜访' : isInternal ? '部门内部' : '独立待办',
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建失败，请稍后重试')
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field field-wide"><span>待办事项 <b>*</b></span><input name="title" defaultValue={sourceVisit?.matter.slice(0, 300)} required maxLength={300} placeholder="请输入需要完成的具体事项" /></label>
        {!sourceVisit ? <label className="internal-task-toggle field-wide"><input type="checkbox" checked={isInternal} onChange={(event) => setIsInternal(event.target.checked)} /><span><strong>部门内部待办</strong><small>开启后可不关联外部组织或联系人</small></span></label> : <p className="field-wide">组织和人脉继承来源拜访，服务器保存时核验；需要调整关联请先编辑来源拜访。</p>}
        {!isInternal ? <fieldset className="inherited-relations field-wide" disabled={Boolean(sourceVisit)}><RelationPicker organizations={organizations} contacts={contacts} organizationIds={organizationIds} contactIds={contactIds} onOrganizationIdsChange={setOrganizationIds} onContactIdsChange={setContactIds} /></fieldset> : null}
        <label className="field"><span>负责人</span><input disabled value="当前登录用户" readOnly /></label>
        <label className="field"><span>截止时间 <b>*</b></span><input name="due" type="datetime-local" required defaultValue={defaultDateTime(24)} /></label>
        <label className="field"><span>优先级</span><select name="priority" defaultValue="中"><option>高</option><option>中</option><option>低</option></select></label>
        <label className="field field-wide"><span>补充说明</span><textarea name="description" defaultValue={sourceVisit?.result} placeholder="验收标准、所需材料或协作说明" /></label>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <footer className="modal-footer">
        <button className="button button-secondary" type="button" onClick={onClose}>取消</button>
        <button className="button button-primary" type="submit" disabled={submitting}><Plus size={17} /> {submitting ? '创建中…' : '创建待办'}</button>
      </footer>
    </form>
  )
}

function OrganizationForm({ organizations, onClose, onAdd }: { organizations: Customer[]; onClose: () => void; onAdd: AddHandler<Customer> }) {
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const name = String(values.get('name') || '未命名客户')
    if (submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    setError('')
    try {
      await onAdd({
        id: Date.now(),
        name,
        shortName: String(values.get('shortName') || name.slice(0, 6)),
        parentOrganizationId: String(values.get('parentOrganizationId') || '') || null,
        organizationType: String(values.get('organizationType') || 'company'),
        industry: String(values.get('industry') || '其他'),
        contact: '暂无联系人',
        phone: '—',
        region: String(values.get('region') || '待补充'),
        owner: '当前用户',
        lastVisit: '暂无拜访',
        nextAction: '暂无待办',
        openTasks: 0,
        status: String(values.get('status')) === '重点跟进' ? '重点跟进' : '正常',
        color: '#0d6efd',
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '添加失败，请稍后重试')
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field field-wide"><span>组织全称 <b>*</b></span><input name="name" required minLength={2} maxLength={240} placeholder="请输入公司、机构或部门名称" /></label>
        <label className="field"><span>组织类型</span><select name="organizationType" defaultValue="company"><option value="company">公司</option><option value="subsidiary">子公司</option><option value="department">部门</option><option value="government">政府机关</option><option value="institution">事业单位</option><option value="other">其他</option></select></label>
        <label className="field field-wide"><span>上级组织</span><select name="parentOrganizationId" defaultValue=""><option value="">无上级（一级组织）</option>{organizations.map((org) => <option key={org.id} value={org.id}>{organizationPath(org, organizations)}</option>)}</select><small>部门可隶属于公司，也可隶属于另一个部门。</small></label>
        <label className="field"><span>组织简称</span><input name="shortName" placeholder="用于列表和事项展示" /></label>
        <label className="field"><span>所属行业</span><select name="industry" defaultValue="智能制造"><option>智能制造</option><option>商贸零售</option><option>软件信息</option><option>物流供应链</option><option>其他</option></select></label>
        <label className="field"><span>组织状态</span><select name="status" defaultValue="正常"><option>重点跟进</option><option>正常</option></select></label>
        <label className="field field-wide"><span>所在地区</span><input name="region" placeholder="省、市、区及详细地址" /></label>
        <p className="form-relationship-note field-wide"><UsersRound size={17} /><span><strong>组织与人脉分开建档</strong><small>保存组织后，可在人脉中建立一个或多个任职关系。</small></span></p>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <footer className="modal-footer">
        <button className="button button-secondary" type="button" onClick={onClose}>取消</button>
        <button className="button button-primary" type="submit" disabled={submitting}><Plus size={17} /> {submitting ? '保存中…' : '添加组织'}</button>
      </footer>
    </form>
  )
}

function ContactForm({ onClose, onAdd, organizations }: { onClose: () => void; onAdd: AddHandler<Contact>; organizations: Customer[] }) {
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const organizationId = String(values.get('organizationId') || '')
    const organization = organizations.find((item) => String(item.id) === organizationId)
    if (submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    setError('')
    try {
      await onAdd({
        id: Date.now(),
        fullName: String(values.get('fullName') || '未命名联系人'),
        mobile: String(values.get('mobile') || '待补充'),
        phone: String(values.get('phone') || '') || undefined,
        email: String(values.get('email') || '') || undefined,
        wechat: String(values.get('wechat') || '') || undefined,
        city: String(values.get('city') || '') || undefined,
        tags: String(values.get('tags') || '').split(/[、,，]/).map((tag) => tag.trim()).filter(Boolean),
        relationshipLevel: String(values.get('relationshipLevel') || 'normal') as Contact['relationshipLevel'],
        status: organization ? 'active' : 'provisional',
        visibility: 'department',
        ownerName: '当前用户',
        primaryOrganizationId: organization ? String(organization.id) : undefined,
        primaryOrganizationName: organization?.name,
        primaryTitle: String(values.get('title') || '') || undefined,
        affiliationCount: organization ? 1 : 0,
        itemCount: 0,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '添加失败，请稍后重试')
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field"><span>姓名 <b>*</b></span><input name="fullName" required placeholder="联系人姓名或称谓" /></label>
        <label className="field"><span>手机号码</span><input name="mobile" type="tel" placeholder="用于快速联系" /></label>
        <label className="field"><span>办公电话</span><input name="phone" type="tel" /></label>
        <label className="field"><span>电子邮箱</span><input name="email" type="email" /></label>
        <label className="field"><span>微信</span><input name="wechat" /></label>
        <label className="field"><span>所在城市</span><input name="city" /></label>
        <label className="field"><span>主要任职组织</span><select name="organizationId" defaultValue=""><option value="">暂不关联，保存为待完善</option>{organizations.map((organization) => <option key={organization.id} value={String(organization.id)}>{organizationPath(organization, organizations)}</option>)}</select></label>
        <label className="field"><span>职务</span><input name="title" placeholder="选择组织后填写" /></label>
        <label className="field"><span>关系等级</span><select name="relationshipLevel" defaultValue="normal"><option value="key">核心人脉</option><option value="important">重要人脉</option><option value="normal">一般联系</option><option value="new">新联系人</option></select></label>
        <label className="field"><span>标签</span><input name="tags" placeholder="采购、技术、决策人" /></label>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <footer className="modal-footer"><button className="button button-secondary" type="button" onClick={onClose}>取消</button><button className="button button-primary" type="submit" disabled={submitting}><Plus size={17} />{submitting ? '保存中…' : '添加联系人'}</button></footer>
    </form>
  )
}

function RelationPicker({
  organizations,
  contacts,
  organizationIds,
  contactIds,
  onOrganizationIdsChange,
  onContactIdsChange,
}: {
  organizations: Customer[]
  contacts: Contact[]
  organizationIds: string[]
  contactIds: string[]
  onOrganizationIdsChange: (ids: string[]) => void
  onContactIdsChange: (ids: string[]) => void
}) {
  const selectedOrgSet = new Set(organizationIds)
  const sortedContacts = [...contacts].sort((left, right) => {
    const leftSuggested = left.primaryOrganizationId && selectedOrgSet.has(left.primaryOrganizationId) ? 1 : 0
    const rightSuggested = right.primaryOrganizationId && selectedOrgSet.has(right.primaryOrganizationId) ? 1 : 0
    return rightSuggested - leftSuggested || left.fullName.localeCompare(right.fullName, 'zh-CN')
  })

  function toggleOrganization(id: string) {
    onOrganizationIdsChange(organizationIds.includes(id) ? organizationIds.filter((item) => item !== id) : [...organizationIds, id])
  }

  function toggleContact(contact: Contact) {
    const id = String(contact.id)
    const selected = contactIds.includes(id)
    onContactIdsChange(selected ? contactIds.filter((item) => item !== id) : [...contactIds, id])
    if (!selected && !organizationIds.length && contact.primaryOrganizationId) {
      onOrganizationIdsChange([contact.primaryOrganizationId])
    }
  }

  return (
    <div className="relation-picker field-wide">
      <div className="relation-picker-heading"><span><Building2 size={16} />关联甲方组织 <b>*</b></span><small>可多选 · 已选 {organizationIds.length}</small></div>
      <div className="relation-choice-list">
        {organizations.map((organization) => <button className={organizationIds.includes(String(organization.id)) ? 'is-selected' : ''} type="button" key={organization.id} onClick={() => toggleOrganization(String(organization.id))}><i />{organizationPath(organization, organizations)}</button>)}
      </div>
      <div className="relation-picker-heading"><span><UserRound size={16} />关联联系人</span><small>选择组织后优先显示相关人脉 · 已选 {contactIds.length}</small></div>
      <div className="relation-choice-list contact-choices">
        {sortedContacts.map((contact) => {
          const suggested = Boolean(contact.primaryOrganizationId && selectedOrgSet.has(contact.primaryOrganizationId))
          return <button className={contactIds.includes(String(contact.id)) ? 'is-selected' : ''} type="button" key={contact.id} onClick={() => toggleContact(contact)}><i />{contact.fullName}{suggested ? <em>关联</em> : null}</button>
        })}
      </div>
      {!organizations.length && !contacts.length ? <p className="relation-empty">请先在组织或人脉中建立主数据。</p> : null}
    </div>
  )
}

function defaultDateTime(hoursAhead: number) {
  const date = new Date(Date.now() + hoursAhead * 60 * 60 * 1000)
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function VisitDetailDrawer({
  visit,
  onClose,
  onCreateTask,
  onNotify,
  onEdit,
  tasks,
}: {
  visit: Visit | null
  onClose: () => void
  onCreateTask: () => void
  onNotify: (message: string) => void
  onEdit: () => void
  tasks: Task[]
}) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  useEffect(() => setSelectedTask(null), [visit?.id])
  if (!visit) return null
  return (
    <DialogLayer className="drawer-backdrop" onClose={onClose} protect={false}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-label="拜访详情" onMouseDown={(event) => event.stopPropagation()}>
        <header className="drawer-header">
          <div><span>拜访详情</span><StatusTag label={visit.status} /></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button>
        </header>
        <div className="drawer-body">
          <section className="customer-identity">
            <InitialAvatar text={visit.shortName} color={visit.color} size="large" />
            <div><h2>{visit.customer}</h2><p>{visit.contact} · {visit.phone}</p></div>
            <button className="icon-button call-button" type="button" aria-label="拨打电话" onClick={() => dialPhone(visit.phone, () => onNotify('该联系人尚未录入有效电话'))}><Phone size={18} /></button>
          </section>
          <section className="mobile-detail-actions" aria-label="快捷操作">
            <button type="button" onClick={() => dialPhone(visit.phone, () => onNotify('该联系人尚未录入有效电话'))}><Phone size={17} /><span>联系客户</span></button>
            <button type="button" onClick={() => openMapSearch(visit.location, () => onNotify('该拜访尚未填写有效地点'))}><Navigation size={17} /><span>地图导航</span></button>
            <WriteButton type="button" onClick={onCreateTask}><ListTodo size={17} /><span>生成待办</span></WriteButton>
          </section>
          <section className="detail-info-grid">
            <DetailItem icon={<Clock3 />} label="拜访时间" value={`${visit.date} ${visit.time}${visit.endTime ? ` — ${visit.endTime}` : ''}`} />
            <DetailItem icon={<MapPin />} label="地点" value={visit.location} />
            <DetailItem icon={<UserRound />} label="负责人" value={visit.owner} />
            <DetailItem icon={<UsersRound />} label="参与人" value={visit.participants.join('、')} />
          </section>
          <section className="detail-section"><h3><FileText size={17} />拜访事项</h3><p>{visit.matter}</p></section>
          <section className="detail-section result-section"><h3><CheckCircle2 size={17} />跟进结果</h3><p>{visit.result}</p></section>
          <AttachmentPanel key={visit.id} itemId={visit.id} />
          <section className="detail-section">
            <h3><ListTodo size={17} />后续行动</h3>
            {tasks.filter(task => task.sourceItemId === String(visit.id)).map(task => <button type="button" className="linked-task" key={task.id} onClick={() => setSelectedTask(task)}><div><strong>{task.title}</strong><small>{task.assignee} · {task.dueLabel}</small></div><StatusTag label={task.status} /></button>)}
            {!tasks.some(task => task.sourceItemId === String(visit.id)) ? <p>暂无后续待办</p> : null}
            <WriteButton className="add-linked-task" type="button" onClick={onCreateTask}><Plus size={16} /> 添加后续待办</WriteButton>
          </section>
          <section className="detail-section">
            <h3><Clock3 size={17} />记录时间线</h3>
            <div className="record-timeline">
              {visit.events?.map(event => <span key={event.id}><i /><strong>{event.action.endsWith('.create') ? '创建拜访记录' : event.action.endsWith('.update') ? '修改拜访记录' : '事项操作'}</strong><small>{new Date(event.createdAt).toLocaleString()} · {event.actorName || '已停用用户'}</small></span>)}
              {!visit.events?.length ? <p>暂无可用操作记录</p> : null}
            </div>
          </section>
        </div>
        <footer className="drawer-footer"><RecordAction kind="business-items" id={visit.id} onDone={onClose} label="删除与管理" /><WriteButton className="button button-secondary" type="button" onClick={onEdit}>编辑记录</WriteButton><WriteButton className="button button-primary" type="button" onClick={onCreateTask}>生成待办</WriteButton></footer>
      </aside>
      <TaskPreview task={selectedTask} onClose={() => setSelectedTask(null)} />
    </DialogLayer>
  )
}

function DetailItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="detail-item"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>
}
import { organizationPath } from './organization-tree'
