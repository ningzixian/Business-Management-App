import { Controller, Get, Module, Param, ParseUUIDPipe, Put } from '@nestjs/common'
import { CurrentUser } from '../common/current-user.decorator'
import type { AuthenticatedUser } from '../common/authenticated-user'
import { DatabaseService } from '../database/database.service'

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.database.query(
      `SELECT bi.id, bi.title, bi.due_at AS "dueAt", (r.due_at = bi.due_at) IS TRUE AS read
       FROM business_items bi LEFT JOIN notification_reads r ON r.business_item_id = bi.id AND r.user_id = $2
       WHERE bi.department_id = $1 AND bi.deleted_at IS NULL AND bi.item_type = 'task'
         AND bi.status IN ('pending', 'in_progress', 'overdue') AND bi.due_at < now()
       ORDER BY bi.due_at, bi.id`, [user.departmentId, user.userId])
    return { items: result.rows }
  }

  // A readonly user may mark their own reminders read; this does not edit business data.
  @Put('read-all')
  async readAll(@CurrentUser() user: AuthenticatedUser) {
    await this.database.query(
      `INSERT INTO notification_reads (user_id, business_item_id, due_at)
       SELECT $2, id, due_at FROM business_items WHERE department_id = $1
         AND deleted_at IS NULL AND item_type = 'task' AND due_at < now()
         AND status IN ('pending', 'in_progress', 'overdue')
       ON CONFLICT (user_id, business_item_id) DO UPDATE SET due_at = EXCLUDED.due_at, read_at = now()`,
      [user.departmentId, user.userId])
    return { ok: true }
  }

  @Put(':id/read')
  async read(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.database.query(
      `INSERT INTO notification_reads (user_id, business_item_id, due_at)
       SELECT $2, id, due_at FROM business_items WHERE department_id = $1 AND id = $3
         AND deleted_at IS NULL AND item_type = 'task' AND due_at < now()
         AND status IN ('pending', 'in_progress', 'overdue')
       ON CONFLICT (user_id, business_item_id) DO UPDATE SET due_at = EXCLUDED.due_at, read_at = now()`,
      [user.departmentId, user.userId, id])
    return { ok: true }
  }
}

@Module({ controllers: [NotificationsController] })
export class NotificationsModule {}
