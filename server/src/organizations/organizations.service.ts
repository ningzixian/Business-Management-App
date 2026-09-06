import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Request } from 'express'
import { AuditService } from '../audit/audit.service'
import type { AuthenticatedUser } from '../common/authenticated-user'
import { paginationMeta } from '../common/pagination.dto'
import { DatabaseService, type DatabaseClient } from '../database/database.service'
import type {
  CreateOrganizationDto,
  CreateOrganizationUnitDto,
  OrganizationListQueryDto,
  UpdateOrganizationDto,
} from './dto/organization.dto'

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, query: OrganizationListQueryDto) {
    const values: unknown[] = [user.departmentId]
    const filters = ['o.department_id = $1', 'o.deleted_at IS NULL']

    if (query.q?.trim()) {
      values.push(`%${query.q.trim()}%`)
      filters.push(`(o.name ILIKE $${values.length} OR COALESCE(o.short_name, '') ILIKE $${values.length} OR COALESCE(o.industry, '') ILIKE $${values.length})`)
    }
    if (query.status) {
      values.push(query.status)
      filters.push(`o.status = $${values.length}`)
    }
    if (query.organizationType) {
      values.push(query.organizationType)
      filters.push(`o.organization_type = $${values.length}`)
    }

    values.push(query.pageSize, (query.page - 1) * query.pageSize)
    const limitIndex = values.length - 1
    const offsetIndex = values.length
    const result = await this.database.query<OrganizationListRow>(
      `SELECT o.id, o.name, o.short_name AS "shortName", o.organization_type AS "organizationType",
              o.industry, o.region, o.address, o.status, o.notes, o.created_at AS "createdAt",
              owner.display_name AS "ownerName", parent.name AS "parentOrganizationName",
              primary_contact.id AS "primaryContactId", primary_contact.full_name AS "primaryContactName",
              primary_contact.mobile AS "primaryContactMobile",
              (SELECT COUNT(*)::int FROM contact_affiliations ca
               WHERE ca.organization_id = o.id AND ca.status = 'current' AND ca.deleted_at IS NULL) AS "contactCount",
              (SELECT COUNT(*)::int FROM business_item_organizations bio
               JOIN business_items bi ON bi.id = bio.business_item_id
               WHERE bio.organization_id = o.id AND bi.deleted_at IS NULL) AS "itemCount",
              COUNT(*) OVER()::int AS "totalCount"
       FROM organizations o
       LEFT JOIN users owner ON owner.id = o.owner_user_id
       LEFT JOIN organizations parent ON parent.id = o.parent_organization_id
       LEFT JOIN LATERAL (
         SELECT c.id, c.full_name, c.mobile
         FROM contact_affiliations ca
         JOIN contacts c ON c.id = ca.contact_id AND c.deleted_at IS NULL
         WHERE ca.organization_id = o.id AND ca.status = 'current' AND ca.deleted_at IS NULL
         ORDER BY ca.is_primary DESC, ca.updated_at DESC
         LIMIT 1
       ) primary_contact ON TRUE
       WHERE ${filters.join(' AND ')}
       ORDER BY CASE o.status WHEN 'key' THEN 1 WHEN 'following' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
                o.updated_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values,
    )
    const total = result.rows[0]?.totalCount || 0
    return { items: result.rows.map(({ totalCount: _total, ...row }) => row), meta: paginationMeta(total, query.page, query.pageSize) }
  }

  async get(user: AuthenticatedUser, id: string) {
    const organization = await this.database.query(
      `SELECT o.id, o.name, o.short_name AS "shortName", o.unified_social_credit_code AS "unifiedSocialCreditCode",
              o.organization_type AS "organizationType", o.industry, o.region, o.address, o.website, o.status,
              o.source, o.notes, o.parent_organization_id AS "parentOrganizationId", parent.name AS "parentOrganizationName",
              o.owner_user_id AS "ownerUserId", owner.display_name AS "ownerName",
              o.created_at AS "createdAt", o.updated_at AS "updatedAt"
       FROM organizations o
       LEFT JOIN organizations parent ON parent.id = o.parent_organization_id
       LEFT JOIN users owner ON owner.id = o.owner_user_id
       WHERE o.id = $1 AND o.department_id = $2 AND o.deleted_at IS NULL`,
      [id, user.departmentId],
    )
    if (!organization.rowCount) throw new NotFoundException('未找到甲方组织')

    const [units, contacts, recentItems] = await Promise.all([
      this.database.query(
        `SELECT id, parent_unit_id AS "parentUnitId", name, unit_type AS "unitType", is_active AS "isActive"
         FROM organization_units WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY name`,
        [id],
      ),
      this.database.query(
        `SELECT c.id, c.full_name AS "fullName", c.mobile, c.email, c.relationship_level AS "relationshipLevel",
                ca.id AS "affiliationId", ca.organization_unit_id AS "organizationUnitId", ou.name AS "organizationUnitName",
                ca.title, ca.relationship_role AS "relationshipRole", ca.is_primary AS "isPrimary", ca.status
         FROM contact_affiliations ca
         JOIN contacts c ON c.id = ca.contact_id AND c.deleted_at IS NULL
         LEFT JOIN organization_units ou ON ou.id = ca.organization_unit_id
         WHERE ca.organization_id = $1 AND ca.deleted_at IS NULL
         ORDER BY ca.status = 'current' DESC, ca.is_primary DESC, c.full_name`,
        [id],
      ),
      this.database.query(
        `SELECT bi.id, bi.item_type AS "itemType", bi.title, bi.status,
                COALESCE(bi.starts_at, bi.due_at, bi.created_at) AS "occurredAt"
         FROM business_item_organizations bio
         JOIN business_items bi ON bi.id = bio.business_item_id
         WHERE bio.organization_id = $1 AND bi.deleted_at IS NULL
         ORDER BY COALESCE(bi.starts_at, bi.due_at, bi.created_at) DESC LIMIT 20`,
        [id],
      ),
    ])
    return { ...organization.rows[0], units: units.rows, contacts: contacts.rows, recentItems: recentItems.rows }
  }

  async create(user: AuthenticatedUser, dto: CreateOrganizationDto, request?: Request) {
    const id = await this.database.transaction(async (client) => {
      if (dto.parentOrganizationId) await this.assertOrganization(client, user.departmentId, dto.parentOrganizationId)
      if (dto.ownerUserId) await this.assertUser(client, user.departmentId, dto.ownerUserId)

      const result = await client.query<{ id: string }>(
        `INSERT INTO organizations
          (department_id, parent_organization_id, name, short_name, unified_social_credit_code, organization_type,
           industry, region, address, website, status, owner_user_id, source, notes, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
         RETURNING id`,
        [
          user.departmentId, dto.parentOrganizationId || null, dto.name.trim(), dto.shortName?.trim() || null,
          dto.unifiedSocialCreditCode?.trim() || null, dto.organizationType, dto.industry?.trim() || null,
          dto.region?.trim() || null, dto.address?.trim() || null, dto.website?.trim() || null, dto.status,
          dto.ownerUserId || user.userId, dto.source?.trim() || null, dto.notes?.trim() || null, user.userId,
        ],
      )
      const id = result.rows[0].id
      await this.audit.log({ actor: user, action: 'organization.create', entityType: 'organization', entityId: id, changes: { name: dto.name }, request }, client)
      return id
    })
    return this.get(user, id)
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateOrganizationDto, request?: Request) {
    await this.get(user, id)
    await this.database.transaction(async (client) => {
      if (dto.parentOrganizationId) {
        if (dto.parentOrganizationId === id) throw new BadRequestException('组织不能将自己设为上级')
        await this.assertOrganization(client, user.departmentId, dto.parentOrganizationId)
      }
      if (dto.ownerUserId) await this.assertUser(client, user.departmentId, dto.ownerUserId)

      const columns: Record<string, unknown> = {
        name: dto.name?.trim(), short_name: dto.shortName?.trim(), parent_organization_id: dto.parentOrganizationId,
        unified_social_credit_code: dto.unifiedSocialCreditCode?.trim(), organization_type: dto.organizationType,
        industry: dto.industry?.trim(), region: dto.region?.trim(), address: dto.address?.trim(), website: dto.website?.trim(),
        status: dto.status, owner_user_id: dto.ownerUserId, source: dto.source?.trim(), notes: dto.notes?.trim(),
      }
      const entries = Object.entries(columns).filter(([, value]) => value !== undefined)
      if (entries.length) {
        const values = entries.map(([, value]) => value || null)
        values.push(user.userId, id, user.departmentId)
        await client.query(
          `UPDATE organizations SET ${entries.map(([column], index) => `${column} = $${index + 1}`).join(', ')},
                  updated_by = $${entries.length + 1}
           WHERE id = $${entries.length + 2} AND department_id = $${entries.length + 3} AND deleted_at IS NULL`,
          values,
        )
      }
      await this.audit.log({ actor: user, action: 'organization.update', entityType: 'organization', entityId: id, changes: dto as Record<string, unknown>, request }, client)
    })
    return this.get(user, id)
  }

  async remove(user: AuthenticatedUser, id: string, request?: Request) {
    await this.get(user, id)
    await this.database.transaction(async (client) => {
      await client.query(
        `UPDATE organizations SET deleted_at = NOW(), status = 'inactive', updated_by = $1
         WHERE id = $2 AND department_id = $3 AND deleted_at IS NULL`,
        [user.userId, id, user.departmentId],
      )
      await this.audit.log({ actor: user, action: 'organization.delete', entityType: 'organization', entityId: id, request }, client)
    })
    return { success: true }
  }

  async createUnit(user: AuthenticatedUser, organizationId: string, dto: CreateOrganizationUnitDto, request?: Request) {
    return this.database.transaction(async (client) => {
      await this.assertOrganization(client, user.departmentId, organizationId)
      if (dto.parentUnitId) {
        const parent = await client.query('SELECT id FROM organization_units WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL', [dto.parentUnitId, organizationId])
        if (!parent.rowCount) throw new BadRequestException('上级部门不属于当前组织')
      }
      const result = await client.query<{ id: string }>(
        `INSERT INTO organization_units
          (organization_id, parent_unit_id, name, unit_type, is_active, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
        [organizationId, dto.parentUnitId || null, dto.name.trim(), dto.unitType, dto.isActive, user.userId],
      )
      const id = result.rows[0].id
      await this.audit.log({ actor: user, action: 'organization_unit.create', entityType: 'organization_unit', entityId: id, changes: { organizationId, name: dto.name }, request }, client)
      return { id, ...dto, organizationId }
    })
  }

  private async assertOrganization(client: DatabaseClient, departmentId: string, id: string) {
    const result = await client.query('SELECT id FROM organizations WHERE id = $1 AND department_id = $2 AND deleted_at IS NULL', [id, departmentId])
    if (!result.rowCount) throw new BadRequestException('关联的甲方组织不存在或不可用')
  }

  private async assertUser(client: DatabaseClient, departmentId: string, id: string) {
    const result = await client.query('SELECT id FROM users WHERE id = $1 AND department_id = $2 AND status = $3', [id, departmentId, 'active'])
    if (!result.rowCount) throw new BadRequestException('负责人不存在或不可用')
  }
}

interface OrganizationListRow {
  id: string
  name: string
  shortName?: string
  totalCount: number
  [key: string]: unknown
}
