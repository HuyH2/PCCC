-- Forward-only expansion; preserve existing audit entries and append-only triggers.
ALTER TABLE audit_logs ADD COLUMN feature TEXT NOT NULL DEFAULT 'system';
ALTER TABLE audit_logs ADD COLUMN object_type TEXT NOT NULL DEFAULT 'account';
CREATE INDEX audit_logs_actor_time_idx ON audit_logs(actor_id, occurred_at);
CREATE INDEX audit_logs_feature_time_idx ON audit_logs(feature, occurred_at);
CREATE INDEX audit_logs_action_time_idx ON audit_logs(action, occurred_at);
CREATE INDEX audit_logs_object_idx ON audit_logs(object_type, object_id, id);

CREATE TABLE legal_document_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 100)
);
CREATE TABLE legal_documents (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES legal_document_categories(id),
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 500),
  reference_number TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(reference_number)) BETWEEN 1 AND 100),
  issuing_authority TEXT NOT NULL CHECK(length(trim(issuing_authority)) BETWEEN 1 AND 200),
  issued_date TEXT,
  effective_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('effective','expired','pending')),
  source_url TEXT,
  file_name TEXT,
  file_data BLOB,
  notes TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  updated_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK(source_url IS NOT NULL OR file_data IS NOT NULL),
  CHECK((file_data IS NULL AND file_name IS NULL) OR (file_data IS NOT NULL AND file_name IS NOT NULL))
);
CREATE INDEX legal_documents_category_status_idx ON legal_documents(category_id, status);
CREATE INDEX legal_documents_updated_idx ON legal_documents(updated_at, id);
