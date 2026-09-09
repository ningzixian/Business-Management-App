-- Keep organizations and contacts independent. Departments are organization nodes.
ALTER TABLE organizations DROP CONSTRAINT organizations_organization_type_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_organization_type_check
  CHECK (organization_type IN ('company', 'subsidiary', 'department', 'government', 'institution', 'other'));
ALTER TABLE organizations ADD CONSTRAINT organizations_not_self_parent
  CHECK (parent_organization_id IS DISTINCT FROM id);
ALTER TABLE organizations ADD CONSTRAINT organizations_id_department_unique UNIQUE (id, department_id);
ALTER TABLE organizations ADD CONSTRAINT organizations_parent_same_department
  FOREIGN KEY (parent_organization_id, department_id) REFERENCES organizations(id, department_id);

-- Allow common department names under different parents, but not duplicate siblings.
DROP INDEX organizations_department_name_unique;
CREATE UNIQUE INDEX organizations_sibling_name_unique
  ON organizations (department_id, COALESCE(parent_organization_id, '00000000-0000-0000-0000-000000000000'::uuid), LOWER(name))
  WHERE deleted_at IS NULL;
