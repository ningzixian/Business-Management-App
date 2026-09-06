import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator'
import { PaginationDto } from '../../common/pagination.dto'

export const visitStatuses = ['planned', 'in_progress', 'completed', 'postponed', 'cancelled'] as const
export const taskStatuses = ['pending', 'in_progress', 'completed', 'overdue', 'cancelled'] as const
export const priorities = ['high', 'medium', 'low'] as const

export class BusinessItemListQueryDto extends PaginationDto {
  @IsOptional() @IsIn(['visit', 'task']) itemType?: 'visit' | 'task'
  @IsOptional() @IsString() @MaxLength(30) status?: string
  @IsOptional() @IsUUID() ownerUserId?: string
  @IsOptional() @IsUUID() organizationId?: string
  @IsOptional() @IsUUID() contactId?: string
  @IsOptional() @IsISO8601() dateFrom?: string
  @IsOptional() @IsISO8601() dateTo?: string
}

export class CreateBusinessItemDto {
  @IsIn(['visit', 'task'])
  itemType!: 'visit' | 'task'

  @IsString() @MinLength(1) @MaxLength(300)
  title!: string

  @IsOptional() @IsString() @MaxLength(10000) content?: string
  @IsOptional() @IsString() @MaxLength(10000) result?: string
  @IsOptional() @IsString() @MaxLength(500) location?: string
  @IsOptional() @IsISO8601() startsAt?: string
  @IsOptional() @IsISO8601() endsAt?: string
  @IsOptional() @IsISO8601() dueAt?: string
  @IsString() @MaxLength(30) status!: string
  @IsOptional() @IsIn(priorities) priority?: typeof priorities[number]
  @IsOptional() @Type(() => Boolean) @IsBoolean() isInternal = false
  @IsOptional() @IsUUID() ownerUserId?: string
  @IsOptional() @IsUUID() sourceItemId?: string

  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true })
  participantNames: string[] = []

  @IsOptional() @IsObject()
  details: Record<string, unknown> = {}

  @IsOptional() @IsArray() @ArrayMaxSize(50) @ArrayUnique() @IsUUID('4', { each: true })
  organizationIds: string[] = []

  @IsOptional() @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsUUID('4', { each: true })
  contactIds: string[] = []
}

export class UpdateBusinessItemDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300) title?: string
  @IsOptional() @IsString() @MaxLength(10000) content?: string
  @IsOptional() @IsString() @MaxLength(10000) result?: string
  @IsOptional() @IsString() @MaxLength(500) location?: string
  @IsOptional() @IsISO8601() startsAt?: string
  @IsOptional() @IsISO8601() endsAt?: string
  @IsOptional() @IsISO8601() dueAt?: string
  @IsOptional() @IsString() @MaxLength(30) status?: string
  @IsOptional() @IsIn(priorities) priority?: typeof priorities[number]
  @IsOptional() @Type(() => Boolean) @IsBoolean() isInternal?: boolean
  @IsOptional() @IsUUID() ownerUserId?: string
  @IsOptional() @IsUUID() sourceItemId?: string
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) participantNames?: string[]
  @IsOptional() @IsObject() details?: Record<string, unknown>
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ArrayUnique() @IsUUID('4', { each: true }) organizationIds?: string[]
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsUUID('4', { each: true }) contactIds?: string[]
}

export class RelationSuggestionQueryDto {
  @IsOptional() @IsUUID() organizationId?: string
  @IsOptional() @IsUUID() contactId?: string
}
