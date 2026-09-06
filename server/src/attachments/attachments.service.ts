import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Request } from 'express'
import { createHash, randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser } from '../common/authenticated-user'
import { DatabaseService } from '../database/database.service'
import { StorageService } from '../storage/storage.service'

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
])

@Injectable()
export class AttachmentsService {
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

    const cleanName = basename(file.originalname).replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').slice(0, 240)
    const key = `${user.departmentId}/${itemId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${cleanName}`
    const checksum = createHash('sha256').update(file.buffer).digest('hex')

    await this.storage.putObject(key, file.buffer, file.size, {
      'Content-Type': file.mimetype,
      'X-Amz-Meta-Original-Name': encodeURIComponent(cleanName),
      'X-Amz-Meta-Sha256': checksum,
    })

    try {
      const id = await this.database.transaction(async (client) => {
        const result = await client.query<{ id: string }>(
          `INSERT INTO attachments
            (business_item_id, uploader_user_id, object_key, file_name, mime_type, size_bytes, checksum_sha256)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [itemId, user.userId, key, cleanName, file.mimetype, file.size, checksum],
        )
        const attachmentId = result.rows[0].id
        await this.audit.log({ actor: user, action: 'attachment.upload', entityType: 'attachment', entityId: attachmentId, changes: { itemId, fileName: cleanName, sizeBytes: file.size }, request }, client)
        return attachmentId
      })
      return { id, businessItemId: itemId, fileName: cleanName, mimeType: file.mimetype, sizeBytes: String(file.size), checksumSha256: checksum }
    } catch (error) {
      await this.storage.removeObject(key).catch(() => undefined)
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
      await client.query("UPDATE attachments SET status = 'deleted', deleted_at = NOW() WHERE id = $1", [id])
      await this.audit.log({ actor: user, action: 'attachment.delete', entityType: 'attachment', entityId: id, changes: { itemId: metadata.businessItemId, fileName: metadata.fileName }, request }, client)
    })
    await this.storage.removeObject(metadata.objectKey).catch(() => undefined)
    return { success: true }
  }

  private mimeAllowed(mimeType: string) {
    return mimeType.startsWith('image/') || mimeType.startsWith('audio/') || allowedMimeTypes.has(mimeType)
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
