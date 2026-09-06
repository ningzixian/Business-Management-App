import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import type { AuthenticatedUser } from '../common/authenticated-user'
import { CurrentUser } from '../common/current-user.decorator'
import { Roles } from '../common/roles.decorator'
import { CreateUserDto, ResetUserPasswordDto, UpdateUserDto, UserListQueryDto } from './dto/user.dto'
import { UsersService } from './users.service'

@Controller('users')
@Roles('admin')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: UserListQueryDto) {
    return this.users.list(user, query)
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateUserDto, @Req() request: Request) {
    return this.users.create(user, body, request)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserDto,
    @Req() request: Request,
  ) {
    return this.users.update(user, id, body, request)
  }

  @Post(':id/reset-password')
  resetPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResetUserPasswordDto,
    @Req() request: Request,
  ) {
    return this.users.resetPassword(user, id, body, request)
  }
}
