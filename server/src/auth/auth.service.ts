import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { compare, hash } from 'bcryptjs'
import type { Request } from 'express'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { AppEnvironment } from '../config/environment'
import type { AuthenticatedUser, UserRole } from '../common/authenticated-user'
import { DatabaseService, type DatabaseClient } from '../database/database.service'
import { AuditService } from '../audit/audit.service'
import { passwordPolicyViolations } from './password-policy'

interface UserRow {
  id: string
  departmentId: string
  username: string
  displayName: string
  passwordHash: string
  role: UserRole
  status: string
  authVersion: number
}

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly audit: AuditService,
  ) {}

  async login(username: string, password: string, clientLabel: string) {
    const result = await this.database.query<UserRow>(
      `SELECT id, department_id AS "departmentId", username, display_name AS "displayName",
              password_hash AS "passwordHash", role, status, auth_version AS "authVersion"
       FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [username.trim()],
    )
    const row = result.rows[0]
    if (!row || row.status !== 'active' || !(await compare(password, row.passwordHash))) {
      throw new UnauthorizedException('用户名或密码错误')
    }

    const user = this.toAuthenticatedUser(row)
    const tokens = await this.database.transaction(async (client) => {
      await client.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [row.id])
      const issued = await this.issueTokens(user, row.authVersion, clientLabel, client)
      await this.audit.log({ actor: user, action: 'auth.login', entityType: 'user', entityId: user.userId }, client)
      return issued
    })
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user,
    }
  }

  async register(username: string, displayName: string, password: string, clientLabel: string, request: Request) {
    if (!this.config.get('SELF_REGISTRATION_ENABLED', { infer: true })) {
      throw new ForbiddenException('当前环境未开放自助注册，请联系系统管理员创建账号')
    }
    const violations = passwordPolicyViolations(password)
    if (violations.length) throw new BadRequestException(`密码需要${violations.join('、')}`)
    const passwordHash = await hash(password, 12)

    return this.database.transaction(async (client) => {
      const department = await client.query<{ id: string }>(
        'SELECT id FROM departments WHERE code = $1 AND is_active = TRUE LIMIT 1',
        [this.config.get('REGISTRATION_DEPARTMENT_CODE', { infer: true })],
      )
      if (!department.rows[0]) throw new ForbiddenException('注册所属部门尚未配置，请联系系统管理员')

      const created = await client.query<UserRow>(
        `INSERT INTO users (department_id, username, display_name, password_hash, role)
         VALUES ($1, $2, $3, $4, 'member')
         RETURNING id, department_id AS "departmentId", username, display_name AS "displayName",
                   password_hash AS "passwordHash", role, status, auth_version AS "authVersion"`,
        [department.rows[0].id, username.trim(), displayName.trim(), passwordHash],
      )
      const row = created.rows[0]
      const user = this.toAuthenticatedUser(row)
      const issued = await this.issueTokens(user, row.authVersion, clientLabel, client)
      await this.audit.log({
        actor: user,
        action: 'auth.register',
        entityType: 'user',
        entityId: user.userId,
        changes: { username: user.username, displayName: user.displayName, role: user.role },
        request,
      }, client)
      return {
        accessToken: issued.accessToken,
        refreshToken: issued.refreshToken,
        expiresIn: issued.expiresIn,
        user,
      }
    })
  }

  async refresh(refreshToken: string, clientLabel: string) {
    const tokenHash = this.hashToken(refreshToken)
    return this.database.transaction(async (client) => {
      const result = await client.query<UserRow & { refreshTokenId: string }>(
        `SELECT u.id, u.department_id AS "departmentId", u.username, u.display_name AS "displayName",
                u.password_hash AS "passwordHash", u.role, u.status, u.auth_version AS "authVersion",
                rt.id AS "refreshTokenId"
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > NOW()
         FOR UPDATE`,
        [tokenHash],
      )
      const row = result.rows[0]
      if (!row || row.status !== 'active') throw new UnauthorizedException('刷新凭证已失效')

      const user = this.toAuthenticatedUser(row)
      const issued = await this.issueTokens(user, row.authVersion, clientLabel, client)
      await client.query(
        'UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = $2 WHERE id = $1',
        [row.refreshTokenId, issued.refreshTokenId],
      )
      await this.audit.log({ actor: user, action: 'auth.refresh', entityType: 'user', entityId: user.userId }, client)
      return { accessToken: issued.accessToken, refreshToken: issued.refreshToken, expiresIn: issued.expiresIn, user }
    })
  }

  async logout(refreshToken: string, user?: AuthenticatedUser) {
    const tokenHash = this.hashToken(refreshToken)
    await this.database.transaction(async (client) => {
      await client.query('UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE token_hash = $1', [tokenHash])
      if (user) await this.audit.log({ actor: user, action: 'auth.logout', entityType: 'user', entityId: user.userId }, client)
    })
    return { success: true }
  }

  async changePassword(
    actor: AuthenticatedUser,
    currentPassword: string,
    newPassword: string,
    clientLabel: string,
    request: Request,
  ) {
    const violations = passwordPolicyViolations(newPassword)
    if (violations.length) throw new BadRequestException(`密码需要${violations.join('、')}`)

    return this.database.transaction(async (client) => {
      const result = await client.query<UserRow>(
        `SELECT id, department_id AS "departmentId", username, display_name AS "displayName",
                password_hash AS "passwordHash", role, status, auth_version AS "authVersion"
         FROM users WHERE id = $1 AND department_id = $2 AND status = 'active' FOR UPDATE`,
        [actor.userId, actor.departmentId],
      )
      const row = result.rows[0]
      if (!row || !(await compare(currentPassword, row.passwordHash))) {
        throw new BadRequestException('当前密码不正确')
      }
      if (await compare(newPassword, row.passwordHash)) {
        throw new BadRequestException('新密码不能与当前密码相同')
      }

      const nextAuthVersion = row.authVersion + 1
      const passwordHash = await hash(newPassword, 12)
      await client.query(
        `UPDATE users
         SET password_hash = $2, password_changed_at = NOW(), auth_version = $3
         WHERE id = $1`,
        [row.id, passwordHash, nextAuthVersion],
      )
      await client.query(
        'UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1',
        [row.id],
      )

      const user = this.toAuthenticatedUser(row)
      const issued = await this.issueTokens(user, nextAuthVersion, clientLabel, client)
      await this.audit.log({
        actor: user,
        action: 'auth.password_change',
        entityType: 'user',
        entityId: user.userId,
        changes: { passwordChanged: true },
        request,
      }, client)
      return {
        accessToken: issued.accessToken,
        refreshToken: issued.refreshToken,
        expiresIn: issued.expiresIn,
        user,
      }
    })
  }

  private async issueTokens(user: AuthenticatedUser, authVersion: number, clientLabel: string, client: DatabaseClient) {
    const expiresIn = this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true })
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.userId,
        departmentId: user.departmentId,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        authVersion,
        tokenType: 'access',
      },
      { expiresIn },
    )
    const refreshToken = randomBytes(48).toString('base64url')
    const refreshDays = this.config.get('JWT_REFRESH_TTL_DAYS', { infer: true })
    const refreshTokenId = randomUUID()
    await client.query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, client_label, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + ($5 * INTERVAL '1 day'))`,
      [refreshTokenId, user.userId, this.hashToken(refreshToken), clientLabel.slice(0, 120), refreshDays],
    )
    return { accessToken, refreshToken, refreshTokenId, expiresIn }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }

  private toAuthenticatedUser(row: UserRow): AuthenticatedUser {
    return {
      userId: row.id,
      departmentId: row.departmentId,
      username: row.username,
      displayName: row.displayName,
      role: row.role,
    }
  }
}
