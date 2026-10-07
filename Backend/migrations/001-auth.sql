CREATE TABLE roles (
  code TEXT PRIMARY KEY CHECK(code IN ('A01','A02','A03','A04','A05','A06','A07')),
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1))
);
CREATE TABLE permissions (
  code TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('view','create','edit','approve','export')),
  UNIQUE(module, action)
);
CREATE TABLE role_permissions (
  role_code TEXT NOT NULL REFERENCES roles(code),
  permission_code TEXT NOT NULL REFERENCES permissions(code),
  PRIMARY KEY(role_code, permission_code)
);
-- Shared account contract for UC-ADM-02. Account lifecycle belongs to teammate 3.
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  officer_id TEXT NOT NULL,
  role_code TEXT NOT NULL REFERENCES roles(code),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','locked','inactive')),
  must_change_password INTEGER NOT NULL DEFAULT 1 CHECK(must_change_password IN (0,1)),
  last_login_at INTEGER,
  created_at INTEGER NOT NULL
);
-- Integration catalog: replace sample rows with the shared organization/facility source.
CREATE TABLE units (id TEXT PRIMARY KEY, name TEXT NOT NULL, parent_id TEXT REFERENCES units(id));
CREATE TABLE regions (id TEXT PRIMARY KEY, name TEXT NOT NULL, unit_id TEXT NOT NULL REFERENCES units(id));
CREATE TABLE facilities (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL,
  region_id TEXT NOT NULL REFERENCES regions(id),
  officer_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active'
);
CREATE INDEX regions_unit_idx ON regions(unit_id);
CREATE INDEX facilities_region_idx ON facilities(region_id);
CREATE INDEX facilities_officer_idx ON facilities(officer_id);
CREATE TABLE account_scopes (
  id INTEGER PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  kind TEXT NOT NULL CHECK(kind IN ('all','unit','region','facility')),
  unit_id TEXT REFERENCES units(id),
  region_id TEXT REFERENCES regions(id),
  facility_id TEXT REFERENCES facilities(id),
  CHECK((kind='all' AND unit_id IS NULL AND region_id IS NULL AND facility_id IS NULL)
    OR (kind='unit' AND unit_id IS NOT NULL AND region_id IS NULL AND facility_id IS NULL)
    OR (kind='region' AND region_id IS NOT NULL AND unit_id IS NULL AND facility_id IS NULL)
    OR (kind='facility' AND facility_id IS NOT NULL AND unit_id IS NULL AND region_id IS NULL))
);
CREATE INDEX account_scopes_account_idx ON account_scopes(account_id);
CREATE UNIQUE INDEX account_scopes_unique_idx ON account_scopes(account_id,kind,coalesce(unit_id,''),coalesce(region_id,''),coalesce(facility_id,''));
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_account_idx ON sessions(account_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE login_attempts (
  key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start INTEGER NOT NULL
);
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY,
  actor_id TEXT REFERENCES accounts(id),
  action TEXT NOT NULL, object_id TEXT,
  before_json TEXT, after_json TEXT,
  occurred_at INTEGER NOT NULL, ip TEXT NOT NULL
);
CREATE INDEX audit_logs_time_idx ON audit_logs(occurred_at);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(ABORT,'Audit logs are append-only'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_logs BEGIN SELECT RAISE(ABORT,'Audit logs are append-only'); END;
