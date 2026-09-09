const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function main() {
  assert.equal(process.env.DB_NAME, 'business_management_test');
  assert.equal(process.env.DB_USER, 'business_test');
  const base = 'http://127.0.0.1:3000/api/v1';
  const run = `TEST Phase1 ${randomUUID()}`;
  const notes = '  验收标准：材料齐全，核对“引号”\n第二行：组织与人脉分别关联。\n';
  let lastLogin = 0, contactId, itemId, orgId, taskId;
  async function login(username) {
    const delay = 13000 - (Date.now() - lastLogin);
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    lastLogin = Date.now();
    const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password: process.env.QA_TEST_PASSWORD, clientLabel: 'phase1-regression' }) });
    assert.equal(response.status, 201, `login ${username}`);
    return response.json();
  }
  async function request(session, path, method = 'GET', body, expected = 200) {
    const response = await fetch(base + path, { method, headers: { authorization: `Bearer ${session.accessToken}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    assert.equal(response.status, expected, `${method} ${path}`);
    return response.json();
  }
  async function logout(session) { await request(session, '/auth/logout', 'POST', { refreshToken: session.refreshToken }, 201); }
  const owner = await login('qa_member_b');
  const orgs = await request(owner, '/organizations?pageSize=100');
  orgId = orgs.items.find(org => org.name === 'TEST Organization 000').id;
  const org2 = orgs.items.find(org => org.name === 'TEST Business department').id;
  const contact = await request(owner, '/contacts', 'POST', { fullName: run, mobile: '01000000000', visibility: 'private', affiliations: [{ organizationId: orgId }, { organizationId: org2 }] }, 201);
  contactId = contact.id;
  const item = await request(owner, '/business-items', 'POST', { itemType: 'visit', title: 'TEST Phase1 linked visit', startsAt: new Date().toISOString(), status: 'planned', organizationIds: [orgId], contactIds: [contactId] }, 201);
  itemId = item.id;
  assert.equal(item.contacts.some(c => c.id === contactId), true);
  assert.equal(item.relationSnapshot.contacts.some(c => c.id === contactId), true);
  await logout(owner);

  for (const username of ['qa_member_a', 'qa_readonly', 'qa_foreign', 'qa_manager', 'qa_admin']) {
    const session = await login(username);
    const elevated = ['qa_admin', 'qa_manager'].includes(username);
    const foreign = username === 'qa_foreign';
    const orgList = await request(session, '/organizations?pageSize=100');
    const contactList = await request(session, `/contacts?q=${encodeURIComponent(run)}`);
    const items = await request(session, '/business-items?pageSize=100');
    const filtered = await request(session, `/business-items?contactId=${contactId}`);
    const suggestions = await request(session, `/relation-suggestions?organizationId=${orgId}&contactId=${contactId}`);
    if (!elevated) {
      for (const data of [orgList, contactList, items, filtered, suggestions]) {
        assert.equal(JSON.stringify(data).includes(run), false, `${username} private name leakage`);
        assert.equal(JSON.stringify(data).includes(contactId), false, `${username} private ID leakage`);
      }
      assert.equal(filtered.items.length, 0);
      await request(session, `/contacts/${contactId}`, 'GET', undefined, 404);
    } else {
      assert.equal(contactList.items.some(c => c.id === contactId), true);
      assert.equal(filtered.items.some(i => i.id === itemId), true);
    }
    const org = await request(session, `/organizations/${orgId}`, 'GET', undefined, foreign ? 404 : 200);
    const detail = await request(session, `/business-items/${itemId}`, 'GET', undefined, foreign ? 404 : 200);
    if (!foreign) {
      assert.equal(org.contacts.some(c => c.id === contactId), elevated);
      assert.equal(detail.contacts.some(c => c.id === contactId), elevated);
      assert.equal(detail.relationSnapshot.contacts.some(c => c.id === contactId), elevated);
    }
    if (username === 'qa_member_a') {
      await request(session, '/business-items', 'POST', { itemType: 'task', title: run, dueAt: new Date().toISOString(), status: 'pending', contactIds: [contactId] }, 400);
      const task = await request(session, '/business-items', 'POST', { itemType: 'task', title: 'TEST notes ' + randomUUID(), content: notes, dueAt: new Date(Date.now() + 86400000).toISOString(), status: 'pending', isInternal: true }, 201);
      taskId = task.id;
      assert.equal(task.content, notes);
      assert.equal((await request(session, `/business-items/${taskId}`)).content, notes);
      const changed = await request(session, `/business-items/${taskId}`, 'PATCH', { status: 'completed' });
      assert.equal(changed.content, notes); assert.equal(changed.status, 'completed');
    }
    if (username === 'qa_readonly') {
      for (const path of ['/organizations', '/contacts', '/business-items']) {
        const id = path === '/organizations' ? orgId : path === '/contacts' ? contactId : taskId;
        await request(session, path, 'POST', {}, 403);
        await request(session, `${path}/${id}`, 'PATCH', {}, 403);
        await request(session, `${path}/${id}`, 'DELETE', undefined, 403);
      }
      await request(session, `/business-items/${taskId}/attachments`, 'POST', {}, 403);
      await request(session, `/contacts/${contactId}/affiliations`, 'POST', {}, 403);
      assert.equal((await request(session, `/business-items/${taskId}`)).content, notes);
    }
    if (username === 'qa_admin') {
      // Deletion must fail closed even when historical links still exist.
      await request(session, `/contacts/${contactId}`, 'DELETE');
      const deleted = await request(session, `/business-items/${itemId}`);
      assert.equal(deleted.contacts.some(c => c.id === contactId), false);
      assert.equal(JSON.stringify(deleted.relationSnapshot).includes(run), false);
    }
    await logout(session);
    console.log(JSON.stringify({ username, privacy: true, readonlyWrites: username === 'qa_readonly' ? 11 : undefined }));
  }
  const again = await login('qa_member_a');
  assert.equal((await request(again, `/business-items/${taskId}`)).content, notes);
  await logout(again);
  console.log(JSON.stringify({ result: 'PASS', run, taskId, itemId, checks: ['I01 live/list/detail/suggestions/filter/snapshots/department/deletion', 'I04 create/refetch/status-change/relogin', 'I15 readonly 11 mutations denied'], retained: 'Synthetic task and visit kept for inspection; test contact soft-deleted' }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
