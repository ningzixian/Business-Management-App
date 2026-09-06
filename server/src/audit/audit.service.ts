import { Injectable } from '@nestjs/common'
import type { Request } from 'express'
import type { AuthenticatedUser } from '../common/authenticated-user'
import { DatabaseService, type DatabaseClient } from '../database/database.service'

export interface AuditEntry {
  actor?: AuthenticatedUser
  action: string
  entityType: string
  entityId?: string
  changes?: Record<string, unknown>
  request?: Request
}

@Injectable()
export class AuditService {
  constructor(private readonly database: DatabaseService) {}

  async log(entry: AuditEntry, client: DatabaseClient = this.database) {
    const forwarded = entry.request?.headers['x-forwarded-for']
    const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()
    const ipAddress = forwardedIp || entry.request?.ip || null

    await client.query(
      `INSERT INTO audit_logs
        (department_id, user_id, action, entity_type, entity_id, changes, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [
        entry.actor?.departmentId || null,
        entry.actor?.userId || null,
        entry.action,
        entry.entityType,
        entry.entityId || null,
        JSON.stringify(entry.changes || {}),
        ipAddress,
        entry.request?.headers['user-agent']?.slice(0, 500) || null,
      ],
    )
  }
}
