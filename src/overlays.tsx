import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
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
import type { Customer, Task, Visit } from './types'
import { InitialAvatar, StatusTag } from './ui'

export type CreateKind = 'visit' | 'task' | 'customer'

export function CreateRecordModal({
  open,
  initialKind,
  onClose,
  onAddVisit,
  onAddTask,
  onAddCustomer,
}: {
  open: boolean
  initialKind: CreateKind
  onClose: () => void
  onAddVisit: (visit: Visit) => void
  onAddTask: (task: Task) => void
  onAddCustomer: (customer: Customer) => void
}) {
  const [kind, setKind] = useState<CreateKind>(initialKind)

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
            <span>快速创建</span>
            <h2 id="record-modal-title">新建记录</h2>
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
          <button className={kind === 'customer' ? 'is-active' : ''} type="button" onClick={() => setKind('customer')}>
            <Building2 size={17} /> 客户档案
          </button>
        </div>

        {kind === 'visit' ? <VisitForm onClose={onClose} onAdd={onAddVisit} /> : null}
        {kind === 'task' ? <TaskForm onClose={onClose} onAdd={onAddTask} /> : null}
        {kind === 'customer' ? <CustomerForm onClose={onClose} onAdd={onAddCustomer} /> : null}
      </section>
    </div>
  )
}

function VisitForm({ onClose, onAdd }: { onClose: () => void; onAdd: (visit: Visit) => void }) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const customer = String(values.get('customer') || '未命名客户')
    const dateTime = String(values.get('dateTime') || '2026-09-04T14:00')
    const participants = String(values.get('participants') || '张伟')
      .split(/[、,，]/)
      .map((name) => name.trim())
      .filter(Boolean)
    onAdd({
      id: Date.now(),
      customer,
      shortName: customer.slice(0, 1),
      contact: String(values.get('contact') || '待补充'),
      phone: String(values.get('phone') || '待补充'),
      owner: '张伟',
      participants,
      date: dateTime.slice(0, 10),
      time: dateTime.slice(11, 16),
      endTime: '',
      location: String(values.get('location') || '待补充'),
      region: String(values.get('location') || '待补充'),
      matter: String(values.get('matter') || '待补充拜访事项'),
      result: String(values.get('result') || '待拜访后填写。'),
      status: '待开始',
      color: '#0d6efd',
    })
  }

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field field-wide"><span>客户名称 <b>*</b></span><input name="customer" required placeholder="请输入或选择客户" /></label>
        <label className="field"><span>联系人 <b>*</b></span><input name="contact" required placeholder="客户联系人" /></label>
        <label className="field"><span>联系电话</span><input name="phone" type="tel" placeholder="联系电话" /></label>
        <label className="field"><span>拜访时间 <b>*</b></span><input name="dateTime" type="datetime-local" defaultValue="2026-09-04T14:00" required /></label>
        <label className="field"><span>参与人</span><input name="participants" defaultValue="张伟" placeholder="多人请用顿号分隔" /></label>
        <label className="field field-wide field-with-action">
          <span>地点 <b>*</b></span>
          <span className="input-action-wrap"><input name="location" required placeholder="请输入拜访地点" /><button type="button" aria-label="定位"><Navigation size={17} /></button></span>
        </label>
        <label className="field field-wide"><span>拜访事项 <b>*</b></span><textarea name="matter" required maxLength={300} placeholder="本次拜访需要沟通和确认的具体事项" /></label>
        <label className="field field-wide"><span>跟进结果</span><textarea name="result" maxLength={500} placeholder="可在拜访结束后补充沟通结果和下一步计划" /></label>
      </div>
      <div className="attachment-actions">
        <button type="button"><Camera size={17} /> 添加照片</button>
        <button type="button"><Mic size={17} /> 录音纪要</button>
        <span>支持图片、文档和录音附件</span>
      </div>
      <footer className="modal-footer">
        <button className="button button-secondary" type="button" onClick={onClose}>取消</button>
        <button className="button button-secondary save-draft" type="button">保存草稿</button>
        <button className="button button-primary" type="submit"><CheckCircle2 size={17} /> 保存记录</button>
      </footer>
    </form>
  )
}

function TaskForm({ onClose, onAdd }: { onClose: () => void; onAdd: (task: Task) => void }) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const due = String(values.get('due') || '2026-09-05T17:30')
    onAdd({
      id: Date.now(),
      title: String(values.get('title') || '未命名待办'),
      customer: String(values.get('customer') || '部门内部'),
      assignee: String(values.get('assignee') || '张伟'),
      due: due.slice(0, 10),
      dueLabel: `${due.slice(5, 7)}月${due.slice(8, 10)}日 ${due.slice(11, 16)}`,
      priority: (String(values.get('priority') || '中') as Task['priority']),
      status: '待处理',
      source: '独立待办',
    })
  }

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field field-wide"><span>待办事项 <b>*</b></span><input name="title" required placeholder="请输入需要完成的具体事项" /></label>
        <label className="field"><span>关联客户</span><input name="customer" placeholder="可不关联客户" /></label>
        <label className="field"><span>负责人 <b>*</b></span><input name="assignee" required defaultValue="张伟" /></label>
        <label className="field"><span>截止时间 <b>*</b></span><input name="due" type="datetime-local" required defaultValue="2026-09-05T17:30" /></label>
        <label className="field"><span>优先级</span><select name="priority" defaultValue="中"><option>高</option><option>中</option><option>低</option></select></label>
        <label className="field field-wide"><span>补充说明</span><textarea name="description" placeholder="验收标准、所需材料或协作说明" /></label>
      </div>
      <footer className="modal-footer">
        <button className="button button-secondary" type="button" onClick={onClose}>取消</button>
        <button className="button button-primary" type="submit"><Plus size={17} /> 创建待办</button>
      </footer>
    </form>
  )
}

function CustomerForm({ onClose, onAdd }: { onClose: () => void; onAdd: (customer: Customer) => void }) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const name = String(values.get('name') || '未命名客户')
    onAdd({
      id: Date.now(),
      name,
      shortName: name.slice(0, 1),
      industry: String(values.get('industry') || '其他'),
      contact: String(values.get('contact') || '待补充'),
      phone: String(values.get('phone') || '待补充'),
      region: String(values.get('region') || '待补充'),
      owner: String(values.get('owner') || '张伟'),
      lastVisit: '暂无拜访',
      nextAction: '安排首次沟通',
      openTasks: 0,
      status: '待激活',
      color: '#0d6efd',
    })
  }

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field field-wide"><span>客户名称 <b>*</b></span><input name="name" required placeholder="请输入客户完整名称" /></label>
        <label className="field"><span>所属行业</span><select name="industry" defaultValue="智能制造"><option>智能制造</option><option>商贸零售</option><option>软件信息</option><option>物流供应链</option><option>其他</option></select></label>
        <label className="field"><span>负责人</span><input name="owner" defaultValue="张伟" /></label>
        <label className="field"><span>主要联系人</span><input name="contact" placeholder="姓名或称谓" /></label>
        <label className="field"><span>联系电话</span><input name="phone" type="tel" placeholder="手机或座机" /></label>
        <label className="field field-wide"><span>所在地区</span><input name="region" placeholder="省、市、区及详细地址" /></label>
      </div>
      <footer className="modal-footer">
        <button className="button button-secondary" type="button" onClick={onClose}>取消</button>
        <button className="button button-primary" type="submit"><Plus size={17} /> 添加客户</button>
      </footer>
    </form>
  )
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
