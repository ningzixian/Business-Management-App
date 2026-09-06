import { Controller, Get, Query } from '@nestjs/common'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'
import type { AuthenticatedUser } from '../common/authenticated-user'
import { CurrentUser } from '../common/current-user.decorator'
import { Roles } from '../common/roles.decorator'
import { DatabaseService } from '../database/database.service'

class AuditQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50
}

@Controller('audit-logs')
@Roles('admin', 'manager')
export class AuditController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: AuditQueryDto) {
    const result = await this.database.query(
      `SELECT a.id, a.action, a.entity_type AS "entityType", a.entity_id AS "entityId",
              a.changes, a.ip_address::text AS "ipAddress", a.created_at AS "createdAt",
              u.display_name AS "actorName"
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.department_id = $1
       ORDER BY a.created_at DESC
       LIMIT $2`,
      [user.departmentId, query.limit],
    )
    return { items: result.rows }
  }
}
