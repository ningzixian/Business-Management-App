import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { PaginationDto } from '../../common/pagination.dto'

const relationshipLevels = ['key', 'important', 'normal', 'new'] as const
const contactStatuses = ['provisional', 'active', 'inactive'] as const

export class ContactListQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(relationshipLevels)
  relationshipLevel?: typeof relationshipLevels[number]

  @IsOptional()
  @IsIn(contactStatuses)
  status?: typeof contactStatuses[number]

  @IsOptional()
  @IsUUID()
  organizationId?: string
}

export class CreateAffiliationDto {
  @IsUUID()
  organizationId!: string

  @IsOptional()
  @IsUUID()
  organizationUnitId?: string

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  relationshipRole?: string

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPrimary = false

  @IsOptional()
  @IsIn(['current', 'historical'])
  status: 'current' | 'historical' = 'current'

  @IsOptional()
  @IsString()
  startDate?: string

  @IsOptional()
  @IsString()
  endDate?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  confidence = 80

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string
}

export class CreateContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName!: string

  @IsOptional() @IsString() @MaxLength(20) gender?: string
  @IsOptional() @IsString() @MaxLength(40) mobile?: string
  @IsOptional() @IsString() @MaxLength(60) phone?: string
  @IsOptional() @IsEmail() @MaxLength(240) email?: string
  @IsOptional() @IsString() @MaxLength(120) wechat?: string
  @IsOptional() @IsString() @MaxLength(120) city?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  tags: string[] = []

  @IsOptional() @IsString() @MaxLength(120) source?: string
  @IsOptional() @IsIn(relationshipLevels) relationshipLevel: typeof relationshipLevels[number] = 'normal'
  @IsOptional() @IsIn(contactStatuses) status: typeof contactStatuses[number] = 'active'
  @IsOptional() @IsIn(['department', 'private']) visibility: 'department' | 'private' = 'department'
  @IsOptional() @IsUUID() ownerUserId?: string
  @IsOptional() @IsString() @MaxLength(4000) notes?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateAffiliationDto)
  affiliations: CreateAffiliationDto[] = []
}

export class UpdateContactDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) fullName?: string
  @IsOptional() @IsString() @MaxLength(20) gender?: string
  @IsOptional() @IsString() @MaxLength(40) mobile?: string
  @IsOptional() @IsString() @MaxLength(60) phone?: string
  @IsOptional() @IsEmail() @MaxLength(240) email?: string
  @IsOptional() @IsString() @MaxLength(120) wechat?: string
  @IsOptional() @IsString() @MaxLength(120) city?: string
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) tags?: string[]
  @IsOptional() @IsString() @MaxLength(120) source?: string
  @IsOptional() @IsIn(relationshipLevels) relationshipLevel?: typeof relationshipLevels[number]
  @IsOptional() @IsIn(contactStatuses) status?: typeof contactStatuses[number]
  @IsOptional() @IsIn(['department', 'private']) visibility?: 'department' | 'private'
  @IsOptional() @IsUUID() ownerUserId?: string
  @IsOptional() @IsString() @MaxLength(4000) notes?: string
}

export class UpdateAffiliationDto {
  @IsOptional() @IsUUID() organizationId?: string
  @IsOptional() @IsUUID() organizationUnitId?: string
  @IsOptional() @IsString() @MaxLength(160) title?: string
  @IsOptional() @IsString() @MaxLength(120) relationshipRole?: string
  @IsOptional() @Type(() => Boolean) @IsBoolean() isPrimary?: boolean
  @IsOptional() @IsIn(['current', 'historical']) status?: 'current' | 'historical'
  @IsOptional() @IsString() startDate?: string
  @IsOptional() @IsString() endDate?: string
  @IsOptional() @IsString() @MaxLength(120) source?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) confidence?: number
  @IsOptional() @IsString() @MaxLength(2000) notes?: string
}
