import { IsString, Length, MaxLength } from 'class-validator'

export class LoginDto {
  @IsString()
  @Length(2, 80)
  username!: string

  @IsString()
  @Length(8, 200)
  password!: string

  @IsString()
  @MaxLength(120)
  clientLabel = 'unknown'
}
