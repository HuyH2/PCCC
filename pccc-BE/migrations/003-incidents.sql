-- Additive M09 migration. openDatabase applies this file in its existing
-- BEGIN IMMEDIATE transaction and records schema_migrations atomically.
-- Q11/Q12 remain unapproved: catalog, warning and upload values below are
-- editable DEMO configuration, not official classifications or legal deadlines.
CREATE TABLE incident_types (
  code TEXT PRIMARY KEY NOT NULL CHECK(length(code) BETWEEN 1 AND 50),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 150),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  configuration_label TEXT NOT NULL DEFAULT 'DEMO_UNCONFIRMED_Q11_Q12'
);
CREATE TABLE incident_subtypes (
  type_code TEXT NOT NULL REFERENCES incident_types(code),
  code TEXT NOT NULL CHECK(length(code) BETWEEN 1 AND 50),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 150),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  PRIMARY KEY(type_code,code)
);
INSERT INTO incident_types(code,name) VALUES
  ('FIRE','Cháy (cấu hình demo)'),
  ('EXPLOSION','Nổ (cấu hình demo)'),
  ('RESCUE','Cứu nạn, cứu hộ (cấu hình demo)'),
  ('MEDICAL','Hỗ trợ y tế (cấu hình demo)');

CREATE TABLE incident_policy (
  id INTEGER PRIMARY KEY CHECK(id=1),
  warning_hours INTEGER NOT NULL DEFAULT 48 CHECK(typeof(warning_hours)='integer' AND warning_hours BETWEEN 0 AND 8760),
  require_document_completion INTEGER NOT NULL DEFAULT 0 CHECK(require_document_completion IN (0,1)),
  max_upload_bytes INTEGER NOT NULL DEFAULT 5242880 CHECK(typeof(max_upload_bytes)='integer' AND max_upload_bytes BETWEEN 1 AND 52428800),
  allowed_extensions TEXT NOT NULL DEFAULT '["pdf","png","jpg","jpeg","txt"]' CHECK(json_valid(allowed_extensions) AND json_type(allowed_extensions)='array'),
  configuration_label TEXT NOT NULL DEFAULT 'DEMO_UNCONFIRMED_Q11_Q12',
  updated_by TEXT REFERENCES accounts(id),
  updated_at INTEGER NOT NULL DEFAULT 0 CHECK(typeof(updated_at)='integer' AND updated_at>=0)
);
INSERT INTO incident_policy(id) VALUES (1);

CREATE TABLE incidents (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 128),
  incident_code TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(incident_code)) BETWEEN 1 AND 60),
  incident_type TEXT REFERENCES incident_types(code),
  incident_subtype TEXT,
  title TEXT NOT NULL DEFAULT '' CHECK(length(title)<=250),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=10000),
  occurred_at INTEGER CHECK(occurred_at IS NULL OR (typeof(occurred_at)='integer' AND occurred_at>=0)),
  reported_at INTEGER NOT NULL CHECK(typeof(reported_at)='integer' AND reported_at>=0),
  address TEXT NOT NULL DEFAULT '' CHECK(length(address)<=1000),
  scene_details TEXT NOT NULL DEFAULT '' CHECK(length(scene_details)<=20000),
  region_id TEXT REFERENCES regions(id),
  unit_id TEXT REFERENCES units(id),
  facility_id TEXT REFERENCES facilities(id),
  record_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(record_status IN ('DRAFT','OFFICIAL')),
  processing_status TEXT NOT NULL DEFAULT 'NEW' CHECK(processing_status IN ('NEW','IN_PROGRESS','COMPLETED','CLOSED')),
  deadline_at INTEGER CHECK(deadline_at IS NULL OR (typeof(deadline_at)='integer' AND deadline_at>=0)),
  completed_at INTEGER CHECK(completed_at IS NULL OR (typeof(completed_at)='integer' AND completed_at>=0)),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  updated_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL CHECK(typeof(created_at)='integer' AND created_at>=0),
  updated_at INTEGER NOT NULL CHECK(typeof(updated_at)='integer' AND updated_at>=0),
  version INTEGER NOT NULL DEFAULT 1 CHECK(typeof(version)='integer' AND version BETWEEN 1 AND 9000000000000000),
  FOREIGN KEY(incident_type,incident_subtype) REFERENCES incident_subtypes(type_code,code),
  CHECK(incident_subtype IS NULL OR incident_type IS NOT NULL),
  CHECK(record_status='DRAFT' OR (incident_type IS NOT NULL AND occurred_at IS NOT NULL AND length(trim(address))>0)),
  CHECK((processing_status IN ('COMPLETED','CLOSED') AND completed_at IS NOT NULL)
    OR (processing_status IN ('NEW','IN_PROGRESS') AND completed_at IS NULL))
);
CREATE INDEX incidents_occurred_idx ON incidents(occurred_at);
CREATE INDEX incidents_type_occurred_idx ON incidents(incident_type,occurred_at);
CREATE INDEX incidents_record_processing_idx ON incidents(record_status,processing_status);
CREATE INDEX incidents_region_idx ON incidents(region_id);
CREATE INDEX incidents_unit_idx ON incidents(unit_id);
CREATE INDEX incidents_facility_idx ON incidents(facility_id);
CREATE INDEX incidents_deadline_idx ON incidents(deadline_at,processing_status);
CREATE INDEX incidents_creator_idx ON incidents(created_by);

