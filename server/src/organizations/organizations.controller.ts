import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import type { AuthenticatedUser } from '../common/authenticated-user'
import { CurrentUser } from '../common/current-user.decorator'
import { Roles } from '../common/roles.decorator'
import {
  CreateOrganizationDto,
  CreateOrganizationUnitDto,
  OrganizationListQueryDto,
  UpdateOrganizationDto,
} from './dto/organization.dto'
import { OrganizationsService } from './organizations.service'

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: OrganizationListQueryDto) {
    return this.organizations.list(user, query)
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.organizations.get(user, id)
  }

  @Post()
  @Roles('admin', 'manager', 'member')
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateOrganizationDto, @Req() request: Request) {
    return this.organizations.create(user, body, request)
  }

  @Patch(':id')
  @Roles('admin', 'manager', 'member')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateOrganizationDto, @Req() request: Request) {
    return this.organizations.update(user, id, body, request)
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.organizations.remove(user, id, request)
  }

  @Post(':id/units')
  @Roles('admin', 'manager', 'member')
  createUnit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateOrganizationUnitDto,
    @Req() request: Request,
  ) {
    return this.organizations.createUnit(user, id, body, request)
  }
}
