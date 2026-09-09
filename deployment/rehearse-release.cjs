const {Pool}=require('pg');
async function rehearse(migrations){
 if(!process.env.DB_NAME.startsWith('business_releasecheck_'))throw Error('Rehearsal database guard');
 const pool=new Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const applied=new Set((await client.query('SELECT version FROM schema_migrations')).rows.map(x=>x.version));
  for(const m of migrations)if(!applied.has(m.version)){await client.query(m.sql);await client.query('INSERT INTO schema_migrations(version) VALUES ($1)',[m.version]);}
  await client.query('COMMIT');
  const versions=(await client.query('SELECT version FROM schema_migrations ORDER BY version')).rows;
  const counts={};for(const table of ['users','organizations','contacts','business_items','attachments'])counts[table]=Number((await client.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);
  console.log(JSON.stringify({rehearsal:true,versions,counts}));
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release();await pool.end()}
}
