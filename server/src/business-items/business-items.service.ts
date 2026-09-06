import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Request } from 'express'
import { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser } from '../common/authenticated-user'
import { paginationMeta } from '../common/pagination.dto'
import { DatabaseService, type DatabaseClient } from '../database/database.service'
import {
  type BusinessItemListQueryDto,
  type CreateBusinessItemDto,
  type RelationSuggestionQueryDto,
  type UpdateBusinessItemDto,
  taskStatuses,
  visitStatuses,
} from './dto/business-item.dto'
import { relationPolicyError } from './relation-policy'

interface ItemRow {
  id: string
  itemType: 'visit' | 'task'
  isInternal: boolean
  status: string
}

interface OrganizationSnapshot {
  id: string
  name: string
  shortName?: string
  organizationType: string
  region?: string
}

interface ContactSnapshot {
  id: string
  fullName: string
  mobile?: string
  phone?: string
  affiliations: Array<{ organizationId: string; organizationName: string; title?: string; status: string }>
}

@Injectable()
export class BusinessItemsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, query: BusinessItemListQueryDto) {
    const values: unknown[] = [user.departmentId]
    const filters = ['bi.department_id = $1', 'bi.deleted_at IS NULL']
    if (query.q?.trim()) {
      values.push(`%${query.q.trim()}%`)
      filters.push(`(bi.title ILIKE $${values.length} OR COALESCE(bi.content, '') ILIKE $${values.length} OR COALESCE(bi.location, '') ILIKE $${values.length})`)
    }
    if (query.itemType) {
      values.push(query.itemType)
      filters.push(`bi.item_type = $${values.length}`)
    }
    if (query.status) {
      values.push(query.status)
      filters.push(`bi.status = $${values.length}`)
    }
    if (query.ownerUserId) {
      values.push(query.ownerUserId)
      filters.push(`bi.owner_user_id = $${values.length}`)
    }
    if (query.organizationId) {
      values.push(query.organizationId)
      filters.push(`EXISTS (SELECT 1 FROM business_item_organizations x WHERE x.business_item_id = bi.id AND x.organization_id = $${values.length})`)
    }
    if (query.contactId) {
      values.push(query.contactId)
      filters.push(`EXISTS (SELECT 1 FROM business_item_contacts x WHERE x.business_item_id = bi.id AND x.contact_id = $${values.length})`)
    }
    if (query.dateFrom) {
      values.push(query.dateFrom)
      filters.push(`COALESCE(bi.starts_at, bi.due_at, bi.created_at) >= $${values.length}::timestamptz`)
    }
    if (query.dateTo) {
      values.push(query.dateTo)
      filters.push(`COALESCE(bi.starts_at, bi.due_at, bi.created_at) <= $${values.length}::timestamptz`)
    }
    values.push(query.pageSize, (query.page - 1) * query.pageSize)
    const limitIndex = values.length - 1
    const offsetIndex = values.length

