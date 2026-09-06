import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordPolicyViolations } from '../src/auth/password-policy'

test('账号密码必须满足长度和四类字符要求', () => {
  assert.equal(PASSWORD_MIN_LENGTH, 12)
  assert.equal(PASSWORD_MAX_LENGTH, 128)
  assert.deepEqual(passwordPolicyViolations('Strong-Password-2026!'), [])
  assert.ok(passwordPolicyViolations('alllowercase').length >= 3)
  assert.ok(passwordPolicyViolations('Aa1!').some((item) => item.includes('至少')))
})

test('过长密码会被密码策略拒绝', () => {
  assert.ok(passwordPolicyViolations(`Aa1!${'x'.repeat(125)}`).some((item) => item.includes('不超过')))
})
