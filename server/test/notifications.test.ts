import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { NotificationsController } from '../src/notifications/notifications.controller'
import type { DatabaseService } from '../src/database/database.service'
import type { AuthenticatedUser } from '../src/common/authenticated-user'

const user: AuthenticatedUser = { userId: 'user-a', departmentId: 'dept-a', username: 'a', displayName: 'A', role: 'readonly' }
test('通知查询绑定当前部门和账号，排除完成、取消、未到期和删除事项', async () => {
  const controller = new NotificationsController({ query: async (sql: string, values: unknown[]) => {
    assert.deepEqual(values, ['dept-a', 'user-a'])
    for (const condition of ['bi.department_id = $1', 'r.user_id = $2', 'bi.deleted_at IS NULL', "bi.item_type = 'task'", 'bi.due_at < now()', '(r.due_at = bi.due_at) IS TRUE']) assert.ok(sql.includes(condition))
    assert.ok(!sql.includes("'completed'")); assert.ok(!sql.includes("'cancelled'"))
    return { rows: [{ id: 'task', read: false }] }
  } } as unknown as DatabaseService)
  assert.deepEqual(await controller.list(user), { items: [{ id: 'task', read: false }] })
})
test('单条已读使用当前用户与部门，不接受外部用户 ID', async () => {
  const controller = new NotificationsController({ query: async (sql: string, values: unknown[]) => {
    assert.deepEqual(values, ['dept-a', 'user-a', 'task-a'])
    assert.ok(sql.includes('department_id = $1 AND id = $3'))
    assert.ok(sql.includes('ON CONFLICT (user_id, business_item_id)'))
  } } as unknown as DatabaseService)
  assert.deepEqual(await controller.read(user, 'task-a'), { ok: true })
})
test('全部已读是一次数据库操作，写入失败不声称成功', async () => {
  let calls = 0
  const controller = new NotificationsController({ query: async (_sql: string, values: unknown[]) => {
    calls++; assert.deepEqual(values, ['dept-a', 'user-a']); throw Error('database unavailable')
  } } as unknown as DatabaseService)
  await assert.rejects(controller.readAll(user), /database unavailable/)
  assert.equal(calls, 1)
})
