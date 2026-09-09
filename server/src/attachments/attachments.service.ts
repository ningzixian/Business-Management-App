import { BadRequestException, Injectable, Logger, NotFoundException, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common'
import type { Request } from 'express'
import { createHash, randomUUID } from 'node:crypto'
import { attachmentTypes, cleanAttachmentName } from './file-policy'
import { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser } from '../common/authenticated-user'
import { DatabaseService } from '../database/database.service'
import { StorageService } from '../storage/storage.service'

@Injectable()
export class AttachmentsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>
  private cleaning = false
  private readonly logger = new Logger(AttachmentsService.name)
  onModuleInit() {
    this.timer = setInterval(() => { void this.cleanup().catch(() => this.logger.warn('附件清理暂未完成，稍后重试')) }, 60000)
    this.timer.unref()
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer) }

  async cleanup() {
    if (this.cleaning || this.storage.isDisabled()) return
    this.cleaning = true
    try {
      await this.database.transaction(async client => {
        // Active metadata always wins, including a job left by an ambiguous transaction result.
        const jobs = await client.query<{objectKey: string}>(`SELECT object_key AS "objectKey" FROM attachment_cleanup_jobs
          WHERE due_at <= NOW() ORDER BY due_at LIMIT 20 FOR UPDATE SKIP LOCKED`)
        for (const job of jobs.rows) {
          const active = await client.query("SELECT id FROM attachments WHERE object_key = $1 AND status = 'active'", [job.objectKey])
          if (!active.rowCount) {
            try { await this.storage.removeObject(job.objectKey) }
            catch { await client.query("UPDATE attachment_cleanup_jobs SET attempts = attempts + 1, due_at = NOW() + INTERVAL '5 minutes' WHERE object_key = $1", [job.objectKey]); continue }
          }
          await client.query('DELETE FROM attachment_cleanup_jobs WHERE object_key = $1', [job.objectKey])
        }
      })
    } finally { this.cleaning = false }
  }

  async list(user: AuthenticatedUser, itemId: string) {
    await this.assertItem(user, itemId)
    const result = await this.database.query(`SELECT id, file_name AS "fileName", mime_type AS "mimeType", size_bytes::text AS "sizeBytes",
      checksum_sha256 AS "checksumSha256", created_at AS "createdAt" FROM attachments WHERE business_item_id = $1 AND status = 'active' ORDER BY created_at DESC, id`, [itemId])
    return { items: result.rows, enabled: !this.storage.isDisabled(), maxUploadBytes: Math.min(this.storage.maxUploadBytes(), 20 * 1024 * 1024) }
  }
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async upload(user: AuthenticatedUser, itemId: string, file: Express.Multer.File | undefined, request?: Request) {
    if (!file) throw new BadRequestException('请选择要上传的文件')
    if (file.size <= 0 || file.size > this.storage.maxUploadBytes()) throw new BadRequestException('附件为空或超过大小限制')
    if (!this.mimeAllowed(file.mimetype)) throw new BadRequestException('不支持该附件格式')
    await this.assertItem(user, itemId)

    const cleanName = cleanAttachmentName(file.originalname)
    const key = `${user.departmentId}/${itemId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${cleanName}`
    const checksum = createHash('sha256').update(file.buffer).digest('hex')

    // Register before object write: a crash or ambiguous network failure remains recoverable.
    await this.database.query("INSERT INTO attachment_cleanup_jobs(object_key, due_at) VALUES ($1, NOW() + INTERVAL '1 hour')", [key])
    await this.storage.putObject(key, file.buffer, file.size, {
      'Content-Type': file.mimetype,
      'X-Amz-Meta-Original-Name': encodeURIComponent(cleanName),
      'X-Amz-Meta-Sha256': checksum,
    })

    try {
      const id = await this.database.transaction(async (client) => {
        const lease = await client.query('SELECT object_key FROM attachment_cleanup_jobs WHERE object_key = $1 AND due_at > NOW() FOR UPDATE', [key])
        if (!lease.rowCount) throw new BadRequestException('上传已过期，请刷新附件列表后重试')
        const item = await client.query('SELECT id FROM business_items WHERE id = $1 AND department_id = $2 AND deleted_at IS NULL FOR SHARE', [itemId, user.departmentId])
        if (!item.rowCount) throw new NotFoundException('事项已删除，附件未保存')
        const result = await client.query<{ id: string }>(
          `INSERT INTO attachments
            (business_item_id, uploader_user_id, object_key, file_name, mime_type, size_bytes, checksum_sha256)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [itemId, user.userId, key, cleanName, file.mimetype, file.size, checksum],
        )
        const attachmentId = result.rows[0].id
        await this.audit.log({ actor: user, action: 'attachment.upload', entityType: 'attachment', entityId: attachmentId, changes: { itemId, fileName: cleanName, sizeBytes: file.size }, request }, client)
        await client.query('DELETE FROM attachment_cleanup_jobs WHERE object_key = $1', [key])
        return attachmentId
      })
      return { id, businessItemId: itemId, fileName: cleanName, mimeType: file.mimetype, sizeBytes: String(file.size), checksumSha256: checksum }
    } catch (error) {
      // Keep the durable job; delayed cleanup also covers an uncertain PUT outcome.
      throw error
    }
  }

  async metadata(user: AuthenticatedUser, id: string) {
    const result = await this.database.query<AttachmentRow>(
      `SELECT a.id, a.business_item_id AS "businessItemId", a.object_key AS "objectKey", a.file_name AS "fileName",
              a.mime_type AS "mimeType", a.size_bytes::bigint::text AS "sizeBytes", a.checksum_sha256 AS "checksumSha256",
              a.created_at AS "createdAt"
       FROM attachments a JOIN business_items bi ON bi.id = a.business_item_id
       WHERE a.id = $1 AND bi.department_id = $2 AND bi.deleted_at IS NULL AND a.status = 'active'`,
      [id, user.departmentId],
    )
    if (!result.rowCount) throw new NotFoundException('未找到附件')
    return result.rows[0]
  }

  async download(user: AuthenticatedUser, id: string) {
    const metadata = await this.metadata(user, id)
    const stream = await this.storage.getObject(metadata.objectKey)
    return { metadata, stream }
  }

  async remove(user: AuthenticatedUser, id: string, request?: Request) {
    const metadata = await this.metadata(user, id)
    await this.database.transaction(async (client) => {
      await client.query('INSERT INTO attachment_cleanup_jobs(object_key) VALUES ($1) ON CONFLICT DO NOTHING', [metadata.objectKey])
      await client.query("UPDATE attachments SET status = 'deleted', deleted_at = NOW() WHERE id = $1", [id])
      await this.audit.log({ actor: user, action: 'attachment.delete', entityType: 'attachment', entityId: id, changes: { itemId: metadata.businessItemId, fileName: metadata.fileName }, request }, client)
    })
    void this.cleanup().catch(() => this.logger.warn('附件已取消访问，存储清理将在后台重试'))
    return { success: true, message: '附件已删除，存储清理由后台完成' }
  }

  private mimeAllowed(mimeType: string) {
    return attachmentTypes.has(mimeType)
  }

  private async assertItem(user: AuthenticatedUser, id: string) {
    const result = await this.database.query('SELECT id FROM business_items WHERE id = $1 AND department_id = $2 AND deleted_at IS NULL', [id, user.departmentId])
    if (!result.rowCount) throw new NotFoundException('未找到事项')
  }
}

interface AttachmentRow {
  id: string
  businessItemId: string
  objectKey: string
  fileName: string
  mimeType: string
  sizeBytes: string
  checksumSha256: string
  createdAt: Date
}
