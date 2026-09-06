CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id),
  username VARCHAR(80) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(120) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'member', 'readonly')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX users_username_lower_unique ON users (LOWER(username));
CREATE INDEX users_department_idx ON users (department_id) WHERE status = 'active';

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  client_label VARCHAR(120),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by UUID REFERENCES refresh_tokens(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX refresh_tokens_user_active_idx ON refresh_tokens (user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id),
  parent_organization_id UUID REFERENCES organizations(id),
  name VARCHAR(240) NOT NULL,
  short_name VARCHAR(100),
  unified_social_credit_code VARCHAR(32),
  organization_type VARCHAR(30) NOT NULL DEFAULT 'company'
    CHECK (organization_type IN ('company', 'subsidiary', 'government', 'institution', 'other')),
  industry VARCHAR(120),
  region VARCHAR(160),
  address VARCHAR(500),
  website VARCHAR(300),
  status VARCHAR(30) NOT NULL DEFAULT 'normal'
    CHECK (status IN ('key', 'following', 'normal', 'inactive')),
  owner_user_id UUID REFERENCES users(id),
  source VARCHAR(120),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX organizations_department_name_unique
  ON organizations (department_id, LOWER(name)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX organizations_credit_code_unique
  ON organizations (unified_social_credit_code) WHERE unified_social_credit_code IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX organizations_department_status_idx ON organizations (department_id, status) WHERE deleted_at IS NULL;
CREATE INDEX organizations_parent_idx ON organizations (parent_organization_id) WHERE deleted_at IS NULL;

CREATE TABLE organization_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  parent_unit_id UUID REFERENCES organization_units(id),
  name VARCHAR(160) NOT NULL,
  unit_type VARCHAR(30) NOT NULL DEFAULT 'department'
    CHECK (unit_type IN ('department', 'branch', 'team', 'other')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX organization_units_name_unique
  ON organization_units (organization_id, COALESCE(parent_unit_id, '00000000-0000-0000-0000-000000000000'::uuid), LOWER(name))
  WHERE deleted_at IS NULL;
CREATE INDEX organization_units_org_idx ON organization_units (organization_id) WHERE deleted_at IS NULL;

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id),
  full_name VARCHAR(120) NOT NULL,
  gender VARCHAR(20),
  mobile VARCHAR(40),
  phone VARCHAR(60),
  email VARCHAR(240),
  wechat VARCHAR(120),
  city VARCHAR(120),
  tags TEXT[] NOT NULL DEFAULT '{}',
  source VARCHAR(120),
  relationship_level VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (relationship_level IN ('key', 'important', 'normal', 'new')),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('provisional', 'active', 'inactive')),
  visibility VARCHAR(20) NOT NULL DEFAULT 'department'
    CHECK (visibility IN ('department', 'private')),
  owner_user_id UUID REFERENCES users(id),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX contacts_department_name_idx ON contacts (department_id, LOWER(full_name)) WHERE deleted_at IS NULL;
CREATE INDEX contacts_mobile_idx ON contacts (mobile) WHERE mobile IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX contacts_tags_idx ON contacts USING GIN (tags) WHERE deleted_at IS NULL;

CREATE TABLE contact_affiliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  organization_unit_id UUID REFERENCES organization_units(id),
  title VARCHAR(160),
  relationship_role VARCHAR(120),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'current' CHECK (status IN ('current', 'historical')),
  start_date DATE,
  end_date DATE,
  source VARCHAR(120),
  confidence SMALLINT NOT NULL DEFAULT 80 CHECK (confidence BETWEEN 0 AND 100),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX contact_affiliations_contact_idx ON contact_affiliations (contact_id, status) WHERE deleted_at IS NULL;
CREATE INDEX contact_affiliations_org_idx ON contact_affiliations (organization_id, status) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX contact_affiliations_one_primary_idx ON contact_affiliations (contact_id)
  WHERE is_primary = TRUE AND status = 'current' AND deleted_at IS NULL;

CREATE TABLE business_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id),
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('visit', 'task')),
  title VARCHAR(300) NOT NULL,
  content TEXT,
  result TEXT,
  location VARCHAR(500),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL,
  priority VARCHAR(20) CHECK (priority IS NULL OR priority IN ('high', 'medium', 'low')),
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  source_item_id UUID REFERENCES business_items(id),
  participant_names TEXT[] NOT NULL DEFAULT '{}',
  details JSONB NOT NULL DEFAULT '{}',
  relation_snapshot JSONB NOT NULL DEFAULT '{"organizations":[],"contacts":[]}',
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX business_items_department_type_idx ON business_items (department_id, item_type, starts_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX business_items_owner_status_idx ON business_items (owner_user_id, status, due_at) WHERE deleted_at IS NULL;
CREATE INDEX business_items_details_idx ON business_items USING GIN (details) WHERE deleted_at IS NULL;

CREATE TABLE business_item_organizations (
  business_item_id UUID NOT NULL REFERENCES business_items(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  relation_role VARCHAR(30) NOT NULL DEFAULT 'related' CHECK (relation_role IN ('primary', 'related')),
  snapshot JSONB NOT NULL,
  linked_by UUID NOT NULL REFERENCES users(id),
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_item_id, organization_id)
);
CREATE INDEX business_item_organizations_org_idx ON business_item_organizations (organization_id, linked_at DESC);

CREATE TABLE business_item_contacts (
  business_item_id UUID NOT NULL REFERENCES business_items(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  relation_role VARCHAR(30) NOT NULL DEFAULT 'participant' CHECK (relation_role IN ('primary', 'participant', 'related')),
  snapshot JSONB NOT NULL,
  linked_by UUID NOT NULL REFERENCES users(id),
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_item_id, contact_id)
);
CREATE INDEX business_item_contacts_contact_idx ON business_item_contacts (contact_id, linked_at DESC);

CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_item_id UUID NOT NULL REFERENCES business_items(id),
  uploader_user_id UUID NOT NULL REFERENCES users(id),
  object_key VARCHAR(600) NOT NULL UNIQUE,
  file_name VARCHAR(300) NOT NULL,
  mime_type VARCHAR(160) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  checksum_sha256 CHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX attachments_item_idx ON attachments (business_item_id, created_at DESC) WHERE status = 'active';

CREATE TABLE audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  department_id UUID REFERENCES departments(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID,
  changes JSONB NOT NULL DEFAULT '{}',
  ip_address INET,
  user_agent VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX audit_logs_department_idx ON audit_logs (department_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER departments_set_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER organizations_set_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER organization_units_set_updated_at BEFORE UPDATE ON organization_units FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER contacts_set_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER contact_affiliations_set_updated_at BEFORE UPDATE ON contact_affiliations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER business_items_set_updated_at BEFORE UPDATE ON business_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION validate_affiliation_unit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_unit_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM organization_units u
    WHERE u.id = NEW.organization_unit_id
      AND u.organization_id = NEW.organization_id
      AND u.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION '联系人任职部门不属于所选组织';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contact_affiliations_validate_unit
BEFORE INSERT OR UPDATE OF organization_id, organization_unit_id ON contact_affiliations
FOR EACH ROW EXECUTE FUNCTION validate_affiliation_unit();

CREATE OR REPLACE FUNCTION ensure_business_item_has_relation(item_id UUID)
RETURNS VOID AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM business_items i
    WHERE i.id = item_id AND i.deleted_at IS NULL AND i.is_internal = FALSE
  ) AND NOT EXISTS (
    SELECT 1 FROM business_item_organizations io WHERE io.business_item_id = item_id
    UNION ALL
    SELECT 1 FROM business_item_contacts ic WHERE ic.business_item_id = item_id
  ) THEN
    RAISE EXCEPTION '外部事项必须至少关联一个甲方组织或联系人';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_business_item_relation_from_item()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM ensure_business_item_has_relation(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_business_item_relation_from_org_link()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM ensure_business_item_has_relation(COALESCE(NEW.business_item_id, OLD.business_item_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_business_item_relation_from_contact_link()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM ensure_business_item_has_relation(COALESCE(NEW.business_item_id, OLD.business_item_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER business_items_require_relation
AFTER INSERT OR UPDATE OF is_internal, deleted_at ON business_items
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_business_item_relation_from_item();

CREATE CONSTRAINT TRIGGER business_item_org_links_require_relation
AFTER INSERT OR UPDATE OR DELETE ON business_item_organizations
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_business_item_relation_from_org_link();

CREATE CONSTRAINT TRIGGER business_item_contact_links_require_relation
AFTER INSERT OR UPDATE OR DELETE ON business_item_contacts
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_business_item_relation_from_contact_link();
