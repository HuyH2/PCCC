CREATE TABLE facility_personnel (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  full_name TEXT NOT NULL CHECK(length(trim(full_name)) BETWEEN 1 AND 150),
  position TEXT NOT NULL CHECK(length(trim(position)) BETWEEN 1 AND 150),
  phone TEXT CHECK(phone IS NULL OR length(phone) BETWEEN 8 AND 25),
  email TEXT CHECK(email IS NULL OR length(email) BETWEEN 3 AND 254),
  is_head INTEGER NOT NULL DEFAULT 0 CHECK(is_head IN (0,1)),
  training_status TEXT CHECK(training_status IS NULL OR length(training_status) <= 100),
  certificate_expiry TEXT CHECK(
    certificate_expiry IS NULL OR
    (length(certificate_expiry)=10 AND certificate_expiry GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
  ),
  notes TEXT NOT NULL DEFAULT '' CHECK(length(notes) <= 2000),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  updated_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(id, facility_id),
  CHECK(is_head=0 OR is_active=1)
);
CREATE INDEX facility_personnel_facility_idx
  ON facility_personnel(facility_id,is_active,is_head,full_name);
CREATE UNIQUE INDEX facility_personnel_active_head_idx
  ON facility_personnel(facility_id) WHERE is_head=1 AND is_active=1;

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  personnel_id TEXT,
  document_type TEXT NOT NULL CHECK(length(trim(document_type)) BETWEEN 1 AND 100),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 1000),
  original_name TEXT NOT NULL CHECK(length(original_name) BETWEEN 1 AND 200),
  stored_name TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK(content_type IN ('application/pdf','image/jpeg','image/png')),
  size_bytes INTEGER NOT NULL CHECK(size_bytes > 0),
  storage_path TEXT NOT NULL UNIQUE,
  uploaded_by TEXT NOT NULL REFERENCES accounts(id),
  uploaded_at INTEGER NOT NULL,
  FOREIGN KEY(personnel_id,facility_id) REFERENCES facility_personnel(id,facility_id)
);
CREATE INDEX attachments_facility_time_idx ON attachments(facility_id,uploaded_at DESC,id);
CREATE INDEX attachments_personnel_idx ON attachments(personnel_id) WHERE personnel_id IS NOT NULL;

CREATE TRIGGER facility_personnel_no_delete BEFORE DELETE ON facility_personnel
BEGIN SELECT RAISE(ABORT,'Facility personnel history cannot be deleted'); END;
CREATE TRIGGER attachments_no_delete BEFORE DELETE ON attachments
BEGIN SELECT RAISE(ABORT,'Facility attachment history cannot be deleted'); END;
