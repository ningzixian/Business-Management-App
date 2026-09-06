import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import type { AuthenticatedUser } from '../common/authenticated-user'
import { CurrentUser } from '../common/current-user.decorator'
import { Roles } from '../common/roles.decorator'
import {
  ContactListQueryDto,
  CreateAffiliationDto,
  CreateContactDto,
  UpdateAffiliationDto,
  UpdateContactDto,
} from './dto/contact.dto'
import { ContactsService } from './contacts.service'

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ContactListQueryDto) {
    return this.contacts.list(user, query)
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.contacts.get(user, id)
  }

  @Post()
  @Roles('admin', 'manager', 'member')
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateContactDto, @Req() request: Request) {
    return this.contacts.create(user, body, request)
  }

  @Patch(':id')
  @Roles('admin', 'manager', 'member')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateContactDto, @Req() request: Request) {
    return this.contacts.update(user, id, body, request)
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.contacts.remove(user, id, request)
  }

  @Post(':id/affiliations')
  @Roles('admin', 'manager', 'member')
  addAffiliation(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: CreateAffiliationDto, @Req() request: Request) {
    return this.contacts.addAffiliation(user, id, body, request)
  }

  @Patch(':id/affiliations/:affiliationId')
  @Roles('admin', 'manager', 'member')
  updateAffiliation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('affiliationId', ParseUUIDPipe) affiliationId: string,
    @Body() body: UpdateAffiliationDto,
    @Req() request: Request,
  ) {
    return this.contacts.updateAffiliation(user, id, affiliationId, body, request)
  }

  @Delete(':id/affiliations/:affiliationId')
  @Roles('admin', 'manager')
  removeAffiliation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('affiliationId', ParseUUIDPipe) affiliationId: string,
    @Req() request: Request,
  ) {
    return this.contacts.removeAffiliation(user, id, affiliationId, request)
  }
}
