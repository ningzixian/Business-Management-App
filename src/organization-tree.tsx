import { useState } from 'react'
import type { Customer } from './types'

export const organizationTypeLabels: Record<string, string> = { company: '公司', subsidiary: '子公司', department: '部门', government: '政府机关', institution: '事业单位', other: '其他' }

export function organizationPath(org: Customer, organizations: Customer[]): string {
  const names = [org.name]
  const seen = new Set([String(org.id)])
  let parent = org.parentOrganizationId
  while (parent && !seen.has(String(parent))) {
    seen.add(String(parent))
    const node = organizations.find((item) => String(item.id) === String(parent))
    if (!node) { names.unshift(org.parentOrganizationName || '未加载的上级'); break }
    names.unshift(node.name)
    parent = node.parentOrganizationId
  }
  return names.join(' / ')
}

export type HierarchyUpdate = (id: string, parentId: string | null) => Promise<void>

export function OrganizationTree({ organizations, onUpdate }: { organizations: Customer[]; onUpdate?: HierarchyUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [parentId, setParentId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const isDescendant = (candidate: Customer, id: string) => {
    const seen = new Set<string>()
    let current: Customer | undefined = candidate
    while (current && !seen.has(String(current.id))) {
      if (String(current.id) === id) return true
      seen.add(String(current.id))
      current = organizations.find((org) => String(org.id) === String(current?.parentOrganizationId))
    }
    return false
  }
  async function save() {
    if (!editing || !onUpdate) return
    setSaving(true); setError('')
    try { await onUpdate(String(editing.id), parentId || null); setEditing(null) }
    catch (reason) { setError(reason instanceof Error ? reason.message : '调整失败') }
    finally { setSaving(false) }
  }
  const renderNode = (node: Customer, seen: Set<string>): React.ReactNode => {
    if (seen.has(String(node.id))) return null
    const next = new Set(seen).add(String(node.id))
    const children = organizations.filter((org) => String(org.parentOrganizationId) === String(node.id))
    return <li key={node.id}><span><strong>{node.name}</strong><small>{organizationTypeLabels[node.organizationType || 'company'] || '组织'}</small>{onUpdate && <button type="button" onClick={() => { setEditing(node); setParentId(node.parentOrganizationId || ''); setError('') }} aria-label={`调整${node.name}的上级`}>调整上级</button>}</span>{children.length > 0 && <ul>{children.map((child) => renderNode(child, next))}</ul>}</li>
  }
  const roots = organizations.filter((org) => !org.parentOrganizationId || !organizations.some((parent) => String(parent.id) === String(org.parentOrganizationId)))
  return <section className="organization-tree"><button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>组织架构 · {organizations.length} 个组织 <span>{expanded ? '收起' : '展开'}</span></button>{expanded && <><p>公司与部门按上级关系展示；人脉和事项可直接关联任一层级。</p><ul>{roots.map((root) => renderNode(root, new Set()))}</ul>{organizations.length === 0 && <p>暂无组织，请先添加一级组织。</p>}</>}{editing && <div className="hierarchy-editor"><strong>调整上级：{editing.name}</strong><label className="field"><span>新的上级组织</span><select value={parentId} onChange={(event) => setParentId(event.target.value)} disabled={saving}><option value="">无上级（一级组织）</option>{organizations.filter((org) => !isDescendant(org, String(editing.id))).map((org) => <option value={org.id} key={org.id}>{organizationPath(org, organizations)}</option>)}</select></label><p>下级组织会随当前组织一起移动，已有的人脉和事项关联保持不变。</p>{error && <p role="alert">{error}</p>}<button type="button" className="button button-secondary" disabled={saving} onClick={() => setEditing(null)}>取消调整</button><button type="button" className="button button-primary" disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '保存层级'}</button></div>}</section>
}
