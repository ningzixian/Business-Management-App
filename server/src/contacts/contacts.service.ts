import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Request } from 'express'
import { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser } from '../common/authenticated-user'
import { paginationMeta } from '../common/pagination.dto'
import { DatabaseService, type DatabaseClient } from '../database/database.service'
import type {
  ContactListQueryDto,
  CreateAffiliationDto,
  CreateContactDto,
  UpdateAffiliationDto,
  UpdateContactDto,
} from './dto/contact.dto'

@Injectable()
export class ContactsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, query: ContactListQueryDto) {
    const elevated = ['admin', 'manager'].includes(user.role)
    const values: unknown[] = [user.departmentId, user.userId, elevated]
    const filters = [
      'c.department_id = $1',
      'c.deleted_at IS NULL',
      `(c.visibility = 'department' OR c.owner_user_id = $2 OR $3::boolean = TRUE)`,
    ]
    if (query.q?.trim()) {
      values.push(`%${query.q.trim()}%`)
      filters.push(`(c.full_name ILIKE $${values.length} OR COALESCE(c.mobile, '') ILIKE $${values.length} OR COALESCE(c.email, '') ILIKE $${values.length} OR COALESCE(primary_org.name, '') ILIKE $${values.length})`)
    }
    if (query.relationshipLevel) {
      values.push(query.relationshipLevel)
      filters.push(`c.relationship_level = $${values.length}`)
    }
    if (query.status) {
      values.push(query.status)
      filters.push(`c.status = $${values.length}`)
    }
    if (query.organizationId) {
      values.push(query.organizationId)
      filters.push(`EXISTS (SELECT 1 FROM contact_affiliations f WHERE f.contact_id = c.id AND f.organization_id = $${values.length} AND f.deleted_at IS NULL)`)
    }
    values.push(query.pageSize, (query.page - 1) * query.pageSize)
    const limitIndex = values.length - 1
    const offsetIndex = values.length

