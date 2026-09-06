import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import type { AuthenticatedRequest, AuthenticatedUser, UserRole } from '../common/authenticated-user'
import { IS_PUBLIC_KEY } from '../common/public.decorator'
import { DatabaseService } from '../database/database.service'

interface AccessTokenPayload {
  sub: string
  departmentId: string
  username: string
  displayName: string
  role: UserRole
  authVersion: number
  tokenType: 'access'
}

interface CurrentUserRow {
  id: string
  username: string
  displayName: string
  role: UserRole
  authVersion: number
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly database: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) {
      return true
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const [scheme, token] = request.headers.authorization?.split(' ') ?? []
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('请先登录')

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token)
      if (payload.tokenType !== 'access') throw new Error('invalid token type')

      const result = await this.database.query<CurrentUserRow>(
        `SELECT id, username, display_name AS "displayName", role, auth_version AS "authVersion"
         FROM users WHERE id = $1 AND department_id = $2 AND status = $3`,
        [payload.sub, payload.departmentId, 'active'],
      )
      const current = result.rows[0]
      if (!current || payload.authVersion !== current.authVersion) throw new Error('user disabled or token superseded')

      const user: AuthenticatedUser = {
        userId: payload.sub,
        departmentId: payload.departmentId,
        username: current.username,
        displayName: current.displayName,
        role: current.role,
      }
      request.user = user
      return true
    } catch {
      throw new UnauthorizedException('登录状态已失效，请重新登录')
    }
  }
}
