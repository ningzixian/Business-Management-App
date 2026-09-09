// Only pass trusted SQL aliases and parameter positions, never request input.
export function contactVisibilitySql(alias: string, department: number, owner: number, elevated: number) {
  return `${alias}.department_id = $${department} AND ${alias}.deleted_at IS NULL AND (${alias}.visibility = 'department' OR ${alias}.owner_user_id = $${owner} OR $${elevated}::boolean = TRUE)`
}

export function visibleRelationSnapshot<T extends Record<string, unknown>>(row: T) {
  const snapshots = (value: unknown) => Array.isArray(value)
    ? value.map((item: { snapshot?: unknown }) => item.snapshot).filter(Boolean) : []
  // Never serialize the unfiltered historical contact snapshot. Authorization is
  // evaluated against the live contact, including deletion and ownership changes.
  return { ...row, relationSnapshot: { organizations: snapshots(row.organizations), contacts: snapshots(row.contacts) } }
}
