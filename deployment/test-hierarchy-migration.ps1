param([Parameter(Mandatory=$true)][pscredential]$Credential)
$ErrorActionPreference = 'Stop'
$auditSchema = 'bam_audit_' + [guid]::NewGuid().ToString('N')
$projectRoot = Split-Path $PSScriptRoot -Parent
$sql = "BEGIN; SET LOCAL lock_timeout = '3s'; CREATE SCHEMA $auditSchema; SET LOCAL search_path = $auditSchema, public;`n"
foreach ($file in @('001_v0.2.0_core.sql', '002_v0.2.0_account_security.sql', '003_organization_hierarchy.sql')) {
  $sql += [IO.File]::ReadAllText((Join-Path $projectRoot "server/migrations/$file")) + "`n"
}
$sql += @'
DO $$
DECLARE d uuid; d2 uuid; u uuid; a uuid; b uuid; c uuid;
BEGIN
  INSERT INTO departments(code,name) VALUES ('AUDIT','Audit only') RETURNING id INTO d;
  INSERT INTO users(department_id,username,display_name,password_hash,role)
    VALUES(d,'audit','Audit','not-a-login-hash','admin') RETURNING id INTO u;
  INSERT INTO organizations(department_id,name,created_by,updated_by)
    VALUES(d,'Company A',u,u) RETURNING id INTO a;
  INSERT INTO organizations(department_id,name,created_by,updated_by)
    VALUES(d,'Company B',u,u) RETURNING id INTO b;
  INSERT INTO organizations(department_id,parent_organization_id,name,organization_type,created_by,updated_by)
    VALUES(d,a,'Business department','department',u,u) RETURNING id INTO c;
  INSERT INTO organizations(department_id,parent_organization_id,name,organization_type,created_by,updated_by)
    VALUES(d,b,'Business department','department',u,u);
  INSERT INTO organizations(department_id,parent_organization_id,name,organization_type,created_by,updated_by)
    VALUES(d,c,'Business team','department',u,u);
  BEGIN
    INSERT INTO organizations(department_id,parent_organization_id,name,organization_type,created_by,updated_by)
      VALUES(d,a,'Business department','department',u,u);
    RAISE EXCEPTION 'Duplicate siblings incorrectly accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    UPDATE organizations SET parent_organization_id = id WHERE id = a;
    RAISE EXCEPTION 'Self parent incorrectly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE organizations SET parent_organization_id = NULL WHERE id = c;
  INSERT INTO departments(code,name) VALUES ('AUDIT2','Other audit department') RETURNING id INTO d2;
  BEGIN
    INSERT INTO organizations(department_id,parent_organization_id,name,created_by,updated_by)
      VALUES(d2,a,'Cross department parent',u,u);
    RAISE EXCEPTION 'Cross department parent incorrectly accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  IF (SELECT parent_organization_id FROM organizations WHERE id=c) IS NOT NULL THEN
    RAISE EXCEPTION 'Detach failed';
  END IF;
  RAISE NOTICE 'PASS: migrations, department type, three levels, sibling uniqueness, self parent, detach, cross department parent';
END $$;
ROLLBACK;
'@
Invoke-Command -ComputerName 192.168.0.253 -Credential $Credential -ArgumentList $sql -ScriptBlock {
  param($AuditSql)
  $OutputEncoding = [Text.UTF8Encoding]::new($false)
  $AuditSql | docker exec -i business-management-db-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' 2>&1 | ForEach-Object { "$_" }
  if ($LASTEXITCODE -ne 0) { throw 'Isolated schema migration test failed; connection rollback applies.' }
}
