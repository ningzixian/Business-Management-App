export interface AppEnvironment {
  NODE_ENV: 'development' | 'test' | 'production'
  PORT: number
  API_PREFIX: string
  CORS_ORIGINS: string
  DB_HOST: string
  DB_PORT: number
  DB_NAME: string
  DB_USER: string
  DB_PASSWORD: string
  DB_SSL: boolean
  DB_POOL_MAX: number
  AUTO_MIGRATE: boolean
  SEED_INITIAL_DATA: boolean
  INITIAL_ADMIN_USERNAME: string
  INITIAL_ADMIN_PASSWORD: string
  SELF_REGISTRATION_ENABLED: boolean
  REGISTRATION_DEPARTMENT_CODE: string
  JWT_SECRET: string
  JWT_ACCESS_TTL_SECONDS: number
  JWT_REFRESH_TTL_DAYS: number
  MINIO_DISABLED: boolean
  MINIO_ENDPOINT: string
  MINIO_PORT: number
  MINIO_USE_SSL: boolean
  MINIO_ACCESS_KEY: string
  MINIO_SECRET_KEY: string
  MINIO_BUCKET: string
  MAX_UPLOAD_BYTES: number
}

function booleanValue(value: unknown, fallback: boolean) {
  if (value === undefined || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

function numberValue(value: unknown, fallback: number, name: string) {
  const parsed = Number(value ?? fallback)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} 必须是正数`)
  }
  return parsed
}

export function validateEnvironment(raw: Record<string, unknown>): AppEnvironment {
  const nodeEnv = String(raw.NODE_ENV || 'development') as AppEnvironment['NODE_ENV']
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV 仅支持 development、test 或 production')
  }

  const production = nodeEnv === 'production'
  const jwtSecret = String(raw.JWT_SECRET || (production ? '' : 'development-only-secret-change-before-production'))
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET 至少需要 32 个字符')
  }

  const seedInitialData = booleanValue(raw.SEED_INITIAL_DATA, !production)
  const initialPassword = String(raw.INITIAL_ADMIN_PASSWORD || (production ? '' : 'ChangeMe-v0.2.0!'))
  if (seedInitialData && initialPassword.length < 12) {
    throw new Error('启用初始数据时，INITIAL_ADMIN_PASSWORD 至少需要 12 个字符')
  }

  const minioDisabled = booleanValue(raw.MINIO_DISABLED, nodeEnv === 'test')
  const minioAccessKey = String(raw.MINIO_ACCESS_KEY || (production ? '' : 'businessadmin'))
  const minioSecretKey = String(raw.MINIO_SECRET_KEY || (production ? '' : 'business-storage-development-key'))
  if (!minioDisabled && (!minioAccessKey || minioSecretKey.length < 12)) {
    throw new Error('启用附件存储时必须提供有效的 MINIO_ACCESS_KEY 和 MINIO_SECRET_KEY')
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: numberValue(raw.PORT, 3000, 'PORT'),
    API_PREFIX: String(raw.API_PREFIX || 'api/v1').replace(/^\/+|\/+$/g, ''),
    CORS_ORIGINS: String(raw.CORS_ORIGINS || 'http://localhost:5173,capacitor://localhost,http://localhost,https://localhost'),
    DB_HOST: String(raw.DB_HOST || '127.0.0.1'),
    DB_PORT: numberValue(raw.DB_PORT, 5432, 'DB_PORT'),
    DB_NAME: String(raw.DB_NAME || 'business_management'),
    DB_USER: String(raw.DB_USER || 'business_app'),
    DB_PASSWORD: String(raw.DB_PASSWORD || 'business_dev_password'),
    DB_SSL: booleanValue(raw.DB_SSL, false),
    DB_POOL_MAX: numberValue(raw.DB_POOL_MAX, 10, 'DB_POOL_MAX'),
    AUTO_MIGRATE: booleanValue(raw.AUTO_MIGRATE, true),
    SEED_INITIAL_DATA: seedInitialData,
    INITIAL_ADMIN_USERNAME: String(raw.INITIAL_ADMIN_USERNAME || 'admin'),
    INITIAL_ADMIN_PASSWORD: initialPassword,
    SELF_REGISTRATION_ENABLED: booleanValue(raw.SELF_REGISTRATION_ENABLED, !production),
    REGISTRATION_DEPARTMENT_CODE: String(raw.REGISTRATION_DEPARTMENT_CODE || 'BUSINESS'),
    JWT_SECRET: jwtSecret,
    JWT_ACCESS_TTL_SECONDS: numberValue(raw.JWT_ACCESS_TTL_SECONDS, 900, 'JWT_ACCESS_TTL_SECONDS'),
    JWT_REFRESH_TTL_DAYS: numberValue(raw.JWT_REFRESH_TTL_DAYS, 30, 'JWT_REFRESH_TTL_DAYS'),
    MINIO_DISABLED: minioDisabled,
    MINIO_ENDPOINT: String(raw.MINIO_ENDPOINT || '127.0.0.1'),
    MINIO_PORT: numberValue(raw.MINIO_PORT, 9000, 'MINIO_PORT'),
    MINIO_USE_SSL: booleanValue(raw.MINIO_USE_SSL, false),
    MINIO_ACCESS_KEY: minioAccessKey,
    MINIO_SECRET_KEY: minioSecretKey,
    MINIO_BUCKET: String(raw.MINIO_BUCKET || 'business-attachments'),
    MAX_UPLOAD_BYTES: numberValue(raw.MAX_UPLOAD_BYTES, 20 * 1024 * 1024, 'MAX_UPLOAD_BYTES'),
  }
}
