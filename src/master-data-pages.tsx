import { RecordAction } from './record-maintenance'
import { WriteButton } from './write-access'
import { useMemo, useState } from 'react'
import { Building2, ChevronRight, MapPin, Phone, Plus, Search, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import type { Contact } from './types'
import { Card, InitialAvatar, PageHeader, PreviewDialog } from './ui'
import { PhoneAction } from './mobile-actions'

const levelLabels: Record<Contact['relationshipLevel'], string> = { key: '核心人脉', important: '重要人脉', normal: '一般联系', new: '新联系人' }
const statusLabels: Record<Contact['status'], string> = { provisional: '待完善', active: '有效', inactive: '已停用' }

export function ContactsPage({ contacts, onCreate }: { contacts: Contact[]; onCreate: () => void }) {
  const [query, setQuery] = useState('')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const filtered = useMemo(() => contacts.filter((contact) => `${contact.fullName}${contact.mobile}${contact.primaryOrganizationName || ''}${contact.primaryTitle || ''}`.toLowerCase().includes(query.trim().toLowerCase())), [contacts, query])
  const linkedCount = contacts.filter((contact) => contact.affiliationCount > 0).length
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="独立主数据"
        title="人脉"
        description="独立维护联系人档案，通过任职关系连接一个或多个甲方组织。"
        actions={<WriteButton className="button button-primary" type="button" onClick={onCreate}><Plus size={18} /> 添加联系人</WriteButton>}
      />
      <section className="master-summary-grid">
        <Card><span><UsersRound /></span><p><small>人脉总数</small><strong>{contacts.length}</strong></p></Card>
        <Card><span><Building2 /></span><p><small>已关联组织</small><strong>{linkedCount}</strong></p></Card>
        <Card><span><ShieldCheck /></span><p><small>待完善档案</small><strong>{contacts.filter((item) => item.status === 'provisional').length}</strong></p></Card>
      </section>
      <label className="master-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、电话、组织或职务" type="search" /></label>
      <Card className="table-card contact-library-card">
        <div className="data-table contact-library-table">
          <div className="table-row table-head"><span>联系人</span><span>主要任职组织</span><span>职务</span><span>关系等级</span><span>关联事项</span><span>负责人</span><span /></div>
          {filtered.map((contact) => (
            <button className="table-row contact-library-row" type="button" key={contact.id} onClick={() => setSelectedContact(contact)}>
              <span className="contact-person-cell"><InitialAvatar text={contact.fullName} color="#2f6fbe" /><span><strong>{contact.fullName}</strong><small><Phone size={12} />{contact.mobile}</small></span></span>
              <span><strong>{contact.primaryOrganizationName || '尚未关联组织'}</strong><small>{contact.affiliationCount > 1 ? `另有 ${contact.affiliationCount - 1} 项任职` : '独立人脉档案'}</small></span>
              <span>{contact.primaryTitle || '待补充'}</span>
              <span><b className={`relation-level level-${contact.relationshipLevel}`}>{levelLabels[contact.relationshipLevel]}</b><small>{statusLabels[contact.status]}</small></span>
              <span>{contact.itemCount} 项</span><span>{contact.ownerName}</span><span><ChevronRight size={18} /></span>
            </button>
          ))}
        </div>
        {filtered.length === 0 ? <div className="master-empty"><Search /><strong>没有找到联系人</strong><span>请更换关键词，或新增一条人脉档案。</span></div> : null}
      </Card>
      {selectedContact ? <PreviewDialog title={selectedContact.fullName} eyebrow="人脉档案详情" onClose={() => setSelectedContact(null)}><RecordAction kind="contacts" id={selectedContact.id} onDone={() => setSelectedContact(null)} /><div className="preview-detail-grid"><div><small>手机号码</small><strong>{selectedContact.mobile}</strong></div><div><small>主要组织</small><strong>{selectedContact.primaryOrganizationName || '尚未关联'}</strong></div><div><small>主要职务</small><strong>{selectedContact.primaryTitle || '待补充'}</strong></div><div><small>任职关系</small><strong>{selectedContact.affiliationCount} 项</strong></div><div><small>关系等级</small><strong>{levelLabels[selectedContact.relationshipLevel]}</strong></div><div><small>档案状态</small><strong>{statusLabels[selectedContact.status]}</strong></div><div><small>负责人</small><strong>{selectedContact.ownerName}</strong></div><div><small>关联事项</small><strong>{selectedContact.itemCount} 项</strong></div></div></PreviewDialog> : null}
    </div>
  )
}

export function MobileContactsPage({ contacts, onCreate, onCreateVisit }: { contacts: Contact[]; onCreate: () => void; onCreateVisit: () => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'全部' | '核心' | '待完善'>('全部')
  const filtered = contacts.filter((contact) => {
    const queryMatches = `${contact.fullName}${contact.mobile}${contact.primaryOrganizationName || ''}`.toLowerCase().includes(query.trim().toLowerCase())
    const filterMatches = filter === '全部' || (filter === '核心' && contact.relationshipLevel === 'key') || (filter === '待完善' && contact.status === 'provisional')
    return queryMatches && filterMatches
  })
  return (
    <div className="mobile-page mobile-contacts-page">
      <header className="mobile-master-heading"><span>独立主数据 · {contacts.length} 人</span><div><h1>人脉</h1><WriteButton type="button" onClick={onCreate}><Plus size={20} /></WriteButton></div><p>联系人可同时任职于多个甲方组织。</p></header>
      <label className="mobile-search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="搜索姓名、组织或电话" /></label>
      <div className="mobile-filter-chips">{(['全部', '核心', '待完善'] as const).map((item) => <button className={filter === item ? 'is-active' : ''} type="button" key={item} onClick={() => setFilter(item)}>{item}</button>)}</div>
      <section className="mobile-contact-library-list">
        {filtered.map((contact) => (
          <article className="mobile-contact-person-card" key={contact.id}>
            <header><InitialAvatar text={contact.fullName} color="#2f6fbe" /><span><strong>{contact.fullName}</strong><small>{contact.primaryTitle || '职务待补充'}</small></span><b className={`relation-level level-${contact.relationshipLevel}`}>{levelLabels[contact.relationshipLevel]}</b></header>
            <div className="mobile-person-affiliation"><Building2 size={16} /><span><strong>{contact.primaryOrganizationName || '尚未关联组织'}</strong><small>{contact.affiliationCount ? `${contact.affiliationCount} 项任职关系` : '独立人脉档案'}</small></span><ChevronRight size={17} /></div>
            <div className="mobile-person-meta"><span><Phone size={14} />{contact.mobile}</span>{contact.city ? <span><MapPin size={14} />{contact.city}</span> : null}</div>
            <footer><RecordAction kind="contacts" id={contact.id} label="详情与编辑" /><PhoneAction phone={contact.mobile} /><WriteButton type="button" onClick={onCreateVisit}><UserRound size={16} />发起事项</WriteButton></footer>
          </article>
        ))}
      </section>
    </div>
  )
}
