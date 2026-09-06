import { IsString, Length, MaxLength } from 'class-validator'

export class RefreshDto {
  @IsString()
  @Length(32, 300)
  refreshToken!: string

  @IsString()
  @MaxLength(120)
  clientLabel = 'unknown'
}
