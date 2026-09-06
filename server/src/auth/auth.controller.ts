import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Request } from 'express'
import type { AuthenticatedUser } from '../common/authenticated-user'
import { CurrentUser } from '../common/current-user.decorator'
import { Public } from '../common/public.decorator'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { RefreshDto } from './dto/refresh.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { RegisterDto } from './dto/register.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.auth.login(body.username, body.password, body.clientLabel)
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('register')
  register(@Body() body: RegisterDto, @Req() request: Request) {
    return this.auth.register(body.username, body.displayName, body.password, body.clientLabel, request)
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.refreshToken, body.clientLabel)
  }

  @Post('logout')
  logout(@Body() body: RefreshDto, @CurrentUser() user: AuthenticatedUser) {
    return this.auth.logout(body.refreshToken, user)
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user }
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Patch('password')
  changePassword(
    @Body() body: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.auth.changePassword(user, body.currentPassword, body.newPassword, body.clientLabel, request)
  }
}
