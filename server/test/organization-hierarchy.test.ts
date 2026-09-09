import 'reflect-metadata'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { validate } from 'class-validator'
import { OrganizationsService } from '../src/organizations/organizations.service'
import { CreateOrganizationDto, UpdateOrganizationDto } from '../src/organizations/dto/organization.dto'
import type { DatabaseService } from '../src/database/database.service'
import type { AuditService } from '../src/audit/audit.service'
import type { AuthenticatedUser } from '../src/common/authenticated-user'

const user: AuthenticatedUser = { userId: 'u', departmentId: 'd', username: 'test', displayName: 'Test', role: 'member' }
function setup({ cycle = false, children = false, missing = false } = {}) {
  const calls: { sql: string; values?: unknown[] }[] = []
  const client = { query: async (sql: string, values?: unknown[]) => {
    calls.push({ sql, values })
    if (sql.includes('WITH RECURSIVE')) return { rowCount: cycle ? 1 : 0, rows: [] }
    if (sql.includes('WHERE parent_organization_id')) return { rowCount: children ? 1 : 0, rows: [] }
    if (sql.startsWith('SELECT id FROM organizations')) return { rowCount: missing ? 0 : 1, rows: [] }
    return { rowCount: 1, rows: [{ id: 'new' }] }
  } }
  const database = { transaction: async (work: (arg: typeof client) => unknown) => work(client) } as unknown as DatabaseService
  const service = new OrganizationsService(database, { log: async () => undefined } as unknown as AuditService)
  service.get = async () => ({}) as Awaited<ReturnType<OrganizationsService['get']>>
  return { service, calls }
}
test('组织类型接受部门，修改上级允许明确清空', async () => {
  assert.equal((await validate(Object.assign(new CreateOrganizationDto(), { name: '商务部门', organizationType: 'department' }))).length, 0)
  assert.equal((await validate(Object.assign(new UpdateOrganizationDto(), { parentOrganizationId: null }))).length, 0)
  assert.ok((await validate(Object.assign(new UpdateOrganizationDto(), { parentOrganizationId: 'bad-id' }))).length)
})
test('拒绝自己作为上级', async () => {
  await assert.rejects(setup().service.update(user, 'a', { parentOrganizationId: 'a' }), /自己/)
})
test('拒绝下级作为上级形成循环', async () => {
  const { service, calls } = setup({ cycle: true })
  await assert.rejects(service.update(user, 'a', { parentOrganizationId: 'b' }), /循环/)
  assert.equal(calls.some((call) => call.sql.startsWith('UPDATE organizations')), false)
})
test('清空上级写入 NULL，层级修改先取得事务锁', async () => {
  const { service, calls } = setup()
  await service.update(user, 'a', { parentOrganizationId: null })
  assert.match(calls[0].sql, /pg_advisory_xact_lock/)
  assert.equal(calls.find((call) => call.sql.startsWith('UPDATE organizations'))?.values?.[0], null)
})
test('存在下级时禁止删除父组织', async () => {
  await assert.rejects(setup({ children: true }).service.remove(user, 'a'), /下级组织/)
})
test('不存在或不属于当前部门的上级被拒绝', async () => {
  await assert.rejects(setup({ missing: true }).service.create(user, Object.assign(new CreateOrganizationDto(), { name: '测试部门', parentOrganizationId: 'foreign' })), /不存在或不可用/)
})
