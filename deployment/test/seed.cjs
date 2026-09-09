// Only synthetic data; never run against the production database.
const { Pool } = require('pg');
const { hash } = require('bcryptjs');
const { randomUUID } = require('node:crypto');

async function main() {
  if (process.env.DB_NAME !== 'business_management_test' || process.env.DB_USER !== 'business_test') throw new Error('Refusing non-test database');
  if (!process.env.QA_TEST_PASSWORD || process.env.QA_TEST_PASSWORD.length < 12) throw new Error('Missing test-only password');
  const pool = new Pool({ host: process.env.DB_HOST, port: 5432, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(2026090801)");
    const prior = await client.query("SELECT id FROM departments WHERE code='QA-A'");
    if (prior.rowCount) { console.log('QA fixtures already exist; no overwrite.'); await client.query('ROLLBACK'); return; }
    const deps = [randomUUID(), randomUUID(), randomUUID()];
    for (const [i, code] of ['QA-A','QA-B','QA-EMPTY'].entries()) await client.query('INSERT INTO departments(id,code,name) VALUES($1,$2,$3)', [deps[i],code,`TEST ONLY ${code}`]);
    const passwordHash = await hash(process.env.QA_TEST_PASSWORD, 12);
    const accounts = [['qa_admin','admin',0], ['qa_manager','manager',0], ['qa_member_a','member',0], ['qa_member_b','member',0], ['qa_readonly','readonly',0], ['qa_foreign','member',1], ['qa_empty','member',2]];
    const ids = {};
    for (const [name,role,dep] of accounts) {
      ids[name] = randomUUID();
      await client.query('INSERT INTO users(id,department_id,username,display_name,password_hash,role) VALUES($1,$2,$3,$4,$5,$6)', [ids[name],deps[dep],name,`TEST ${name}`,passwordHash,role]);
    }
    const owner = ids.qa_member_a;
    const orgs = [];
    for (let i=0; i<105; i++) {
      const id=randomUUID(); orgs.push(id);
      const parent=i===1?orgs[0]:i===2?orgs[1]:i===4?orgs[3]:null;
      const name=(i===1||i===4)?'TEST Business department':`TEST Organization ${String(i).padStart(3,'0')}`;
      await client.query('INSERT INTO organizations(id,department_id,parent_organization_id,name,organization_type,region,status,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)', [id,deps[0],parent,name,parent?'department':'company',i%3===0?null:i%2?'QA North':'QA South',i%5===0?'key':'normal',owner]);
    }
    const contact=randomUUID();
    await client.query("INSERT INTO contacts(id,department_id,full_name,visibility,owner_user_id,created_by,updated_by) VALUES($1,$2,'TEST Private B','private',$3,$3,$3)", [contact,deps[0],ids.qa_member_b]);
    for (const org of [orgs[0],orgs[1]]) await client.query('INSERT INTO contact_affiliations(contact_id,organization_id,title,created_by,updated_by) VALUES($1,$2,$3,$4,$4)',[contact,org,'TEST role',ids.qa_member_b]);
    for (const [i, status] of ['pending','in_progress','completed','overdue'].entries()) {
      await client.query("INSERT INTO business_items(department_id,item_type,title,content,due_at,status,is_internal,owner_user_id,completed_at,created_by,updated_by) VALUES($1,'task',$2,$3,NOW()+($4::int * INTERVAL '1 day'),$5,true,$6,CASE WHEN $5::varchar='completed' THEN NOW() ELSE NULL END,$6,$6)",[deps[0],`TEST task ${status}`,'TEST retained description\nSecond line',i-2,status,owner]);
    }
    const visit=randomUUID();
    await client.query("INSERT INTO business_items(id,department_id,item_type,title,starts_at,status,owner_user_id,created_by,updated_by) VALUES($1,$2,'visit','TEST private relation',NOW(),'planned',$3,$3,$3)",[visit,deps[0],ids.qa_member_b]);
    await client.query("INSERT INTO business_item_contacts(business_item_id,contact_id,snapshot,linked_by) VALUES($1,$2,$3::jsonb,$4)",[visit,contact,JSON.stringify({fullName:'TEST Private B'}),ids.qa_member_b]);
    await client.query('COMMIT');
    console.log(JSON.stringify({synthetic:true,departments:3,organizations:105,users:accounts.map(([username,role,department])=>({username,role,department})),privateContacts:1,tasks:4,visits:1}));
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