    const result = await this.database.query<BusinessItemListRow>(
      `SELECT bi.id, bi.item_type AS "itemType", bi.title, bi.content, bi.result, bi.location,
              bi.starts_at AS "startsAt", bi.ends_at AS "endsAt", bi.due_at AS "dueAt", bi.status,
              bi.priority, bi.is_internal AS "isInternal", bi.owner_user_id AS "ownerUserId",
              owner.display_name AS "ownerName", bi.source_item_id AS "sourceItemId",
              bi.participant_names AS "participantNames", bi.details, bi.relation_snapshot AS "relationSnapshot",
              bi.completed_at AS "completedAt", bi.created_at AS "createdAt", bi.updated_at AS "updatedAt",
              COALESCE(org_links.items, '[]'::jsonb) AS organizations,
              COALESCE(contact_links.items, '[]'::jsonb) AS contacts,
              (SELECT COUNT(*)::int FROM attachments a WHERE a.business_item_id = bi.id AND a.status = 'active') AS "attachmentCount",
              COUNT(*) OVER()::int AS "totalCount"
       FROM business_items bi
       JOIN users owner ON owner.id = bi.owner_user_id
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(
           jsonb_build_object('id', bio.organization_id, 'name', COALESCE(o.name, bio.snapshot->>'name'),
                              'shortName', COALESCE(o.short_name, bio.snapshot->>'shortName'),
                              'relationRole', bio.relation_role, 'snapshot', bio.snapshot)
           ORDER BY bio.relation_role = 'primary' DESC, bio.linked_at
         ) AS items
         FROM business_item_organizations bio LEFT JOIN organizations o ON o.id = bio.organization_id
         WHERE bio.business_item_id = bi.id
       ) org_links ON TRUE
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(
           jsonb_build_object('id', bic.contact_id, 'fullName', COALESCE(c.full_name, bic.snapshot->>'fullName'),
                              'mobile', COALESCE(c.mobile, bic.snapshot->>'mobile'),
                              'relationRole', bic.relation_role, 'snapshot', bic.snapshot)
           ORDER BY bic.relation_role = 'primary' DESC, bic.linked_at
         ) AS items
         FROM business_item_contacts bic LEFT JOIN contacts c ON c.id = bic.contact_id
         WHERE bic.business_item_id = bi.id
       ) contact_links ON TRUE
       WHERE ${filters.join(' AND ')}
       ORDER BY COALESCE(bi.starts_at, bi.due_at, bi.created_at) DESC, bi.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values,
    )
    const total = result.rows[0]?.totalCount || 0
    return { items: result.rows.map(({ totalCount: _total, ...row }) => row), meta: paginationMeta(total, query.page, query.pageSize) }
  }

  async get(user: AuthenticatedUser, id: string) {
    return this.getDirect(user, id)
  }

  private async getDirect(user: AuthenticatedUser, id: string) {
    const result = await this.database.query(
      `SELECT bi.id, bi.item_type AS "itemType", bi.title, bi.content, bi.result, bi.location,
              bi.starts_at AS "startsAt", bi.ends_at AS "endsAt", bi.due_at AS "dueAt", bi.status,
              bi.priority, bi.is_internal AS "isInternal", bi.owner_user_id AS "ownerUserId",
              owner.display_name AS "ownerName", bi.source_item_id AS "sourceItemId",
              bi.participant_names AS "participantNames", bi.details, bi.relation_snapshot AS "relationSnapshot",
              bi.completed_at AS "completedAt", bi.created_at AS "createdAt", bi.updated_at AS "updatedAt",
              COALESCE((SELECT jsonb_agg(jsonb_build_object('id', bio.organization_id, 'name', COALESCE(o.name, bio.snapshot->>'name'), 'shortName', COALESCE(o.short_name, bio.snapshot->>'shortName'), 'relationRole', bio.relation_role, 'snapshot', bio.snapshot)) FROM business_item_organizations bio LEFT JOIN organizations o ON o.id = bio.organization_id WHERE bio.business_item_id = bi.id), '[]') AS organizations,
              COALESCE((SELECT jsonb_agg(jsonb_build_object('id', bic.contact_id, 'fullName', COALESCE(c.full_name, bic.snapshot->>'fullName'), 'mobile', COALESCE(c.mobile, bic.snapshot->>'mobile'), 'relationRole', bic.relation_role, 'snapshot', bic.snapshot)) FROM business_item_contacts bic LEFT JOIN contacts c ON c.id = bic.contact_id WHERE bic.business_item_id = bi.id), '[]') AS contacts,
              (SELECT COUNT(*)::int FROM attachments a WHERE a.business_item_id = bi.id AND a.status = 'active') AS "attachmentCount"
       FROM business_items bi JOIN users owner ON owner.id = bi.owner_user_id
       WHERE bi.id = $1 AND bi.department_id = $2 AND bi.deleted_at IS NULL`,
      [id, user.departmentId],
    )
    if (!result.rowCount) throw new NotFoundException('未找到事项')
    return this.withAttachments(result.rows[0], id)
  }

  private async withAttachments<T extends Record<string, unknown>>(item: T, id: string) {
    const attachments = await this.database.query(
      `SELECT id, file_name AS "fileName", mime_type AS "mimeType", size_bytes::bigint::text AS "sizeBytes",
              checksum_sha256 AS "checksumSha256", created_at AS "createdAt"
       FROM attachments WHERE business_item_id = $1 AND status = 'active' ORDER BY created_at DESC`,
      [id],
    )
    return { ...item, attachments: attachments.rows }
  }

  async create(user: AuthenticatedUser, dto: CreateBusinessItemDto, request?: Request) {
    this.validateItem(dto.itemType, dto.status, dto)
    const id = await this.database.transaction(async (client) => {
      const ownerUserId = dto.ownerUserId || user.userId
      await this.assertUser(client, user.departmentId, ownerUserId)
      if (dto.sourceItemId) await this.assertItem(client, user.departmentId, dto.sourceItemId)
      const snapshot = await this.buildSnapshot(client, user, dto.organizationIds, dto.contactIds)

      const result = await client.query<{ id: string }>(
        `INSERT INTO business_items
          (department_id, item_type, title, content, result, location, starts_at, ends_at, due_at, status,
           priority, is_internal, owner_user_id, source_item_id, participant_names, details, relation_snapshot,
           completed_at, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::text[], $16::jsonb,
                 $17::jsonb, CASE WHEN $10 = 'completed' THEN NOW() ELSE NULL END, $18, $18)
         RETURNING id`,
        [
          user.departmentId, dto.itemType, dto.title.trim(), dto.content?.trim() || null, dto.result?.trim() || null,
          dto.location?.trim() || null, dto.startsAt || null, dto.endsAt || null, dto.dueAt || null, dto.status,
          dto.priority || null, dto.isInternal, ownerUserId, dto.sourceItemId || null,
          dto.participantNames.map((name) => name.trim()).filter(Boolean), JSON.stringify(dto.details), JSON.stringify(snapshot), user.userId,
        ],
      )
      const itemId = result.rows[0].id
      await this.replaceLinks(client, itemId, user.userId, snapshot.organizations, snapshot.contacts)
      await this.audit.log({ actor: user, action: `${dto.itemType}.create`, entityType: 'business_item', entityId: itemId, changes: { title: dto.title, organizationIds: dto.organizationIds, contactIds: dto.contactIds }, request }, client)
      return itemId
    })
    return this.getDirect(user, id)
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateBusinessItemDto, request?: Request) {
    const current = await this.itemRow(user, id)
    const updatedIsInternal = dto.isInternal ?? current.isInternal
    const updatedStatus = dto.status ?? current.status
    await this.database.transaction(async (client) => {
      const locked = await client.query<ItemRow>(
        `SELECT id, item_type AS "itemType", is_internal AS "isInternal", status
         FROM business_items WHERE id = $1 AND department_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [id, user.departmentId],
      )
      if (!locked.rowCount) throw new NotFoundException('未找到事项')
      if (dto.ownerUserId) await this.assertUser(client, user.departmentId, dto.ownerUserId)
      if (dto.sourceItemId) await this.assertItem(client, user.departmentId, dto.sourceItemId)

