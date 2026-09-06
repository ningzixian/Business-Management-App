import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator'
import { PaginationDto } from '../../common/pagination.dto'

const organizationTypes = ['company', 'subsidiary', 'government', 'institution', 'other'] as const
const organizationStatuses = ['key', 'following', 'normal', 'inactive'] as const

export class OrganizationListQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(organizationStatuses)
  status?: typeof organizationStatuses[number]

  @IsOptional()
  @IsIn(organizationTypes)
  organizationType?: typeof organizationTypes[number]
}

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  shortName?: string

  @IsOptional()
  @IsUUID()
  parentOrganizationId?: string

  @IsOptional()
  @IsString()
  @MaxLength(32)
  unifiedSocialCreditCode?: string

  @IsOptional()
  @IsIn(organizationTypes)
  organizationType: typeof organizationTypes[number] = 'company'

  @IsOptional()
  @IsString()
  @MaxLength(120)
  industry?: string

  @IsOptional()
  @IsString()
  @MaxLength(160)
  region?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string

  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string

  @IsOptional()
  @IsIn(organizationStatuses)
  status: typeof organizationStatuses[number] = 'normal'

  @IsOptional()
  @IsUUID()
  ownerUserId?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string
}

export class UpdateOrganizationDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(240) name?: string
  @IsOptional() @IsString() @MaxLength(100) shortName?: string
  @IsOptional() @IsUUID() parentOrganizationId?: string
  @IsOptional() @IsString() @MaxLength(32) unifiedSocialCreditCode?: string
  @IsOptional() @IsIn(organizationTypes) organizationType?: typeof organizationTypes[number]
  @IsOptional() @IsString() @MaxLength(120) industry?: string
  @IsOptional() @IsString() @MaxLength(160) region?: string
  @IsOptional() @IsString() @MaxLength(500) address?: string
  @IsOptional() @IsString() @MaxLength(300) website?: string
  @IsOptional() @IsIn(organizationStatuses) status?: typeof organizationStatuses[number]
  @IsOptional() @IsUUID() ownerUserId?: string
  @IsOptional() @IsString() @MaxLength(120) source?: string
  @IsOptional() @IsString() @MaxLength(4000) notes?: string
}

export class CreateOrganizationUnitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string

  @IsOptional()
  @IsUUID()
  parentUnitId?: string

  @IsOptional()
  @IsIn(['department', 'branch', 'team', 'other'])
  unitType: 'department' | 'branch' | 'team' | 'other' = 'department'

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive = true
}
