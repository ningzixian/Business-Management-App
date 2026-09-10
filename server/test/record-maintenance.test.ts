import 'reflect-metadata'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { Request } from 'express'
import type { DatabaseClient, DatabaseService } from '../src/database/database.service'
import type { AuthenticatedUser } from '../src/common/authenticated-user'
import type { AuditService } from '../src/audit/audit.service'
import { lockRecord } from '../src/common/record-lock'
import { ContactsService } from '../src/contacts/contacts.service'
const user: AuthenticatedUser = { userId: 'u', departmentId: 'd', username: 'test', displayName: 'Test', role: 'member' }
const request = (version: string) => ({ headers: { 'if-match': version } }) as unknown as Request
test('版本锁：冲突及删除均拒绝，匹配版本通过', async () => {
  const client = { query: async () => ({ rowCount: 1, rows: [{ revision: '12' }] }) } as unknown as DatabaseClient
  await assert.rejects(lockRecord(client, 'organizations', user, 'o', request('11')), /已被修改/)
  await lockRecord(client, 'organizations', user, 'o', request('12'))
  await assert.rejects(lockRecord({ query: async () => ({ rowCount: 0, rows: [] }) } as unknown as DatabaseClient, 'contacts', user, 'c'), /已删除/)
})
test('人脉写锁在事务内重新检查部门及私人访问权限', async () => {
  const client = { query: async (sql: string, values: unknown[]) => {
    assert.match(sql, /department_id = \$2/); assert.match(sql, /owner_user_id = \$3/); assert.match(sql, /FOR UPDATE/)
    assert.deepEqual(values, ['c','d','u',false]); return { rowCount: 1, rows: [{ revision:'1' }] }
  } } as unknown as DatabaseClient
  await lockRecord(client, 'contacts', user, 'c')
})
function contactService() {
  const calls: { sql: string; values?: unknown[] }[] = []
  const client = { query: async (sql: string, values?: unknown[]) => {
    calls.push({ sql, values })
    return { rowCount: 1, rows: [{ id:'a',revision:'1',organizationId:'o',status:'current',isPrimary:true,startDate:'2026-01-01',endDate:null }] }
  } }
  const service = new ContactsService({ transaction: async (work: (db: typeof client) => unknown) => work(client) } as unknown as DatabaseService, { log: async () => undefined } as unknown as AuditService)
  service.get = async () => ({}) as Awaited<ReturnType<ContactsService['get']>>
  return { service, calls }
}
test('历史任职自动取消主要标记，任职写入先锁人脉并推进版本', async () => {
  const { service, calls } = contactService()
  await service.updateAffiliation(user,'c','a',{status:'historical',isPrimary:true})
  assert.match(calls[0].sql,/FOR UPDATE/)
  assert.match(calls[1].sql,/UPDATE contacts/)
  const update=calls.find(row=>row.sql.includes('UPDATE contact_affiliations\n'))!
  assert.ok(update.values?.includes(false))
})
test('任职无效日期、逆序日期被拒绝，不修改任职记录', async () => {
  for (const body of [{startDate:'2026-02-30'},{endDate:'2025-01-01'},{startDate:'garbage'}]) {
    const { service,calls }=contactService()
    await assert.rejects(service.updateAffiliation(user,'c','a',body),/日期/)
    assert.equal(calls.some(row=>row.sql.startsWith('UPDATE contact_affiliations')),false)
  }
})
