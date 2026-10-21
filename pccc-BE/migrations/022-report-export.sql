-- M08 — xuất báo cáo, biểu mẫu và lịch sử kết xuất (UC-RPT-06, BR-01, BR-12).
-- The report catalogue is configuration data. Report rows are always read from the
-- completed M03/M04/M06/M07 tables at request time; no parallel statistics table.
CREATE TABLE report_export_types (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '',
  dataset_key TEXT NOT NULL
    CHECK(dataset_key IN ('facilities','violations','inspections','tasks')),
  scope_kind TEXT NOT NULL CHECK(scope_kind IN ('facility','account')),
  supports_period INTEGER NOT NULL DEFAULT 1 CHECK(supports_period IN (0,1)),
  supports_region INTEGER NOT NULL DEFAULT 0 CHECK(supports_region IN (0,1)),
  default_format TEXT NOT NULL DEFAULT 'xlsx' CHECK(default_format IN ('xlsx','pdf')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at INTEGER NOT NULL
);
CREATE INDEX report_export_types_active_idx ON report_export_types(is_active, code);

-- A template stores a confirmed title/column-label/header/footer configuration. It never
-- replaces the data query owned by the report type. Official form layouts are added only
-- after the business team supplies the signed sample (Q04/BR-12).
CREATE TABLE report_templates (
  id TEXT PRIMARY KEY,
  report_type_id TEXT NOT NULL REFERENCES report_export_types(id),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  format TEXT NOT NULL CHECK(format IN ('xlsx','pdf')),
  title TEXT NOT NULL DEFAULT '' CHECK(length(title) <= 300),
  header_note TEXT NOT NULL DEFAULT '' CHECK(length(header_note) <= 1000),
  footer_note TEXT NOT NULL DEFAULT '' CHECK(length(footer_note) <= 1000),
  column_labels_json TEXT NOT NULL DEFAULT '{}',
  is_official INTEGER NOT NULL DEFAULT 0 CHECK(is_official IN (0,1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX report_templates_type_idx
  ON report_templates(report_type_id, format, is_active, created_at DESC);

-- One row per export attempt. The generated binary lives in report_export_submissions so the
-- history query stays lightweight; both rows are retained as audit evidence.
CREATE TABLE report_export_requests (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  report_type_id TEXT NOT NULL REFERENCES report_export_types(id),
  requested_by TEXT NOT NULL REFERENCES accounts(id),
  period_start TEXT,
  period_end TEXT,
  filters_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK(status IN ('processing','completed','failed')),
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  CHECK(period_start IS NULL OR period_end IS NULL OR period_start <= period_end)
);
CREATE INDEX report_export_requests_requester_idx
  ON report_export_requests(requested_by, created_at DESC, id DESC);
CREATE INDEX report_export_requests_type_idx ON report_export_requests(report_type_id, created_at DESC);

CREATE TABLE report_export_submissions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE REFERENCES report_export_requests(id),
  file_name TEXT NOT NULL CHECK(length(trim(file_name)) BETWEEN 1 AND 255),
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK(file_size > 0),
  file_data BLOB NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE report_export_history (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE REFERENCES report_export_requests(id),
  submission_id TEXT UNIQUE REFERENCES report_export_submissions(id),
  report_type_id TEXT NOT NULL REFERENCES report_export_types(id),
  template_id TEXT REFERENCES report_templates(id),
  template_name TEXT,
  format TEXT NOT NULL CHECK(format IN ('xlsx','pdf')),
  file_name TEXT,
  file_size INTEGER,
  row_count INTEGER NOT NULL DEFAULT 0 CHECK(row_count >= 0),
  filters_json TEXT NOT NULL DEFAULT '{}',
  period_start TEXT,
  period_end TEXT,
  exported_by TEXT NOT NULL REFERENCES accounts(id),
  exported_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('completed','failed')),
  error_message TEXT,
  CHECK(status <> 'failed' OR (error_message IS NOT NULL AND length(trim(error_message)) > 0)),
  CHECK(status <> 'completed' OR (submission_id IS NOT NULL AND file_name IS NOT NULL))
);
CREATE INDEX report_export_history_user_idx
  ON report_export_history(exported_by, exported_at DESC, id DESC);
CREATE INDEX report_export_history_type_idx
  ON report_export_history(report_type_id, exported_at DESC);

-- Demo configuration only. Report definitions map 1:1 to completed data modules; the
-- official wording/layout still needs business confirmation.
INSERT OR IGNORE INTO report_export_types
  (id, code, name, description, dataset_key, scope_kind, supports_period,
   supports_region, default_format, is_active, created_at)
VALUES
  ('RPT-R01', 'R01', 'Tổng hợp cơ sở theo địa bàn',
   'Danh sách cơ sở và trạng thái theo khu vực, đơn vị, cán bộ phụ trách.',
   'facilities', 'facility', 0, 1, 'xlsx', 1, unixepoch() * 1000),
  ('RPT-R03', 'R03', 'Vi phạm, đình chỉ, khắc phục',
   'Các trường hợp vi phạm, quyết định đình chỉ và kết quả khắc phục.',
   'violations', 'facility', 1, 1, 'xlsx', 1, unixepoch() * 1000),
  ('RPT-R05', 'R05', 'Kết quả kiểm tra',
   'Kế hoạch, kết quả và trạng thái thực hiện các cuộc kiểm tra.',
   'inspections', 'facility', 1, 1, 'xlsx', 1, unixepoch() * 1000),
  ('RPT-R06', 'R06', 'Công việc theo cán bộ',
   'Công việc được tạo trong kỳ, tiến độ và số việc quá hạn theo cán bộ.',
   'tasks', 'account', 1, 0, 'xlsx', 1, unixepoch() * 1000);

-- M08 is a new demo grant set. The permission catalogue already contains M08.* after seed;
-- these inserts also make the migration safe on a fresh database (roles may be empty).
INSERT OR IGNORE INTO permissions(code, module, action)
VALUES
  ('M08.view', 'M08', 'view'),
  ('M08.create', 'M08', 'create'),
  ('M08.edit', 'M08', 'edit'),
  ('M08.export', 'M08', 'export');

-- Upgrade an existing demo database without changing unrelated role permissions.
-- Only roles that already have M08.view receive the new export action; fresh databases
-- get their demo grants from seedDemo instead.
INSERT OR IGNORE INTO role_permissions(role_code, permission_code)
SELECT rp.role_code, 'M08.export'
FROM role_permissions rp
WHERE rp.permission_code = 'M08.view'
  AND rp.role_code IN ('A01', 'A04', 'A05');