      let organizationIds = dto.organizationIds
      let contactIds = dto.contactIds
      if (organizationIds === undefined) organizationIds = await this.currentOrganizationIds(client, id)
      if (contactIds === undefined) contactIds = await this.currentContactIds(client, id)
      const relationError = relationPolicyError({ isInternal: updatedIsInternal, organizationIds, contactIds })
      if (relationError) throw new BadRequestException(relationError)
      this.validateItem(current.itemType, updatedStatus, { ...dto, isInternal: updatedIsInternal, organizationIds, contactIds })

      const linksChanged = dto.organizationIds !== undefined || dto.contactIds !== undefined
      const snapshot = linksChanged ? await this.buildSnapshot(client, user, organizationIds, contactIds) : undefined
      const columns: Record<string, unknown> = {
        title: dto.title?.trim(), content: dto.content?.trim(), result: dto.result?.trim(), location: dto.location?.trim(),
        starts_at: dto.startsAt, ends_at: dto.endsAt, due_at: dto.dueAt, status: dto.status, priority: dto.priority,
        is_internal: dto.isInternal, owner_user_id: dto.ownerUserId, source_item_id: dto.sourceItemId,
        participant_names: dto.participantNames, details: dto.details ? JSON.stringify(dto.details) : undefined,
        relation_snapshot: snapshot ? JSON.stringify(snapshot) : undefined,
        completed_at: dto.status === 'completed' ? new Date() : dto.status ? null : undefined,
      }
      const entries = Object.entries(columns).filter(([, value]) => value !== undefined)
      if (entries.length) {
        const values = entries.map(([, value]) => value === '' ? null : value)
        values.push(user.userId, id, user.departmentId)
        const casts: Record<string, string> = { details: '::jsonb', relation_snapshot: '::jsonb' }
        await client.query(
          `UPDATE business_items
           SET ${entries.map(([column], index) => `${column} = $${index + 1}${casts[column] || ''}`).join(', ')},
               updated_by = $${entries.length + 1}
           WHERE id = $${entries.length + 2} AND department_id = $${entries.length + 3} AND deleted_at IS NULL`,
          values,
        )
      }
      if (linksChanged && snapshot) await this.replaceLinks(client, id, user.userId, snapshot.organizations, snapshot.contacts)
      await this.audit.log({ actor: user, action: `${current.itemType}.update`, entityType: 'business_item', entityId: id, changes: dto as Record<string, unknown>, request }, client)
    })
    return this.getDirect(user, id)
  }

  async remove(user: AuthenticatedUser, id: string, request?: Request) {
    const current = await this.itemRow(user, id)
    await this.database.transaction(async (client) => {
      await client.query('UPDATE business_items SET deleted_at = NOW(), updated_by = $1 WHERE id = $2 AND department_id = $3', [user.userId, id, user.departmentId])
      await this.audit.log({ actor: user, action: `${current.itemType}.delete`, entityType: 'business_item', entityId: id, request }, client)
    })
    return { success: true }
  }

  async suggestions(user: AuthenticatedUser, query: RelationSuggestionQueryDto) {
    if (!query.organizationId && !query.contactId) return { organizations: [], contacts: [] }
    const organizations = query.contactId
      ? await this.database.query(
        `SELECT o.id, o.name, o.short_name AS "shortName", ca.title, ca.is_primary AS "isPrimary"
         FROM contact_affiliations ca JOIN organizations o ON o.id = ca.organization_id AND o.deleted_at IS NULL
         JOIN contacts c ON c.id = ca.contact_id
         WHERE ca.contact_id = $1 AND c.department_id = $2 AND ca.status = 'current' AND ca.deleted_at IS NULL
         ORDER BY ca.is_primary DESC, o.name`,
        [query.contactId, user.departmentId],
      )
      : { rows: [] }
    const contacts = query.organizationId
      ? await this.database.query(
        `SELECT c.id, c.full_name AS "fullName", c.mobile, ca.title, ca.relationship_role AS "relationshipRole", ca.is_primary AS "isPrimary"
         FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id AND c.deleted_at IS NULL
         JOIN organizations o ON o.id = ca.organization_id
         WHERE ca.organization_id = $1 AND o.department_id = $2 AND ca.status = 'current' AND ca.deleted_at IS NULL
         ORDER BY ca.is_primary DESC, c.full_name`,
        [query.organizationId, user.departmentId],
      )
      : { rows: [] }
    return { organizations: organizations.rows, contacts: contacts.rows }
  }

  private validateItem(itemType: 'visit' | 'task', status: string, dto: Partial<CreateBusinessItemDto & UpdateBusinessItemDto>) {
    const allowed = itemType === 'visit' ? visitStatuses : taskStatuses
    if (!(allowed as readonly string[]).includes(status)) throw new BadRequestException('事项状态与事项类型不匹配')
    const relationError = relationPolicyError({
      isInternal: dto.isInternal || false,
      organizationIds: dto.organizationIds,
      contactIds: dto.contactIds,
    })
    if (relationError) throw new BadRequestException(relationError)
    if (itemType === 'visit' && !dto.startsAt && 'itemType' in dto) throw new BadRequestException('拜访事项必须填写开始时间')
    if (itemType === 'task' && !dto.dueAt && 'itemType' in dto) throw new BadRequestException('待办事项必须填写截止时间')
    if (dto.startsAt && dto.endsAt && new Date(dto.endsAt) < new Date(dto.startsAt)) throw new BadRequestException('结束时间不能早于开始时间')
  }

  private async buildSnapshot(client: DatabaseClient, user: AuthenticatedUser, organizationIds: string[], contactIds: string[]) {
    const organizations: OrganizationSnapshot[] = organizationIds.length
      ? (await client.query<OrganizationSnapshot>(
        `SELECT id, name, short_name AS "shortName", organization_type AS "organizationType", region
         FROM organizations WHERE id = ANY($1::uuid[]) AND department_id = $2 AND deleted_at IS NULL`,
        [organizationIds, user.departmentId],
      )).rows
      : []
    if (organizations.length !== organizationIds.length) throw new BadRequestException('部分甲方组织不存在或不可用')

    const elevated = ['admin', 'manager'].includes(user.role)
    const contacts: ContactSnapshot[] = contactIds.length
      ? (await client.query<ContactSnapshot>(
        `SELECT c.id, c.full_name AS "fullName", c.mobile, c.phone,
                COALESCE((SELECT jsonb_agg(jsonb_build_object(
                  'organizationId', ca.organization_id, 'organizationName', o.name, 'title', ca.title, 'status', ca.status
                ) ORDER BY ca.is_primary DESC, ca.updated_at DESC)
                FROM contact_affiliations ca JOIN organizations o ON o.id = ca.organization_id
                WHERE ca.contact_id = c.id AND ca.deleted_at IS NULL), '[]'::jsonb) AS affiliations
         FROM contacts c
         WHERE c.id = ANY($1::uuid[]) AND c.department_id = $2 AND c.deleted_at IS NULL
           AND (c.visibility = 'department' OR c.owner_user_id = $3 OR $4::boolean = TRUE)`,
        [contactIds, user.departmentId, user.userId, elevated],
      )).rows
      : []
    if (contacts.length !== contactIds.length) throw new BadRequestException('部分联系人不存在或不可用')

    const orgMap = new Map(organizations.map((item) => [item.id, item]))
    const contactMap = new Map(contacts.map((item) => [item.id, item]))
    return {
      organizations: organizationIds.map((id) => orgMap.get(id) as OrganizationSnapshot),
      contacts: contactIds.map((id) => contactMap.get(id) as ContactSnapshot),
    }
  }

  private async replaceLinks(client: DatabaseClient, itemId: string, userId: string, organizations: OrganizationSnapshot[], contacts: ContactSnapshot[]) {
    await client.query('DELETE FROM business_item_organizations WHERE business_item_id = $1', [itemId])
    await client.query('DELETE FROM business_item_contacts WHERE business_item_id = $1', [itemId])
    for (const [index, organization] of organizations.entries()) {
      await client.query(
        `INSERT INTO business_item_organizations (business_item_id, organization_id, relation_role, snapshot, linked_by)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [itemId, organization.id, index === 0 ? 'primary' : 'related', JSON.stringify(organization), userId],
      )
    }
    for (const [index, contact] of contacts.entries()) {
      await client.query(
        `INSERT INTO business_item_contacts (business_item_id, contact_id, relation_role, snapshot, linked_by)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [itemId, contact.id, index === 0 ? 'primary' : 'participant', JSON.stringify(contact), userId],
      )
    }
  }

  private async itemRow(user: AuthenticatedUser, id: string) {
    const result = await this.database.query<ItemRow>(
      `SELECT id, item_type AS "itemType", is_internal AS "isInternal", status
       FROM business_items WHERE id = $1 AND department_id = $2 AND deleted_at IS NULL`,
      [id, user.departmentId],
    )
    if (!result.rowCount) throw new NotFoundException('未找到事项')
    return result.rows[0]
  }

  private async assertUser(client: DatabaseClient, departmentId: string, id: string) {
    const result = await client.query('SELECT id FROM users WHERE id = $1 AND department_id = $2 AND status = $3', [id, departmentId, 'active'])
    if (!result.rowCount) throw new BadRequestException('负责人不存在或不可用')
  }

  private async assertItem(client: DatabaseClient, departmentId: string, id: string) {
    const result = await client.query('SELECT id FROM business_items WHERE id = $1 AND department_id = $2 AND deleted_at IS NULL', [id, departmentId])
    if (!result.rowCount) throw new BadRequestException('来源事项不存在或不可用')
  }

  private async currentOrganizationIds(client: DatabaseClient, id: string) {
    const result = await client.query<{ id: string }>('SELECT organization_id AS id FROM business_item_organizations WHERE business_item_id = $1 ORDER BY relation_role = \'primary\' DESC, linked_at', [id])
    return result.rows.map((row) => row.id)
  }

  private async currentContactIds(client: DatabaseClient, id: string) {
    const result = await client.query<{ id: string }>('SELECT contact_id AS id FROM business_item_contacts WHERE business_item_id = $1 ORDER BY relation_role = \'primary\' DESC, linked_at', [id])
    return result.rows.map((row) => row.id)
  }
}

interface BusinessItemListRow extends Record<string, unknown> {
  id: string
  totalCount: number
}
