export interface VisitDraft {
  values: Record<string, string>
  organizationIds: string[]
  contactIds: string[]
}
export function draftKey(departmentId: string, userId: string) {
  return `bam-visit-draft-v1:${departmentId}:${userId}`
}
export function readDraft(key: string): VisitDraft | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  const data = JSON.parse(raw)
  if (data.version !== 1 || !data.values || typeof data.values !== 'object' || Array.isArray(data.values)
    || !Object.values(data.values).every(v => typeof v === 'string')
    || !Array.isArray(data.organizationIds) || !data.organizationIds.every((v: unknown) => typeof v === 'string')
    || !Array.isArray(data.contactIds) || !data.contactIds.every((v: unknown) => typeof v === 'string')) throw new Error('草稿损坏或版本不支持，请放弃草稿后重新填写')
  return data
}
export function writeDraft(key: string, draft: VisitDraft) {
  localStorage.setItem(key, JSON.stringify({ ...draft, version: 1, savedAt: new Date().toISOString() }))
}
