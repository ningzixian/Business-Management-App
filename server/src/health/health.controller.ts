import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { Public } from '../common/public.decorator'
import { DatabaseService } from '../database/database.service'
import { StorageService } from '../storage/storage.service'

@Controller('health')
@Public()
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok', version: '0.2.0', timestamp: new Date().toISOString() }
  }

  @Get('ready')
  async ready() {
    try {
      const [databaseTime, storage] = await Promise.all([this.database.ping(), this.storage.ping()])
      if (!storage.ready) throw new Error('storage bucket missing')
      return {
        status: 'ready',
        version: '0.2.0',
        checks: { database: { ready: true, time: databaseTime }, storage },
      }
    } catch {
      throw new ServiceUnavailableException('服务依赖尚未就绪')
    }
  }
}
