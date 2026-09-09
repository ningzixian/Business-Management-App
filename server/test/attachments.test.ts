import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { attachmentTypes, cleanAttachmentName } from '../src/attachments/file-policy'
import { AttachmentsService } from '../src/attachments/attachments.service'

test('附件名称保留中文、清除路径控制字符；拒绝 SVG/HTML/可执行类型', () => {
  assert.equal(cleanAttachmentName('../目录/报告.pdf'), '报告.pdf')
  assert.equal(cleanAttachmentName('C:\\temp\\报告.pdf'), '报告.pdf')
  assert.equal(cleanAttachmentName(Buffer.from('报告.pdf').toString('latin1')), '报告.pdf')
  assert.equal(cleanAttachmentName(''), '附件')
  for (const mime of ['image/svg+xml','text/html','application/x-msdownload']) assert.equal(attachmentTypes.has(mime), false)
  for (const mime of ['image/png','application/pdf','audio/wav']) assert.equal(attachmentTypes.has(mime), true)
})

function cleaner(active: boolean, fail: boolean) {
  const calls: string[] = []
  const database = { transaction: async (fn: Function) => fn({ query: async (sql: string) => {
    calls.push(sql)
    if (sql.startsWith('SELECT object_key')) return { rows:[{objectKey:'qa/key'}], rowCount:1 }
    if (sql.startsWith('SELECT id')) return {rows:[],rowCount:active?1:0}
    return {rows:[],rowCount:1}
  } }) }
  const storage = { isDisabled:()=>false, removeObject:async()=> {calls.push('REMOVE');if(fail)throw Error('offline')} }
  const service = new AttachmentsService(database as never, storage as never, {} as never)
  return {service,calls}
}
test('清理遇到活跃附件元数据绝不删除对象', async () => {
  const {service,calls}=cleaner(true,false);await service.cleanup()
  assert.ok(!calls.includes('REMOVE'));assert.ok(calls.some(c=>c.startsWith('DELETE FROM attachment_cleanup_jobs')))
})
test('存储删除失败保留持久化清理任务并延迟重试', async () => {
  const {service,calls}=cleaner(false,true);await service.cleanup()
  assert.ok(calls.includes('REMOVE'));assert.ok(calls.some(c=>c.includes('attempts = attempts + 1')))
  assert.ok(!calls.some(c=>c.startsWith('DELETE FROM attachment_cleanup_jobs')))
})
test('孤立对象删除成功后才删除清理任务', async () => {
  const {service,calls}=cleaner(false,false);await service.cleanup()
  assert.ok(calls.indexOf('REMOVE')<calls.findIndex(c=>c.startsWith('DELETE FROM attachment_cleanup_jobs')))
})
test('空附件和超限附件在任何存储操作前拒绝', async () => {
  const service = new AttachmentsService({} as never,{maxUploadBytes:()=>10} as never,{} as never)
  await assert.rejects(service.upload({} as never,'i',undefined),/请选择/)
  for (const size of [0,11]) await assert.rejects(service.upload({} as never,'i',{size} as Express.Multer.File),/附件为空或超过/)
})
