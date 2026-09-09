import { Module } from '@nestjs/common'
import { NotificationsModule } from './notifications/notifications.controller'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { AuditModule } from './audit/audit.module'
import { AuthModule } from './auth/auth.module'
import { JwtAuthGuard } from './auth/jwt-auth.guard'
import { RolesGuard } from './auth/roles.guard'
import { BootstrapDataService } from './bootstrap-data.service'
import { BusinessItemsModule } from './business-items/business-items.module'
import { AttachmentsModule } from './attachments/attachments.module'
import { ContactsModule } from './contacts/contacts.module'
import { PostgresExceptionFilter } from './common/postgres-exception.filter'
import { validateEnvironment } from './config/environment'
import { DatabaseModule } from './database/database.module'
import { DirectoryModule } from './directory/directory.module'
import { HealthModule } from './health/health.module'
import { OrganizationsModule } from './organizations/organizations.module'
import { StorageModule } from './storage/storage.module'
import { UsersModule } from './users/users.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    AuditModule,
    AuthModule,
    StorageModule,
    HealthModule,
    OrganizationsModule,
    ContactsModule,
    BusinessItemsModule,
    AttachmentsModule,
    DirectoryModule,
    UsersModule,
    NotificationsModule,
  ],
  providers: [
    BootstrapDataService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: PostgresExceptionFilter },
  ],
})
export class AppModule {}
