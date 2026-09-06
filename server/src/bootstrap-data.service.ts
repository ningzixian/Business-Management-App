import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { hash } from 'bcryptjs'
import type { AppEnvironment } from './config/environment'
import { DatabaseService } from './database/database.service'

const DEPARTMENT_ID = '10000000-0000-4000-8000-000000000001'
const ADMIN_ID = '20000000-0000-4000-8000-000000000001'

const organizationSeeds = [
  ['30000000-0000-4000-8000-000000000001', '华东智造科技有限公司', '华东智造', '智能制造', '上海 · 浦东新区', '上海市浦东新区世纪大道100号', 'key', '#0d6efd'],
  ['30000000-0000-4000-8000-000000000002', '上海优品贸易有限公司', '优品贸易', '商贸零售', '上海 · 静安区', '上海市静安区南京西路688号', 'following', '#16a36a'],
  ['30000000-0000-4000-8000-000000000003', '苏州智造企业服务有限公司', '苏州智造', '企业服务', '苏州 · 工业园区', '苏州市工业园区星湖街328号', 'normal', '#8c6ad8'],
  ['30000000-0000-4000-8000-000000000004', '杭州云创信息技术有限公司', '杭州云创', '软件信息', '杭州 · 滨江区', '杭州市滨江区江南大道588号', 'normal', '#ee8a21'],
  ['30000000-0000-4000-8000-000000000005', '嘉兴启航新材料有限公司', '嘉兴启航', '新材料', '嘉兴 · 南湖区', '嘉兴市南湖区亚太路778号', 'normal', '#596bc8'],
  ['30000000-0000-4000-8000-000000000006', '无锡领创自动化有限公司', '无锡领创', '工业自动化', '无锡 · 新吴区', '无锡市新吴区菱湖大道200号', 'normal', '#0f8ca8'],
  ['30000000-0000-4000-8000-000000000007', '南京聚力电子有限公司', '南京聚力', '电子制造', '南京 · 雨花台区', '南京市雨花台区软件大道180号', 'following', '#0f8ca8'],
  ['30000000-0000-4000-8000-000000000008', '宁波远航供应链有限公司', '宁波远航', '物流供应链', '宁波 · 鄞州区', '宁波市鄞州区宁东路269号', 'normal', '#dc5a5a'],
] as const

const contactSeeds = [
  ['40000000-0000-4000-8000-000000000001', '张经理', '13800008888', '30000000-0000-4000-8000-000000000001', '数字化平台主管', '决策影响人'],
  ['40000000-0000-4000-8000-000000000002', '李总', '13600002710', '30000000-0000-4000-8000-000000000002', '总经理', '决策人'],
  ['40000000-0000-4000-8000-000000000003', '王经理', '13900005192', '30000000-0000-4000-8000-000000000003', '采购经理', '关键联系人'],
  ['40000000-0000-4000-8000-000000000004', '陈经理', '13700006320', '30000000-0000-4000-8000-000000000004', '技术经理', '技术影响人'],
  ['40000000-0000-4000-8000-000000000005', '赵经理', '13300008621', '30000000-0000-4000-8000-000000000005', '采购经理', '关键联系人'],
  ['40000000-0000-4000-8000-000000000006', '顾经理', '13100005407', '30000000-0000-4000-8000-000000000006', '项目经理', '执行联系人'],
  ['40000000-0000-4000-8000-000000000007', '周总', '13500004056', '30000000-0000-4000-8000-000000000007', '总经理', '决策人'],
  ['40000000-0000-4000-8000-000000000008', '孙经理', '13200001785', '30000000-0000-4000-8000-000000000008', '运营经理', '关键联系人'],
] as const

