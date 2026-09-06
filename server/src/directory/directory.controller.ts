import { Controller, Get } from '@nestjs/common'
import type { AuthenticatedUser } from '../common/authenticated-user'
import { CurrentUser } from '../common/current-user.decorator'
import { DatabaseService } from '../database/database.service'

@Controller('directory')
export class DirectoryController {
  constructor(private readonly database: DatabaseService) {}

  @Get('users')
  async users(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.database.query(
      `SELECT id, username, display_name AS "displayName", role
       FROM users WHERE department_id = $1 AND status = 'active' ORDER BY display_name`,
      [user.departmentId],
    )
    return { items: result.rows }
  }
}
