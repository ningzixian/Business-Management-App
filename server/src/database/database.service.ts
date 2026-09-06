import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'
import type { AppEnvironment } from '../config/environment'

export interface DatabaseClient {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name)
  private readonly pool: Pool

  constructor(private readonly config: ConfigService<AppEnvironment, true>) {
    this.pool = new Pool({
      host: config.get('DB_HOST', { infer: true }),
      port: config.get('DB_PORT', { infer: true }),
      database: config.get('DB_NAME', { infer: true }),
      user: config.get('DB_USER', { infer: true }),
      password: config.get('DB_PASSWORD', { infer: true }),
      max: config.get('DB_POOL_MAX', { infer: true }),
      ssl: config.get('DB_SSL', { infer: true }) ? { rejectUnauthorized: true } : undefined,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: 'business-management-api',
    })
  }

  async onModuleInit() {
    await this.waitForDatabase()
    if (this.config.get('AUTO_MIGRATE', { infer: true })) {
      await this.runMigrations()
    }
  }

  async onModuleDestroy() {
    await this.pool.end()
  }

  query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values)
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await work(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async ping() {
    const result = await this.pool.query<{ now: Date }>('SELECT NOW() AS now')
    return result.rows[0].now
  }

  private async waitForDatabase() {
    let lastError: unknown
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      try {
        await this.pool.query('SELECT 1')
        this.logger.log('数据库连接成功')
        return
      } catch (error) {
        lastError = error
        this.logger.warn(`数据库尚未就绪（${attempt}/20）`)
        await new Promise((resolve) => setTimeout(resolve, Math.min(attempt * 500, 3_000)))
      }
    }
    throw lastError
  }

  private async runMigrations() {
    await this.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock($1)', [2026090402])
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version VARCHAR(100) PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)

      const migrationDirectory = join(process.cwd(), 'migrations')
      const migrationFiles = (await readdir(migrationDirectory))
        .filter((file) => file.endsWith('.sql'))
        .sort()

      const applied = await client.query<{ version: string }>('SELECT version FROM schema_migrations')
      const appliedVersions = new Set(applied.rows.map((row) => row.version))

      for (const file of migrationFiles) {
        if (appliedVersions.has(file)) continue
        const sql = await readFile(join(migrationDirectory, file), 'utf8')
        this.logger.log(`执行数据库迁移：${file}`)
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [file])
      }
    })
  }
}
