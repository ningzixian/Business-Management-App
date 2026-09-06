import { strict as assert } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

test('v0.2.0 迁移保持双库独立和多对多关联契约', async () => {
  const migration = await readFile(join(process.cwd(), 'migrations', '001_v0.2.0_core.sql'), 'utf8')
  for (const table of [
    'organizations',
    'contacts',
    'contact_affiliations',
    'business_item_organizations',
    'business_item_contacts',
    'audit_logs',
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table}\\b`))
  }
  assert.match(migration, /DEFERRABLE INITIALLY DEFERRED/)
  assert.match(migration, /外部事项必须至少关联一个甲方组织或联系人/)
})

test('种子事项状态参数在写入和完成判断中使用一致类型', async () => {
  const seedSource = await readFile(join(process.cwd(), 'src', 'bootstrap-data.service.ts'), 'utf8')
  assert.match(seedSource, /\$9::varchar[\s\S]*CASE WHEN \$9::varchar = 'completed'/)
  assert.match(seedSource, /\$5::varchar[\s\S]*CASE WHEN \$5::varchar = 'completed'/)
})

test('账号安全迁移支持旧令牌即时失效和密码变更时间', async () => {
  const migration = await readFile(join(process.cwd(), 'migrations', '002_v0.2.0_account_security.sql'), 'utf8')
  assert.match(migration, /ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 1/)
  assert.match(migration, /ADD COLUMN password_changed_at TIMESTAMPTZ/)
})
