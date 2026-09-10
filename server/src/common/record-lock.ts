import { ConflictException, NotFoundException } from '@nestjs/common'
import type { Request } from 'express'
import type { DatabaseClient } from '../database/database.service'
import type { AuthenticatedUser } from './authenticated-user'

/** Lock and recheck access inside the write transaction, not only before it. */
export async function lockRecord(client: DatabaseClient, table: 'organizations' | 'contacts' | 'business_items', user: AuthenticatedUser, id: string, request?: Request) {
  const result = await client.query<{ revision: string }>(
    `SELECT xmin::text AS revision FROM ${table}
     WHERE id = $1 AND department_id = $2 AND deleted_at IS NULL
     ${table === 'contacts' ? "AND (visibility = 'department' OR owner_user_id = $3 OR $4::boolean)" : ''} FOR UPDATE`,
    table === 'contacts' ? [id, user.departmentId, user.userId, ['admin', 'manager'].includes(user.role)] : [id, user.departmentId],
  )
  if (!result.rowCount) throw new NotFoundException('记录已删除或无权访问，请刷新列表')
  const expected = request?.headers['if-match']
  if (expected && expected !== result.rows[0].revision) throw new ConflictException('记录已被修改，请保留输入并重新打开核对，未覆盖任何修改')
}
