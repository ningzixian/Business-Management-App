import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import helmet from 'helmet'
import type { AppEnvironment } from './config/environment'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  const config = app.get(ConfigService<AppEnvironment, true>)

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }))
  app.enableShutdownHooks()
  app.setGlobalPrefix(config.get('API_PREFIX', { infer: true }))
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }))

  const allowedOrigins = config.get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  app.enableCors({
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
      return callback(new Error('Origin is not allowed by CORS'), false)
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Platform'],
    credentials: false,
  })

  const port = config.get('PORT', { infer: true })
  await app.listen(port, '0.0.0.0')
  Logger.log(`商务活动管理 API v0.2.0 已启动，端口 ${port}`, 'Bootstrap')
}

void bootstrap()
