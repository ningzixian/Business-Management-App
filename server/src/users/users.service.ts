import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { hash, compare } from 'bcryptjs'
import type { Request } from 'express'
import { passwordPolicyViolations } from '../auth/password-policy'
import type { AuthenticatedUser, UserRole } from '../common/authenticated-user'
import { paginationMeta } from '../common/pagination.dto'
import { DatabaseService, type DatabaseClient } from '../database/database.service'
import { AuditService } from '../audit/audit.service'
import type { CreateUserDto, ResetUserPasswordDto, UpdateUserDto, UserListQueryDto } from './dto/user.dto'

export interface UserView {
  id: string
  username: string
  displayName: string
  role: UserRole
  status: 'active' | 'disabled'
  lastLoginAt: Date | null
  passwordChangedAt: Date | null
  createdAt: Date
}

interface UserRow extends UserView {
  passwordHash?: string
  total?: number
}

@Injectable()
export class UsersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthenticatedUser, query: UserListQueryDto) {
    const values: unknown[] = [actor.departmentId]
    const filters = ['department_id = $1']
    if (query.q?.trim()) {
      values.push(`%${query.q.trim()}%`)
      filters.push(`(username ILIKE $${values.length} OR display_name ILIKE $${values.length})`)
    }
    if (query.role) {
      values.push(query.role)
      filters.push(`role = $${values.length}`)
    }
    if (query.status) {
      values.push(query.status)
      filters.push(`status = $${values.length}`)
    }
    values.push(query.pageSize, (query.page - 1) * query.pageSize)

    const result = await this.database.query<UserRow>(
      `SELECT id, username, display_name AS "displayName", role, status,
              last_login_at AS "lastLoginAt", password_changed_at AS "passwordChangedAt",
              created_at AS "createdAt", COUNT(*) OVER()::int AS total
       FROM users
       WHERE ${filters.join(' AND ')}
       ORDER BY status = 'active' DESC,
                CASE role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 WHEN 'member' THEN 3 ELSE 4 END,
                display_name, created_at
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    )
    const total = result.rows[0]?.total || 0
    return {
      items: result.rows.map(({ total: _total, ...row }) => row),
      meta: paginationMeta(total, query.page, query.pageSize),
    }
  }

  async create(actor: AuthenticatedUser, dto: CreateUserDto, request: Request): Promise<UserView> {
    this.assertStrongPassword(dto.initialPassword)
    const passwordHash = await hash(dto.initialPassword, 12)
    return this.database.transaction(async (client) => {
      const result = await client.query<UserRow>(
        `INSERT INTO users (department_id, username, display_name, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, display_name AS "displayName", role, status,
                   last_login_at AS "lastLoginAt", password_changed_at AS "passwordChangedAt", created_at AS "createdAt"`,
        [actor.departmentId, dto.username.trim(), dto.displayName.trim(), passwordHash, dto.role],
      )
      const created = result.rows[0]
      await this.audit.log({
        actor,
        action: 'user.create',
        entityType: 'user',
        entityId: created.id,
        changes: { username: created.username, displayName: created.displayName, role: created.role, status: created.status },
        request,
      }, client)
      return created
    })
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateUserDto, request: Request): Promise<UserView> {
    return this.database.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`business-management-users:${actor.departmentId}`])
      const current = await this.getForUpdate(client, actor.departmentId, id)
      const nextRole = dto.role ?? current.role
      const nextStatus = dto.status ?? current.status
      const securityChanged = nextRole !== current.role || nextStatus !== current.status

      if (id === actor.userId && securityChanged) {
        throw new BadRequestException('不能修改当前登录账号自己的角色或状态')
      }
      if (current.role === 'admin' && current.status === 'active' && (nextRole !== 'admin' || nextStatus !== 'active')) {
        await this.ensureAnotherActiveAdmin(client, actor.departmentId, id)
      }

      const result = await client.query<UserRow>(
        `UPDATE users
         SET display_name = COALESCE($3, display_name),
             role = $4,
             status = $5,
             auth_version = auth_version + CASE WHEN $6::boolean THEN 1 ELSE 0 END
         WHERE id = $1 AND department_id = $2
         RETURNING id, username, display_name AS "displayName", role, status,
                   last_login_at AS "lastLoginAt", password_changed_at AS "passwordChangedAt", created_at AS "createdAt"`,
        [id, actor.departmentId, dto.displayName?.trim() || null, nextRole, nextStatus, securityChanged],
      )
      const updated = result.rows[0]
      if (securityChanged) {
        await client.query('UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1', [id])
      }
      await this.audit.log({
        actor,
        action: 'user.update',
        entityType: 'user',
        entityId: id,
        changes: {
          before: { displayName: current.displayName, role: current.role, status: current.status },
          after: { displayName: updated.displayName, role: updated.role, status: updated.status },
        },
        request,
      }, client)
      return updated
    })
  }

  async resetPassword(actor: AuthenticatedUser, id: string, dto: ResetUserPasswordDto, request: Request) {
    if (id === actor.userId) throw new BadRequestException('请使用“修改我的密码”功能更新当前账号密码')
    this.assertStrongPassword(dto.newPassword)
    const passwordHash = await hash(dto.newPassword, 12)

    return this.database.transaction(async (client) => {
      const current = await this.getForUpdate(client, actor.departmentId, id)
      if (current.passwordHash && await compare(dto.newPassword, current.passwordHash)) {
        throw new BadRequestException('新密码不能与原密码相同')
      }
      await client.query(
        `UPDATE users
         SET password_hash = $3, password_changed_at = NOW(), auth_version = auth_version + 1
         WHERE id = $1 AND department_id = $2`,
        [id, actor.departmentId, passwordHash],
      )
      await client.query('UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1', [id])
      await this.audit.log({
        actor,
        action: 'user.password_reset',
        entityType: 'user',
        entityId: id,
        changes: { passwordReset: true },
        request,
      }, client)
      return { success: true }
    })
  }

  private async getForUpdate(client: DatabaseClient, departmentId: string, id: string) {
    const result = await client.query<UserRow>(
      `SELECT id, username, display_name AS "displayName", password_hash AS "passwordHash", role, status,
              last_login_at AS "lastLoginAt", password_changed_at AS "passwordChangedAt", created_at AS "createdAt"
       FROM users WHERE id = $1 AND department_id = $2 FOR UPDATE`,
      [id, departmentId],
    )
    if (!result.rows[0]) throw new NotFoundException('用户不存在')
    return result.rows[0]
  }

  private async ensureAnotherActiveAdmin(client: DatabaseClient, departmentId: string, excludedId: string) {
    const result = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM users
       WHERE department_id = $1 AND role = 'admin' AND status = 'active' AND id <> $2`,
      [departmentId, excludedId],
    )
    if (!result.rows[0]?.count) throw new BadRequestException('部门必须至少保留一个启用的系统管理员')
  }

  private assertStrongPassword(password: string) {
    const violations = passwordPolicyViolations(password)
    if (violations.length) throw new BadRequestException(`密码需要${violations.join('、')}`)
  }
}