const visitSeeds = [
  ['50000000-0000-4000-8000-000000000001', 0, '了解产线数字化现状与实施计划', '了解产线数字化现状，沟通设备管理平台实施范围与交付计划。', '客户认可一期方案，要求下周提交项目排期及正式报价。', '2026-09-04T09:30:00+08:00', '2026-09-04T10:30:00+08:00', 'completed', ['张伟', '李明']],
  ['50000000-0000-4000-8000-000000000002', 1, '季度合作复盘与促销资源确认', '季度合作复盘，确认国庆档促销资源与补货节奏。', '已完成初步资源确认，待补充渠道销售预测。', '2026-09-04T11:00:00+08:00', '2026-09-04T12:00:00+08:00', 'in_progress', ['李明', '王佳']],
  ['50000000-0000-4000-8000-000000000003', 2, '产品方案演示及采购需求澄清', '产品方案演示及采购需求澄清。', '待拜访后填写。', '2026-09-04T14:00:00+08:00', '2026-09-04T15:30:00+08:00', 'planned', ['王佳']],
  ['50000000-0000-4000-8000-000000000004', 3, '售后回访及二期接口确认', '售后问题回访并确认二期接口清单。', '待拜访后填写。', '2026-09-04T16:00:00+08:00', '2026-09-04T17:00:00+08:00', 'planned', ['陈超', '张伟']],
  ['50000000-0000-4000-8000-000000000005', 4, '新材料试用反馈与采购计划', '确认新材料试用反馈及下一批采购计划。', '待拜访后填写。', '2026-09-04T17:30:00+08:00', '2026-09-04T18:20:00+08:00', 'planned', ['刘总', '王佳']],
  ['50000000-0000-4000-8000-000000000006', 5, '自动化改造项目运行回访', '远程回访自动化改造项目运行情况。', '待拜访后填写。', '2026-09-04T19:00:00+08:00', '2026-09-04T19:45:00+08:00', 'planned', ['张伟']],
  ['50000000-0000-4000-8000-000000000007', 6, '年度框架合作意向沟通', '年度框架合作意向沟通。', '待拜访后填写。', '2026-09-05T10:00:00+08:00', '2026-09-05T11:00:00+08:00', 'planned', ['刘总', '李明']],
  ['50000000-0000-4000-8000-000000000008', 7, '运输可视化项目需求确认', '运输可视化项目需求确认。', '补充跨境线路数据后再次评估。', '2026-09-03T15:00:00+08:00', '2026-09-03T16:20:00+08:00', 'postponed', ['张伟']],
] as const

const taskSeeds = [
  ['60000000-0000-4000-8000-000000000001', 0, '提交华东智造项目排期及正式报价', '2026-09-04T17:30:00+08:00', 'high', 'in_progress', '50000000-0000-4000-8000-000000000001'],
  ['60000000-0000-4000-8000-000000000002', 1, '补充优品贸易渠道销售预测表', '2026-09-05T12:00:00+08:00', 'medium', 'pending', '50000000-0000-4000-8000-000000000002'],
  ['60000000-0000-4000-8000-000000000003', 2, '准备苏州智造产品演示环境', '2026-09-04T13:00:00+08:00', 'high', 'overdue', '50000000-0000-4000-8000-000000000003'],
  ['60000000-0000-4000-8000-000000000004', 3, '确认杭州云创二期接口清单', '2026-09-06T18:00:00+08:00', 'medium', 'pending', '50000000-0000-4000-8000-000000000004'],
  ['60000000-0000-4000-8000-000000000006', 6, '更新南京聚力年度合作建议书', '2026-09-07T18:00:00+08:00', 'medium', 'completed', '50000000-0000-4000-8000-000000000007'],
] as const

