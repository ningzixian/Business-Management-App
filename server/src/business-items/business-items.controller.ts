import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import type { AuthenticatedUser } from '../common/authenticated-user'
import { CurrentUser } from '../common/current-user.decorator'
import { Roles } from '../common/roles.decorator'
import { BusinessItemsService } from './business-items.service'
import {
  BusinessItemListQueryDto,
  CreateBusinessItemDto,
  RelationSuggestionQueryDto,
  UpdateBusinessItemDto,
} from './dto/business-item.dto'

@Controller()
export class BusinessItemsController {
  constructor(private readonly items: BusinessItemsService) {}

  @Get('business-items')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: BusinessItemListQueryDto) {
    return this.items.list(user, query)
  }

  @Get('business-items/:id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.items.get(user, id)
  }

  @Post('business-items')
  @Roles('admin', 'manager', 'member')
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateBusinessItemDto, @Req() request: Request) {
    return this.items.create(user, body, request)
  }

  @Patch('business-items/:id')
  @Roles('admin', 'manager', 'member')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateBusinessItemDto, @Req() request: Request) {
    return this.items.update(user, id, body, request)
  }

  @Delete('business-items/:id')
  @Roles('admin', 'manager')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.items.remove(user, id, request)
  }

  @Get('relation-suggestions')
  suggestions(@CurrentUser() user: AuthenticatedUser, @Query() query: RelationSuggestionQueryDto) {
    return this.items.suggestions(user, query)
  }
}
