DROP TRIGGER IF EXISTS attachments_no_delete;
DROP INDEX IF EXISTS attachments_facility_time_idx;
DROP INDEX IF EXISTS attachments_personnel_idx;

CREATE TABLE attachments_next (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  personnel_id TEXT,
  document_type TEXT NOT NULL CHECK(length(trim(document_type)) BETWEEN 1 AND 100),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 1000),
  original_name TEXT NOT NULL CHECK(length(original_name) BETWEEN 1 AND 200),
  stored_name TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK(content_type IN (
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )),
  size_bytes INTEGER NOT NULL CHECK(size_bytes > 0),
  storage_path TEXT NOT NULL UNIQUE,
  checksum TEXT CHECK(checksum IS NULL OR (length(checksum)=64 AND checksum NOT GLOB '*[^a-f0-9]*')),
  issue_date TEXT CHECK(issue_date IS NULL OR (length(issue_date)=10 AND issue_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')),
  expiry_date TEXT CHECK(expiry_date IS NULL OR (length(expiry_date)=10 AND expiry_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')),
  uploaded_by TEXT NOT NULL REFERENCES accounts(id),
  uploaded_at INTEGER NOT NULL,
  deleted_at INTEGER,
  deleted_by TEXT REFERENCES accounts(id),
  FOREIGN KEY(personnel_id,facility_id) REFERENCES facility_personnel(id,facility_id),
  CHECK((deleted_at IS NULL AND deleted_by IS NULL) OR (deleted_at IS NOT NULL AND deleted_by IS NOT NULL)),
  CHECK(issue_date IS NULL OR expiry_date IS NULL OR expiry_date >= issue_date)
);

INSERT INTO attachments_next (
  id, facility_id, personnel_id, document_type, description, original_name,
  stored_name, content_type, size_bytes, storage_path, uploaded_by, uploaded_at
)
SELECT
  id, facility_id, personnel_id, document_type, description, original_name,
  stored_name, content_type, size_bytes, storage_path, uploaded_by, uploaded_at
FROM attachments;

DROP TABLE attachments;
ALTER TABLE attachments_next RENAME TO attachments;

CREATE INDEX attachments_facility_time_idx ON attachments(facility_id,deleted_at,uploaded_at DESC,id);
CREATE INDEX attachments_personnel_idx ON attachments(personnel_id) WHERE personnel_id IS NOT NULL;
CREATE TRIGGER attachments_no_delete BEFORE DELETE ON attachments
BEGIN SELECT RAISE(ABORT,'Facility attachment history cannot be deleted'); END;
