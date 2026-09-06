import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AuthenticatedRequest, UserRole } from '../common/authenticated-user'
import { ROLES_KEY } from '../common/roles.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()])
    if (!required?.length) return true

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (!request.user || !required.includes(request.user.role)) {
      throw new ForbiddenException('当前账号没有执行此操作的权限')
    }
    return true
  }
}
