import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { Readable } from 'node:stream'
import type { AppEnvironment } from '../config/environment'

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name)
  private readonly disabled: boolean
  private readonly bucket: string
  private readonly client?: S3Client

  constructor(private readonly config: ConfigService<AppEnvironment, true>) {
    this.disabled = config.get('MINIO_DISABLED', { infer: true })
    this.bucket = config.get('MINIO_BUCKET', { infer: true })
    if (!this.disabled) {
      const scheme = config.get('MINIO_USE_SSL', { infer: true }) ? 'https' : 'http'
      const host = config.get('MINIO_ENDPOINT', { infer: true })
      const port = config.get('MINIO_PORT', { infer: true })
      this.client = new S3Client({
        region: 'us-east-1',
        endpoint: `${scheme}://${host}:${port}`,
        forcePathStyle: true,
        credentials: {
          accessKeyId: config.get('MINIO_ACCESS_KEY', { infer: true }),
          secretAccessKey: config.get('MINIO_SECRET_KEY', { infer: true }),
        },
      })
    }
  }

  async onModuleInit() {
    if (this.disabled) {
      this.logger.warn('附件存储已禁用')
      return
    }
    let lastError: unknown
    for (let attempt = 1; attempt <= 15; attempt += 1) {
      try {
        await this.ensureBucket()
        this.logger.log(`附件存储桶已就绪：${this.bucket}`)
        return
      } catch (error) {
        lastError = error
        this.logger.warn(`附件存储尚未就绪（${attempt}/15）`)
        await new Promise((resolve) => setTimeout(resolve, Math.min(attempt * 500, 3_000)))
      }
    }
    throw lastError
  }

  isDisabled() {
    return this.disabled
  }

  maxUploadBytes() {
    return this.config.get('MAX_UPLOAD_BYTES', { infer: true })
  }

  async putObject(key: string, data: Buffer, size: number, metadata: Record<string, string>) {
    await this.requiredClient().send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentLength: size,
      ContentType: metadata['Content-Type'],
      Metadata: Object.fromEntries(Object.entries(metadata)
        .filter(([name]) => name !== 'Content-Type')
        .map(([name, value]) => [name.replace(/^X-Amz-Meta-/i, '').toLowerCase(), value])),
    }))
  }

  async getObject(key: string): Promise<Readable> {
    const result = await this.requiredClient().send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    if (!result.Body || !('pipe' in result.Body)) throw new ServiceUnavailableException('附件内容不可读取')
    return result.Body as Readable
  }

  async removeObject(key: string) {
    await this.requiredClient().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  async ping() {
    if (this.disabled) return { enabled: false, ready: true }
    await this.requiredClient().send(new HeadBucketCommand({ Bucket: this.bucket }))
    return { enabled: true, ready: true }
  }

  private requiredClient() {
    if (!this.client) throw new ServiceUnavailableException('附件存储未启用')
    return this.client
  }

  private async ensureBucket() {
    try {
      await this.requiredClient().send(new HeadBucketCommand({ Bucket: this.bucket }))
    } catch {
      await this.requiredClient().send(new CreateBucketCommand({ Bucket: this.bucket }))
      await this.requiredClient().send(new HeadBucketCommand({ Bucket: this.bucket }))
    }
  }
}
