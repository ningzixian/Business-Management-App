// Executed inside the business API container; never prints credentials or business rows.
const {Pool}=require('pg'),fs=require('fs');
const pool=new Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
(async()=>{try{
 const versions=(await pool.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map(x=>x.version);
 const counts={};for(const table of ['users','organizations','contacts','business_items','attachments'])counts[table]=Number((await pool.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);
 const selfParent=Number((await pool.query('SELECT count(*) AS n FROM organizations WHERE parent_organization_id=id')).rows[0].n);
 const crossParent=Number((await pool.query('SELECT count(*) AS n FROM organizations o JOIN organizations p ON p.id=o.parent_organization_id WHERE o.department_id<>p.department_id')).rows[0].n);
 if(selfParent||crossParent)throw Error('Organization data violates new parent constraints');
 console.log(JSON.stringify({versions,counts,selfParent,crossParent}));
}finally{await pool.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});
