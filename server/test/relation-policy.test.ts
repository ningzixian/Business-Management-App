import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { relationPolicyError } from '../src/business-items/relation-policy'

test('外部事项至少需要组织或联系人之一', () => {
  assert.equal(relationPolicyError({ isInternal: false, organizationIds: [], contactIds: [] }), '外部事项必须至少关联一个甲方组织或联系人')
  assert.equal(relationPolicyError({ isInternal: false, organizationIds: ['org-1'], contactIds: [] }), null)
  assert.equal(relationPolicyError({ isInternal: false, organizationIds: [], contactIds: ['contact-1'] }), null)
})

test('部门内部事项允许不关联外部主数据', () => {
  assert.equal(relationPolicyError({ isInternal: true, organizationIds: [], contactIds: [] }), null)
})
