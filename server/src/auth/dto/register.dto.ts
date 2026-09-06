import { IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../password-policy'

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9._-]+$/, { message: '用户名仅支持字母、数字、点、下划线和短横线' })
  username!: string

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName!: string

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  clientLabel!: string
}
