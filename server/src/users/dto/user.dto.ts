import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../auth/password-policy'
import { PaginationDto } from '../../common/pagination.dto'
import type { UserRole } from '../../common/authenticated-user'

export const userRoles = ['admin', 'manager', 'member', 'readonly'] as const
export const userStatuses = ['active', 'disabled'] as const

export class UserListQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(userRoles)
  role?: UserRole

  @IsOptional()
  @IsIn(userStatuses)
  status?: typeof userStatuses[number]
}

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9._-]+$/, { message: '用户名仅支持字母、数字、点、下划线和短横线' })
  username!: string

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName!: string

  @IsIn(userRoles)
  role!: UserRole

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  initialPassword!: string
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName?: string

  @IsOptional()
  @IsIn(userRoles)
  role?: UserRole

  @IsOptional()
  @IsIn(userStatuses)
  status?: typeof userStatuses[number]
}

export class ResetUserPasswordDto {
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  newPassword!: string
}