    const result = await this.database.query<ContactListRow>(
      `SELECT c.id, c.full_name AS "fullName", c.gender, c.mobile, c.phone, c.email, c.wechat, c.city,
              c.tags, c.relationship_level AS "relationshipLevel", c.status, c.visibility,
              c.owner_user_id AS "ownerUserId", owner.display_name AS "ownerName",
              primary_org.id AS "primaryOrganizationId", primary_org.name AS "primaryOrganizationName",
              primary_org.title AS "primaryTitle",
              (SELECT COUNT(*)::int FROM contact_affiliations ca WHERE ca.contact_id = c.id AND ca.deleted_at IS NULL) AS "affiliationCount",
              (SELECT COUNT(*)::int FROM business_item_contacts bic
               JOIN business_items bi ON bi.id = bic.business_item_id
               WHERE bic.contact_id = c.id AND bi.deleted_at IS NULL) AS "itemCount",
              COUNT(*) OVER()::int AS "totalCount"
       FROM contacts c
       LEFT JOIN users owner ON owner.id = c.owner_user_id
       LEFT JOIN LATERAL (
         SELECT o.id, o.name, ca.title
         FROM contact_affiliations ca
         JOIN organizations o ON o.id = ca.organization_id AND o.deleted_at IS NULL
         WHERE ca.contact_id = c.id AND ca.deleted_at IS NULL
         ORDER BY (ca.status = 'current') DESC, ca.is_primary DESC, ca.updated_at DESC LIMIT 1
       ) primary_org ON TRUE
       WHERE ${filters.join(' AND ')}
       ORDER BY CASE c.relationship_level WHEN 'key' THEN 1 WHEN 'important' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
                c.updated_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values,
    )
    const total = result.rows[0]?.totalCount || 0
    return { items: result.rows.map(({ totalCount: _total, ...row }) => row), meta: paginationMeta(total, query.page, query.pageSize) }
  }

  async get(user: AuthenticatedUser, id: string) {
    const elevated = ['admin', 'manager'].includes(user.role)
    const contact = await this.database.query(
      `SELECT c.id, c.full_name AS "fullName", c.gender, c.mobile, c.phone, c.email, c.wechat, c.city,
              c.tags, c.source, c.relationship_level AS "relationshipLevel", c.status, c.visibility,
              c.owner_user_id AS "ownerUserId", owner.display_name AS "ownerName", c.notes,
              c.created_at AS "createdAt", c.updated_at AS "updatedAt"
       FROM contacts c LEFT JOIN users owner ON owner.id = c.owner_user_id
       WHERE c.id = $1 AND c.department_id = $2 AND c.deleted_at IS NULL
         AND (c.visibility = 'department' OR c.owner_user_id = $3 OR $4::boolean = TRUE)`,
      [id, user.departmentId, user.userId, elevated],
    )
    if (!contact.rowCount) throw new NotFoundException('未找到联系人')

    const [affiliations, recentItems] = await Promise.all([
      this.database.query(
        `SELECT ca.id, ca.organization_id AS "organizationId", o.name AS "organizationName",
                ca.organization_unit_id AS "organizationUnitId", ou.name AS "organizationUnitName",
                ca.title, ca.relationship_role AS "relationshipRole", ca.is_primary AS "isPrimary",
                ca.status, ca.start_date AS "startDate", ca.end_date AS "endDate", ca.source,
                ca.confidence, ca.notes, ca.created_at AS "createdAt"
         FROM contact_affiliations ca
         JOIN organizations o ON o.id = ca.organization_id
         LEFT JOIN organization_units ou ON ou.id = ca.organization_unit_id
         WHERE ca.contact_id = $1 AND ca.deleted_at IS NULL
         ORDER BY (ca.status = 'current') DESC, ca.is_primary DESC, ca.updated_at DESC`,
        [id],
      ),
      this.database.query(
        `SELECT bi.id, bi.item_type AS "itemType", bi.title, bi.status,
                COALESCE(bi.starts_at, bi.due_at, bi.created_at) AS "occurredAt"
         FROM business_item_contacts bic
         JOIN business_items bi ON bi.id = bic.business_item_id
         WHERE bic.contact_id = $1 AND bi.deleted_at IS NULL
         ORDER BY COALESCE(bi.starts_at, bi.due_at, bi.created_at) DESC LIMIT 20`,
        [id],
      ),
    ])
    return { ...contact.rows[0], affiliations: affiliations.rows, recentItems: recentItems.rows }
  }

  async create(user: AuthenticatedUser, dto: CreateContactDto, request?: Request) {
    if (dto.affiliations.filter((item) => item.isPrimary && item.status === 'current').length > 1) {
      throw new BadRequestException('一个联系人只能有一个当前主要任职关系')
    }
    const id = await this.database.transaction(async (client) => {
      if (dto.ownerUserId) await this.assertUser(client, user.departmentId, dto.ownerUserId)
      await this.assertAffiliations(client, user.departmentId, dto.affiliations)
      const result = await client.query<{ id: string }>(
        `INSERT INTO contacts
          (department_id, full_name, gender, mobile, phone, email, wechat, city, tags, source,
           relationship_level, status, visibility, owner_user_id, notes, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10, $11, $12, $13, $14, $15, $16, $16)
         RETURNING id`,
        [
          user.departmentId, dto.fullName.trim(), dto.gender || null, dto.mobile?.trim() || null,
          dto.phone?.trim() || null, dto.email?.trim() || null, dto.wechat?.trim() || null, dto.city?.trim() || null,
          dto.tags.map((tag) => tag.trim()).filter(Boolean), dto.source?.trim() || null, dto.relationshipLevel,
          dto.status, dto.visibility, dto.ownerUserId || user.userId, dto.notes?.trim() || null, user.userId,
        ],
      )
      const contactId = result.rows[0].id
      for (const affiliation of dto.affiliations) {
        await this.insertAffiliation(client, user, contactId, affiliation)
      }
      await this.audit.log({ actor: user, action: 'contact.create', entityType: 'contact', entityId: contactId, changes: { fullName: dto.fullName, affiliationCount: dto.affiliations.length }, request }, client)
      return contactId
    })
    return this.get(user, id)
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateContactDto, request?: Request) {
    await this.get(user, id)
    await this.database.transaction(async (client) => {
      if (dto.ownerUserId) await this.assertUser(client, user.departmentId, dto.ownerUserId)
      const columns: Record<string, unknown> = {
        full_name: dto.fullName?.trim(), gender: dto.gender, mobile: dto.mobile?.trim(), phone: dto.phone?.trim(),
        email: dto.email?.trim(), wechat: dto.wechat?.trim(), city: dto.city?.trim(), tags: dto.tags,
        source: dto.source?.trim(), relationship_level: dto.relationshipLevel, status: dto.status,
        visibility: dto.visibility, owner_user_id: dto.ownerUserId, notes: dto.notes?.trim(),
      }
      const entries = Object.entries(columns).filter(([, value]) => value !== undefined)
      if (entries.length) {
        const values = entries.map(([, value]) => value === '' ? null : value)
        values.push(user.userId, id, user.departmentId)
        await client.query(
          `UPDATE contacts SET ${entries.map(([column], index) => `${column} = $${index + 1}`).join(', ')},
                  updated_by = $${entries.length + 1}
           WHERE id = $${entries.length + 2} AND department_id = $${entries.length + 3} AND deleted_at IS NULL`,
          values,
        )
      }
      await this.audit.log({ actor: user, action: 'contact.update', entityType: 'contact', entityId: id, changes: dto as Record<string, unknown>, request }, client)
    })
    return this.get(user, id)
  }

  async addAffiliation(user: AuthenticatedUser, contactId: string, dto: CreateAffiliationDto, request?: Request) {
    await this.get(user, contactId)
    const affiliationId = await this.database.transaction(async (client) => {
      await this.assertAffiliations(client, user.departmentId, [dto])
      const id = await this.insertAffiliation(client, user, contactId, dto)
      await this.audit.log({ actor: user, action: 'contact_affiliation.create', entityType: 'contact_affiliation', entityId: id, changes: { contactId, organizationId: dto.organizationId }, request }, client)
      return id
    })
    return { id: affiliationId, contactId, ...dto }
  }

  async updateAffiliation(user: AuthenticatedUser, contactId: string, affiliationId: string, dto: UpdateAffiliationDto, request?: Request) {
    await this.get(user, contactId)
    await this.database.transaction(async (client) => {
      const current = await client.query<{ organizationId: string; organizationUnitId?: string }>(
        `SELECT organization_id AS "organizationId", organization_unit_id AS "organizationUnitId"
         FROM contact_affiliations WHERE id = $1 AND contact_id = $2 AND deleted_at IS NULL`,
        [affiliationId, contactId],
      )
      if (!current.rowCount) throw new NotFoundException('未找到任职关系')
      const organizationId = dto.organizationId || current.rows[0].organizationId
      await this.assertAffiliations(client, user.departmentId, [{ ...dto, organizationId } as CreateAffiliationDto])
      if (dto.isPrimary) {
        await client.query('UPDATE contact_affiliations SET is_primary = FALSE, updated_by = $2 WHERE contact_id = $1 AND deleted_at IS NULL', [contactId, user.userId])
      }
      const columns: Record<string, unknown> = {
        organization_id: dto.organizationId, organization_unit_id: dto.organizationUnitId, title: dto.title?.trim(),
        relationship_role: dto.relationshipRole?.trim(), is_primary: dto.isPrimary, status: dto.status,
        start_date: dto.startDate, end_date: dto.endDate, source: dto.source?.trim(), confidence: dto.confidence, notes: dto.notes?.trim(),
      }
      const entries = Object.entries(columns).filter(([, value]) => value !== undefined)
      if (entries.length) {
        const values = entries.map(([, value]) => value === '' ? null : value)
        values.push(user.userId, affiliationId, contactId)
        await client.query(
          `UPDATE contact_affiliations
           SET ${entries.map(([column], index) => `${column} = $${index + 1}`).join(', ')}, updated_by = $${entries.length + 1}
           WHERE id = $${entries.length + 2} AND contact_id = $${entries.length + 3} AND deleted_at IS NULL`,
          values,
        )
      }
      await this.audit.log({ actor: user, action: 'contact_affiliation.update', entityType: 'contact_affiliation', entityId: affiliationId, changes: dto as Record<string, unknown>, request }, client)
    })
    return this.get(user, contactId)
  }

  async removeAffiliation(user: AuthenticatedUser, contactId: string, affiliationId: string, request?: Request) {
    await this.get(user, contactId)
    await this.database.transaction(async (client) => {
      const result = await client.query(
        `UPDATE contact_affiliations SET deleted_at = NOW(), is_primary = FALSE, updated_by = $1
         WHERE id = $2 AND contact_id = $3 AND deleted_at IS NULL RETURNING id`,
        [user.userId, affiliationId, contactId],
      )
      if (!result.rowCount) throw new NotFoundException('未找到任职关系')
      await this.audit.log({ actor: user, action: 'contact_affiliation.delete', entityType: 'contact_affiliation', entityId: affiliationId, changes: { contactId }, request }, client)
    })
    return { success: true }
  }

  async remove(user: AuthenticatedUser, id: string, request?: Request) {
    await this.get(user, id)
    await this.database.transaction(async (client) => {
      await client.query(
        `UPDATE contacts SET deleted_at = NOW(), status = 'inactive', updated_by = $1
         WHERE id = $2 AND department_id = $3 AND deleted_at IS NULL`,
        [user.userId, id, user.departmentId],
      )
      await client.query('UPDATE contact_affiliations SET deleted_at = NOW(), is_primary = FALSE, updated_by = $1 WHERE contact_id = $2 AND deleted_at IS NULL', [user.userId, id])
      await this.audit.log({ actor: user, action: 'contact.delete', entityType: 'contact', entityId: id, request }, client)
    })
    return { success: true }
  }

  private async insertAffiliation(client: DatabaseClient, user: AuthenticatedUser, contactId: string, dto: CreateAffiliationDto) {
    if (dto.isPrimary && dto.status === 'current') {
      await client.query('UPDATE contact_affiliations SET is_primary = FALSE, updated_by = $2 WHERE contact_id = $1 AND deleted_at IS NULL', [contactId, user.userId])
    }
    const result = await client.query<{ id: string }>(
      `INSERT INTO contact_affiliations
        (contact_id, organization_id, organization_unit_id, title, relationship_role, is_primary, status,
         start_date, end_date, source, confidence, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13) RETURNING id`,
      [
        contactId, dto.organizationId, dto.organizationUnitId || null, dto.title?.trim() || null,
        dto.relationshipRole?.trim() || null, dto.isPrimary, dto.status, dto.startDate || null, dto.endDate || null,
        dto.source?.trim() || null, dto.confidence, dto.notes?.trim() || null, user.userId,
      ],
    )
    return result.rows[0].id
  }

  private async assertAffiliations(client: DatabaseClient, departmentId: string, affiliations: CreateAffiliationDto[]) {
    for (const affiliation of affiliations) {
      const organization = await client.query('SELECT id FROM organizations WHERE id = $1 AND department_id = $2 AND deleted_at IS NULL', [affiliation.organizationId, departmentId])
      if (!organization.rowCount) throw new BadRequestException('任职关系中的甲方组织不存在或不可用')
      if (affiliation.organizationUnitId) {
        const unit = await client.query('SELECT id FROM organization_units WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL', [affiliation.organizationUnitId, affiliation.organizationId])
        if (!unit.rowCount) throw new BadRequestException('任职部门不属于所选甲方组织')
      }
    }
  }

  private async assertUser(client: DatabaseClient, departmentId: string, id: string) {
    const result = await client.query('SELECT id FROM users WHERE id = $1 AND department_id = $2 AND status = $3', [id, departmentId, 'active'])
    if (!result.rowCount) throw new BadRequestException('负责人不存在或不可用')
  }
}

interface ContactListRow {
  id: string
  fullName: string
  totalCount: number
  [key: string]: unknown
}
