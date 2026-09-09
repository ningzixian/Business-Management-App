import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { contactVisibilitySql, visibleRelationSnapshot } from '../src/common/contact-visibility'

test('可见性条件绑定部门、所有者、管理权限且排除已删除人脉', () => {
  const sql = contactVisibilitySql('c', 2, 3, 4)
  assert.match(sql, /department_id = \$2/)
  assert.match(sql, /deleted_at IS NULL/)
  assert.match(sql, /owner_user_id = \$3/)
  assert.match(sql, /\$4::boolean/)
})
test('事项快照只使用已授权关联，不能回退至原始历史快照', () => {
  const row = visibleRelationSnapshot({ id: 'item', contacts: [], organizations: [], relationSnapshot: { contacts: [{ id: 'secret', mobile: 'private' }] } })
  assert.deepEqual(row.relationSnapshot.contacts, [])
  assert.equal(JSON.stringify(row).includes('secret'), false)
  assert.equal(visibleRelationSnapshot({ contacts: [{ snapshot: { id: 'visible' } }] }).relationSnapshot.contacts.length, 1)
})
