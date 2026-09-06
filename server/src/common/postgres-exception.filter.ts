import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import type { Response } from 'express'

interface PostgresError extends Error {
  code?: string
  constraint?: string
}

@Catch()
export class PostgresExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PostgresExceptionFilter.name)

  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>()
    let exception: HttpException

    if (error instanceof HttpException) {
      exception = error
    } else if (this.isPostgresError(error) && error.code === '23505') {
      exception = new ConflictException('记录已存在，请检查名称、编号或唯一字段')
    } else if (this.isPostgresError(error) && ['23503', '23514'].includes(error.code || '')) {
      exception = new ConflictException('当前操作不符合数据关联约束')
    } else {
      this.logger.error(error instanceof Error ? error.stack : String(error))
      exception = new InternalServerErrorException('服务暂时无法完成请求')
    }

    const status = exception.getStatus()
    const body = exception.getResponse()
    response.status(status).json({
      statusCode: status,
      ...(typeof body === 'string' ? { message: body } : body),
      timestamp: new Date().toISOString(),
    })
  }

  private isPostgresError(error: unknown): error is PostgresError {
    return error instanceof Error && 'code' in error
  }
}
