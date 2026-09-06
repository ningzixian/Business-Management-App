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
import { InitialAvatar, StatusTag } from './ui'
import { useMobileLayout } from './use-mobile-layout'

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
}) {
  const [kind, setKind] = useState<CreateKind>(initialKind)
  const isMobileLayout = useMobileLayout()

  useEffect(() => {
    if (open) setKind(initialKind)
  }, [initialKind, open])

  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
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

        <div className="record-kind-tabs" role="tablist" aria-label="记录类型">
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
        </div>

        {kind === 'visit' ? <VisitForm onClose={onClose} onAdd={onAddVisit} organizations={organizations} contacts={contacts} /> : null}
        {kind === 'task' ? <TaskForm onClose={onClose} onAdd={onAddTask} organizations={organizations} contacts={contacts} /> : null}
        {kind === 'organization' ? <OrganizationForm onClose={onClose} onAdd={onAddOrganization} /> : null}
        {kind === 'contact' ? <ContactForm onClose={onClose} onAdd={onAddContact} organizations={organizations} /> : null}
      </section>
    </div>
  )
}

function VisitForm({
  onClose,
  onAdd,
  organizations,
  contacts,
}: {
  onClose: () => void
  onAdd: AddHandler<Visit>
  organizations: Customer[]
  contacts: Contact[]
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [organizationIds, setOrganizationIds] = useState<string[]>([])
  const [contactIds, setContactIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const isMobileLayout = useMobileLayout()

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
    const participants = String(values.get('participants') || '张伟')
      .split(/[、,，]/)
      .map((name) => name.trim())
      .filter(Boolean)
    setSubmitting(true)
    setError('')
    try {
      await onAdd({
        id: Date.now(),
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
        status: '待开始',
        color: '#0d6efd',
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="record-form visit-record-form" ref={formRef} onSubmit={handleSubmit}>
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
          <label className="field"><span>拜访时间 <b>*</b></span><input name="dateTime" type="datetime-local" defaultValue={defaultDateTime(1)} required /></label>
          <label className="field"><span>结束时间</span><input name="endTime" type="time" /></label>
          <label className="field"><span>参与人</span><input name="participants" defaultValue="张伟" placeholder="多人请用顿号分隔" /></label>
          <label className="field field-wide field-with-action">
            <span>地点 <b>*</b></span>
            <span className="input-action-wrap"><input name="location" required placeholder="请输入拜访地点" /><button type="button" aria-label="定位"><Navigation size={17} /></button></span>
          </label>
        </div>
        <div className={`visit-step-panel visit-step-details ${!isMobileLayout || step === 2 ? 'is-active' : ''}`}>
          <label className="field field-wide"><span>拜访事项 <b>*</b></span><textarea name="matter" required maxLength={300} placeholder="本次拜访需要沟通和确认的具体事项" /></label>
          <label className="field field-wide"><span>跟进结果</span><textarea name="result" maxLength={500} placeholder="可在拜访结束后补充沟通结果和下一步计划" /></label>
          <div className="attachment-actions field-wide">
            <button type="button"><Camera size={17} /> 拍照</button>
            <button type="button"><Mic size={17} /> 录音纪要</button>
            <span>支持图片、文档和录音附件</span>
          </div>
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <footer className="modal-footer">
        {isMobileLayout ? (
          step === 1 ? (
            <><button className="button button-secondary" type="button" onClick={onClose}>取消</button><button className="button button-primary" type="button" onClick={goToDetails}>下一步 <ArrowRight size={17} /></button></>
          ) : (
            <><button className="button button-secondary" type="button" onClick={() => setStep(1)}><ChevronLeft size={17} />上一步</button><button className="button button-primary" type="submit" disabled={submitting}><CheckCircle2 size={17} />{submitting ? '保存中…' : '保存拜访'}</button></>
          )
        ) : (
          <><button className="button button-secondary" type="button" onClick={onClose}>取消</button><button className="button button-secondary save-draft" type="button">保存草稿</button><button className="button button-primary" type="submit" disabled={submitting}><CheckCircle2 size={17} /> {submitting ? '保存中…' : '保存记录'}</button></>
        )}
      </footer>
    </form>
  )
}

function TaskForm({
  onClose,
  onAdd,
  organizations,
  contacts,
}: {
  onClose: () => void
  onAdd: AddHandler<Task>
  organizations: Customer[]
  contacts: Contact[]
}) {
  const [organizationIds, setOrganizationIds] = useState<string[]>([])
  const [contactIds, setContactIds] = useState<string[]>([])
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
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
    setSubmitting(true)
    setError('')
    try {
      await onAdd({
        id: Date.now(),
        organizationIds,
        contactIds,
        isInternal,
        title: String(values.get('title') || '未命名待办'),
        customer: isInternal ? '部门内部' : organization?.name || '仅关联人脉',
        assignee: '当前用户',
        due: due.slice(0, 10),
        dueLabel: `${due.slice(5, 7)}月${due.slice(8, 10)}日 ${due.slice(11, 16)}`,
        priority: (String(values.get('priority') || '中') as Task['priority']),
        status: '待处理',
        source: isInternal ? '部门内部' : '独立待办',
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field field-wide"><span>待办事项 <b>*</b></span><input name="title" required placeholder="请输入需要完成的具体事项" /></label>
        <label className="internal-task-toggle field-wide"><input type="checkbox" checked={isInternal} onChange={(event) => setIsInternal(event.target.checked)} /><span><strong>部门内部待办</strong><small>开启后可不关联外部组织或联系人</small></span></label>
        {!isInternal ? <RelationPicker organizations={organizations} contacts={contacts} organizationIds={organizationIds} contactIds={contactIds} onOrganizationIdsChange={setOrganizationIds} onContactIdsChange={setContactIds} /> : null}
        <label className="field"><span>负责人</span><input disabled value="当前登录用户" readOnly /></label>
        <label className="field"><span>截止时间 <b>*</b></span><input name="due" type="datetime-local" required defaultValue={defaultDateTime(24)} /></label>
        <label className="field"><span>优先级</span><select name="priority" defaultValue="中"><option>高</option><option>中</option><option>低</option></select></label>
        <label className="field field-wide"><span>补充说明</span><textarea name="description" placeholder="验收标准、所需材料或协作说明" /></label>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <footer className="modal-footer">
        <button className="button button-secondary" type="button" onClick={onClose}>取消</button>
        <button className="button button-primary" type="submit" disabled={submitting}><Plus size={17} /> {submitting ? '创建中…' : '创建待办'}</button>
      </footer>
    </form>
  )
}

function OrganizationForm({ onClose, onAdd }: { onClose: () => void; onAdd: AddHandler<Customer> }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const name = String(values.get('name') || '未命名客户')
    setSubmitting(true)
    setError('')
    try {
      await onAdd({
        id: Date.now(),
        name,
        shortName: String(values.get('shortName') || name.slice(0, 6)),
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
      setSubmitting(false)
    }
  }

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field field-wide"><span>组织全称 <b>*</b></span><input name="name" required placeholder="请输入企业或机构完整名称" /></label>
        <label className="field"><span>组织简称</span><input name="shortName" placeholder="用于列表和事项展示" /></label>
        <label className="field"><span>所属行业</span><select name="industry" defaultValue="智能制造"><option>智能制造</option><option>商贸零售</option><option>软件信息</option><option>物流供应链</option><option>其他</option></select></label>
        <label className="field"><span>组织状态</span><select name="status" defaultValue="正常"><option>重点跟进</option><option>正常</option></select></label>
        <label className="field field-wide"><span>所在地区</span><input name="region" placeholder="省、市、区及详细地址" /></label>
        <p className="form-relationship-note field-wide"><UsersRound size={17} /><span><strong>组织与人脉分开建档</strong><small>保存组织后，可在人脉库中建立一个或多个任职关系。</small></span></p>
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
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const organizationId = String(values.get('organizationId') || '')
    const organization = organizations.find((item) => String(item.id) === organizationId)
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
        <label className="field"><span>主要任职组织</span><select name="organizationId" defaultValue=""><option value="">暂不关联，保存为待完善</option>{organizations.map((organization) => <option key={organization.id} value={String(organization.id)}>{organization.name}</option>)}</select></label>
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
        {organizations.map((organization) => <button className={organizationIds.includes(String(organization.id)) ? 'is-selected' : ''} type="button" key={organization.id} onClick={() => toggleOrganization(String(organization.id))}><i />{organization.shortName || organization.name}</button>)}
      </div>
      <div className="relation-picker-heading"><span><UserRound size={16} />关联联系人</span><small>选择组织后优先显示相关人脉 · 已选 {contactIds.length}</small></div>
      <div className="relation-choice-list contact-choices">
        {sortedContacts.map((contact) => {
          const suggested = Boolean(contact.primaryOrganizationId && selectedOrgSet.has(contact.primaryOrganizationId))
          return <button className={contactIds.includes(String(contact.id)) ? 'is-selected' : ''} type="button" key={contact.id} onClick={() => toggleContact(contact)}><i />{contact.fullName}{suggested ? <em>关联</em> : null}</button>
        })}
      </div>
      {!organizations.length && !contacts.length ? <p className="relation-empty">请先在甲方组织库或人脉库中建立主数据。</p> : null}
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
}: {
  visit: Visit | null
  onClose: () => void
  onCreateTask: () => void
}) {
  if (!visit) return null
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-label="拜访详情" onMouseDown={(event) => event.stopPropagation()}>
        <header className="drawer-header">
          <div><span>拜访详情</span><StatusTag label={visit.status} /></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button>
        </header>
        <div className="drawer-body">
          <section className="customer-identity">
            <InitialAvatar text={visit.shortName} color={visit.color} size="large" />
            <div><h2>{visit.customer}</h2><p>{visit.contact} · {visit.phone}</p></div>
            <button className="icon-button call-button" type="button" aria-label="拨打电话"><Phone size={18} /></button>
          </section>
          <section className="mobile-detail-actions" aria-label="快捷操作">
            <button type="button"><Phone size={17} /><span>联系客户</span></button>
            <button type="button"><Navigation size={17} /><span>地图导航</span></button>
            <button type="button" onClick={onCreateTask}><ListTodo size={17} /><span>生成待办</span></button>
          </section>
          <section className="detail-info-grid">
            <DetailItem icon={<Clock3 />} label="拜访时间" value={`${visit.date} ${visit.time}${visit.endTime ? ` — ${visit.endTime}` : ''}`} />
            <DetailItem icon={<MapPin />} label="地点" value={visit.location} />
            <DetailItem icon={<UserRound />} label="负责人" value={visit.owner} />
            <DetailItem icon={<UsersRound />} label="参与人" value={visit.participants.join('、')} />
          </section>
          <section className="detail-section"><h3><FileText size={17} />拜访事项</h3><p>{visit.matter}</p></section>
          <section className="detail-section result-section"><h3><CheckCircle2 size={17} />跟进结果</h3><p>{visit.result}</p></section>
          <section className="detail-section">
            <h3><ListTodo size={17} />后续行动</h3>
            <div className="linked-task"><span><CheckCircle2 size={16} /></span><div><strong>提交项目排期及正式报价</strong><small>张伟 · 今天 17:30 前</small></div><StatusTag label="进行中" /></div>
            <button className="add-linked-task" type="button" onClick={onCreateTask}><Plus size={16} /> 添加后续待办</button>
          </section>
          <section className="detail-section">
            <h3><Clock3 size={17} />记录时间线</h3>
            <div className="record-timeline">
              <span><i /><strong>完成拜访记录</strong><small>今天 {visit.endTime || visit.time} · {visit.owner}</small></span>
              <span><i /><strong>到达拜访地点</strong><small>今天 {visit.time} · 定位签到</small></span>
              <span><i /><strong>创建拜访计划</strong><small>9月2日 16:20 · {visit.owner}</small></span>
            </div>
          </section>
        </div>
        <footer className="drawer-footer"><button className="button button-secondary" type="button">编辑记录</button><button className="button button-primary" type="button" onClick={onCreateTask}>生成待办</button></footer>
      </aside>
    </div>
  )
}

function DetailItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="detail-item"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>
}
