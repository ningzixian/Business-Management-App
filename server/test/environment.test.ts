import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { validateEnvironment } from '../src/config/environment'

test('测试环境使用安全的可预测默认值并禁用对象存储', () => {
  const config = validateEnvironment({ NODE_ENV: 'test' })
  assert.equal(config.NODE_ENV, 'test')
  assert.equal(config.MINIO_DISABLED, true)
  assert.equal(config.API_PREFIX, 'api/v1')
  assert.equal(config.SELF_REGISTRATION_ENABLED, true)
})

test('生产环境拒绝空 JWT 密钥', () => {
  assert.throws(
    () => validateEnvironment({ NODE_ENV: 'production', SEED_INITIAL_DATA: 'false', MINIO_DISABLED: 'true' }),
    /JWT_SECRET/,
  )
})

test('生产环境拒绝弱初始管理员密码', () => {
  assert.throws(
    () => validateEnvironment({
      NODE_ENV: 'production',
      JWT_SECRET: 'a-secure-production-secret-with-at-least-32-characters',
      SEED_INITIAL_DATA: 'true',
      INITIAL_ADMIN_PASSWORD: 'short',
      MINIO_DISABLED: 'true',
    }),
    /INITIAL_ADMIN_PASSWORD/,
  )
})

test('生产环境默认关闭自助注册，必须显式开启', () => {
  const config = validateEnvironment({
    NODE_ENV: 'production',
    JWT_SECRET: 'a-secure-production-secret-with-at-least-32-characters',
    SEED_INITIAL_DATA: 'false',
    MINIO_DISABLED: 'true',
  })
  assert.equal(config.SELF_REGISTRATION_ENABLED, false)
  assert.equal(config.REGISTRATION_DEPARTMENT_CODE, 'BUSINESS')
})
