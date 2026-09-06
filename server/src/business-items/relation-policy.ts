export interface RelationSelection {
  isInternal: boolean
  organizationIds?: string[]
  contactIds?: string[]
}

export function relationPolicyError(selection: RelationSelection): string | null {
  if (selection.isInternal) return null
  const organizationCount = selection.organizationIds?.length || 0
  const contactCount = selection.contactIds?.length || 0
  return organizationCount + contactCount > 0 ? null : '外部事项必须至少关联一个甲方组织或联系人'
}