@Injectable()
export class BootstrapDataService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapDataService.name)

  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly database: DatabaseService,
  ) {}

  async onApplicationBootstrap() {
    if (!this.config.get('SEED_INITIAL_DATA', { infer: true })) return
    await this.seed()
  }

  private async seed() {
    const username = this.config.get('INITIAL_ADMIN_USERNAME', { infer: true })
    const passwordHash = await hash(this.config.get('INITIAL_ADMIN_PASSWORD', { infer: true }), 12)

    await this.database.transaction(async (client) => {
      await client.query(
        `INSERT INTO departments (id, code, name) VALUES ($1, 'BUSINESS', '商务部门')
         ON CONFLICT (id) DO NOTHING`,
        [DEPARTMENT_ID],
      )
      await client.query(
        `INSERT INTO users (id, department_id, username, display_name, password_hash, role)
         VALUES ($1, $2, $3, '系统管理员', $4, 'admin')
         ON CONFLICT DO NOTHING`,
        [ADMIN_ID, DEPARTMENT_ID, username, passwordHash],
      )

      const admin = await client.query<{ id: string }>('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username])
      const adminId = admin.rows[0]?.id
      if (!adminId) throw new Error('无法创建或找到初始管理员')

      for (const org of organizationSeeds) {
        await client.query(
          `INSERT INTO organizations
            (id, department_id, name, short_name, industry, region, address, status, owner_user_id, source, notes, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'v0.1.1 原型迁移', $10, $9, $9)
           ON CONFLICT (id) DO NOTHING`,
          [org[0], DEPARTMENT_ID, org[1], org[2], org[3], org[4], org[5], org[6], adminId, JSON.stringify({ color: org[7] })],
        )
      }

      for (const contact of contactSeeds) {
        await client.query(
          `INSERT INTO contacts
            (id, department_id, full_name, mobile, relationship_level, status, source, owner_user_id, created_by, updated_by)
           VALUES ($1, $2, $3, $4, 'normal', 'active', 'v0.1.1 原型迁移', $5, $5, $5)
           ON CONFLICT (id) DO NOTHING`,
          [contact[0], DEPARTMENT_ID, contact[1], contact[2], adminId],
        )
        await client.query(
          `INSERT INTO contact_affiliations
            (contact_id, organization_id, title, relationship_role, is_primary, source, confidence, created_by, updated_by)
           VALUES ($1, $2, $3, $4, TRUE, 'v0.1.1 原型迁移', 80, $5, $5)
           ON CONFLICT DO NOTHING`,
          [contact[0], contact[3], contact[4], contact[5], adminId],
        )
      }

      const itemCount = await client.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM business_items WHERE department_id = $1',
        [DEPARTMENT_ID],
      )
      if (Number(itemCount.rows[0].count) === 0) {
        for (const visit of visitSeeds) {
          const org = organizationSeeds[visit[1]]
          const contact = contactSeeds[visit[1]]
          const snapshot = this.relationSnapshot(org, contact)
          await client.query(
            `INSERT INTO business_items
              (id, department_id, item_type, title, content, result, location, starts_at, ends_at, status,
               owner_user_id, participant_names, details, relation_snapshot, completed_at, created_by, updated_by)
             VALUES ($1, $2, 'visit', $3, $4, $5, $6, $7, $8, $9::varchar, $10, $11, $12::jsonb, $13::jsonb,
                     CASE WHEN $9::varchar = 'completed' THEN $8::timestamptz ELSE NULL END, $10, $10)`,
            [
              visit[0], DEPARTMENT_ID, visit[2], visit[3], visit[4], org[5], visit[5], visit[6], visit[7], adminId,
              visit[8], JSON.stringify({ color: org[7], migratedFrom: 'v0.1.1' }), JSON.stringify(snapshot),
            ],
          )
          await this.linkItem(client, visit[0], org, contact, adminId)
        }

        for (const task of taskSeeds) {
          const org = organizationSeeds[task[1]]
          const contact = contactSeeds[task[1]]
          const snapshot = this.relationSnapshot(org, contact)
          await client.query(
            `INSERT INTO business_items
              (id, department_id, item_type, title, due_at, status, priority, owner_user_id, source_item_id,
               details, relation_snapshot, completed_at, created_by, updated_by)
             VALUES ($1, $2, 'task', $3, $4, $5::varchar, $6, $7, $8, $9::jsonb, $10::jsonb,
                     CASE WHEN $5::varchar = 'completed' THEN NOW() ELSE NULL END, $7, $7)`,
            [task[0], DEPARTMENT_ID, task[2], task[3], task[5], task[4], adminId, task[6], JSON.stringify({ migratedFrom: 'v0.1.1' }), JSON.stringify(snapshot)],
          )
          await this.linkItem(client, task[0], org, contact, adminId)
        }

        await client.query(
          `INSERT INTO business_items
            (id, department_id, item_type, title, due_at, status, priority, is_internal, owner_user_id,
             details, created_by, updated_by)
           VALUES ('60000000-0000-4000-8000-000000000005', $1, 'task', '整理八月部门客户拜访周报',
                   '2026-09-03T18:00:00+08:00', 'overdue', 'low', TRUE, $2, '{"migratedFrom":"v0.1.1"}', $2, $2)`,
          [DEPARTMENT_ID, adminId],
        )
      }
    })
    this.logger.log('v0.2.0 初始部门、管理员与演示业务数据已校验')
  }

  private relationSnapshot(org: typeof organizationSeeds[number], contact: typeof contactSeeds[number]) {
    return {
      organizations: [{ id: org[0], name: org[1], shortName: org[2] }],
      contacts: [{ id: contact[0], fullName: contact[1], mobile: contact[2], affiliation: { organizationId: org[0], organizationName: org[1], title: contact[4] } }],
    }
  }

  private async linkItem(
    client: { query: (text: string, values?: unknown[]) => Promise<unknown> },
    itemId: string,
    org: typeof organizationSeeds[number],
    contact: typeof contactSeeds[number],
    adminId: string,
  ) {
    const snapshot = this.relationSnapshot(org, contact)
    await client.query(
      `INSERT INTO business_item_organizations (business_item_id, organization_id, relation_role, snapshot, linked_by)
       VALUES ($1, $2, 'primary', $3::jsonb, $4)`,
      [itemId, org[0], JSON.stringify(snapshot.organizations[0]), adminId],
    )
    await client.query(
      `INSERT INTO business_item_contacts (business_item_id, contact_id, relation_role, snapshot, linked_by)
       VALUES ($1, $2, 'primary', $3::jsonb, $4)`,
      [itemId, contact[0], JSON.stringify(snapshot.contacts[0]), adminId],
    )
  }
}