CREATE TABLE incident_damages (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 128),
  incident_id TEXT NOT NULL REFERENCES incidents(id),
  damage_group TEXT NOT NULL CHECK(damage_group IN ('HUMAN','PROPERTY')),
  damage_type TEXT NOT NULL CHECK(length(trim(damage_type)) BETWEEN 1 AND 100),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK(typeof(quantity)='integer' AND quantity BETWEEN 0 AND 1000000000),
  -- VND whole-number amounts avoid floating-point aggregation errors.
  property_value INTEGER NOT NULL DEFAULT 0 CHECK(typeof(property_value)='integer' AND property_value BETWEEN 0 AND 9000000000000000),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=2000),
  notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
  updated_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL CHECK(typeof(created_at)='integer' AND created_at>=0),
  updated_at INTEGER NOT NULL CHECK(typeof(updated_at)='integer' AND updated_at>=0),
  CHECK(damage_group='PROPERTY' OR property_value=0)
);
CREATE INDEX incident_damages_incident_idx ON incident_damages(incident_id);
CREATE INDEX incident_damages_type_idx ON incident_damages(damage_group,damage_type);

CREATE TABLE incident_assignments (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 128),
  incident_id TEXT NOT NULL REFERENCES incidents(id),
  officer_id TEXT NOT NULL REFERENCES officers(id),
  assigned_by TEXT NOT NULL REFERENCES accounts(id),
  task_description TEXT NOT NULL CHECK(length(trim(task_description)) BETWEEN 1 AND 4000),
  deadline_at INTEGER CHECK(deadline_at IS NULL OR (typeof(deadline_at)='integer' AND deadline_at>=0)),
  status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK(status IN ('ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED')),
  notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
  assigned_at INTEGER NOT NULL CHECK(typeof(assigned_at)='integer' AND assigned_at>=0),
  completed_at INTEGER CHECK(completed_at IS NULL OR (typeof(completed_at)='integer' AND completed_at>=0)),
  updated_at INTEGER NOT NULL CHECK(typeof(updated_at)='integer' AND updated_at>=0),
  CHECK((status='COMPLETED' AND completed_at IS NOT NULL) OR (status<>'COMPLETED' AND completed_at IS NULL))
);
CREATE INDEX incident_assignments_incident_idx ON incident_assignments(incident_id);
CREATE INDEX incident_assignments_officer_status_idx ON incident_assignments(officer_id,status);
CREATE INDEX incident_assignments_deadline_idx ON incident_assignments(deadline_at,status);

CREATE TABLE incident_documents (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 128),
  incident_id TEXT NOT NULL REFERENCES incidents(id),
  original_name TEXT NOT NULL CHECK(length(original_name) BETWEEN 1 AND 255),
  stored_name TEXT NOT NULL UNIQUE CHECK(length(stored_name) BETWEEN 1 AND 255),
  file_type TEXT NOT NULL CHECK(length(file_type) BETWEEN 1 AND 50),
  mime_type TEXT NOT NULL CHECK(length(mime_type) BETWEEN 3 AND 100),
  size_bytes INTEGER NOT NULL CHECK(typeof(size_bytes)='integer' AND size_bytes BETWEEN 1 AND 52428800),
  -- Keys are opaque file names inside a private upload directory, never URLs.
  storage_key TEXT NOT NULL UNIQUE CHECK(length(storage_key) BETWEEN 1 AND 255 AND instr(storage_key,'..')=0 AND instr(storage_key,'/')=0 AND instr(storage_key,char(92))=0),
  uploaded_by TEXT NOT NULL REFERENCES accounts(id),
  uploaded_at INTEGER NOT NULL CHECK(typeof(uploaded_at)='integer' AND uploaded_at>=0)
);
CREATE INDEX incident_documents_incident_idx ON incident_documents(incident_id,uploaded_at);

CREATE TABLE incident_status_history (
  id INTEGER PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id),
  from_status TEXT CHECK(from_status IS NULL OR from_status IN ('NEW','IN_PROGRESS','COMPLETED','CLOSED')),
  to_status TEXT NOT NULL CHECK(to_status IN ('NEW','IN_PROGRESS','COMPLETED','CLOSED')),
  from_record_status TEXT CHECK(from_record_status IS NULL OR from_record_status IN ('DRAFT','OFFICIAL')),
  to_record_status TEXT NOT NULL CHECK(to_record_status IN ('DRAFT','OFFICIAL')),
  old_deadline_at INTEGER CHECK(old_deadline_at IS NULL OR (typeof(old_deadline_at)='integer' AND old_deadline_at>=0)),
  new_deadline_at INTEGER CHECK(new_deadline_at IS NULL OR (typeof(new_deadline_at)='integer' AND new_deadline_at>=0)),
  changed_by TEXT NOT NULL REFERENCES accounts(id),
  changed_at INTEGER NOT NULL CHECK(typeof(changed_at)='integer' AND changed_at>=0),
  reason TEXT NOT NULL DEFAULT '' CHECK(length(reason)<=2000),
  notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=2000)
);
CREATE INDEX incident_status_history_incident_idx ON incident_status_history(incident_id,changed_at);
CREATE TRIGGER incident_history_no_update BEFORE UPDATE ON incident_status_history
BEGIN SELECT RAISE(ABORT,'Incident history is append-only'); END;
CREATE TRIGGER incident_history_no_delete BEFORE DELETE ON incident_status_history
BEGIN SELECT RAISE(ABORT,'Incident history is append-only'); END;

-- Register M09 in existing RBAC even on an unseeded database. Deliberately
-- assign NO role_permissions: a system administrator must approve each grant.
INSERT OR IGNORE INTO permissions(code,module,action) VALUES
  ('M09.view','M09','view'),
  ('M09.create','M09','create'),
  ('M09.edit','M09','edit'),
  ('M09.approve','M09','approve'),
  ('M09.export','M09','export');
