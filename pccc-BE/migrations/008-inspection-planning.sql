-- M06 — inspection planning and scheduling (UC-INS-01..05).

CREATE TABLE inspection_plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  year INTEGER NOT NULL CHECK(year BETWEEN 2000 AND 2100),
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 300),
  facility_group TEXT NOT NULL DEFAULT '',
  legal_basis TEXT NOT NULL DEFAULT '',
  unit_id TEXT NOT NULL REFERENCES units(id),
  annual_target INTEGER NOT NULL CHECK(annual_target > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','closed')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  updated_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX inspection_plans_year_idx ON inspection_plans(year, unit_id, status);

CREATE TABLE inspection_targets (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES inspection_plans(id),
  parent_id TEXT REFERENCES inspection_targets(id),
  period_type TEXT NOT NULL CHECK(period_type IN ('year','month','week')),
  year INTEGER NOT NULL CHECK(year BETWEEN 2000 AND 2100),
  month INTEGER CHECK(month BETWEEN 1 AND 12),
  week INTEGER CHECK(week BETWEEN 1 AND 53),
  officer_id TEXT REFERENCES officers(id),
  region_id TEXT REFERENCES regions(id),
  target_count INTEGER NOT NULL CHECK(target_count > 0),
  carryover_count INTEGER NOT NULL DEFAULT 0 CHECK(carryover_count >= 0),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  updated_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK((period_type='year' AND month IS NULL AND week IS NULL)
    OR (period_type='month' AND month IS NOT NULL AND week IS NULL)
    OR (period_type='week' AND month IS NOT NULL AND week IS NOT NULL))
);

CREATE UNIQUE INDEX inspection_targets_unique_idx ON inspection_targets(
  plan_id, period_type, year, coalesce(month,0), coalesce(week,0),
  coalesce(officer_id,''), coalesce(region_id,'')
);
CREATE INDEX inspection_targets_plan_idx ON inspection_targets(plan_id, period_type, year, month, week);
CREATE INDEX inspection_targets_officer_idx ON inspection_targets(officer_id, year, month, week);

CREATE TABLE inspection_schedules (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL UNIQUE REFERENCES inspections(id),
  scheduled_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  location TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','rescheduled','cancelled')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  updated_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK(start_time IS NULL OR length(start_time)=5),
  CHECK(end_time IS NULL OR length(end_time)=5)
);

CREATE INDEX inspection_schedules_date_idx ON inspection_schedules(scheduled_date, status);

CREATE TABLE inspection_reschedules (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL REFERENCES inspections(id),
  schedule_id TEXT NOT NULL REFERENCES inspection_schedules(id),
  old_date TEXT NOT NULL,
  new_date TEXT NOT NULL,
  old_start_time TEXT,
  new_start_time TEXT,
  old_end_time TEXT,
  new_end_time TEXT,
  reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 2000),
  attachment_name TEXT,
  attachment_type TEXT CHECK(attachment_type IS NULL OR attachment_type IN ('application/pdf','image/jpeg','image/png')),
  attachment_size INTEGER CHECK(attachment_size IS NULL OR attachment_size > 0),
  attachment_data BLOB,
  changed_by TEXT NOT NULL REFERENCES accounts(id),
  changed_at INTEGER NOT NULL,
  CHECK((attachment_name IS NULL AND attachment_type IS NULL AND attachment_size IS NULL AND attachment_data IS NULL)
    OR (attachment_name IS NOT NULL AND attachment_type IS NOT NULL AND attachment_size IS NOT NULL AND attachment_data IS NOT NULL))
);

CREATE INDEX inspection_reschedules_inspection_idx ON inspection_reschedules(inspection_id, changed_at DESC);
CREATE TRIGGER inspection_reschedules_no_update BEFORE UPDATE ON inspection_reschedules
BEGIN SELECT RAISE(ABORT,'Inspection reschedules are append-only'); END;
CREATE TRIGGER inspection_reschedules_no_delete BEFORE DELETE ON inspection_reschedules
BEGIN SELECT RAISE(ABORT,'Inspection reschedules are append-only'); END;

CREATE TABLE inspection_notices (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL UNIQUE REFERENCES inspections(id),
  notice_number TEXT NOT NULL DEFAULT '',
  recipient_name TEXT NOT NULL CHECK(length(trim(recipient_name)) BETWEEN 1 AND 200),
  recipient_contact TEXT NOT NULL DEFAULT '',
  notice_text TEXT NOT NULL DEFAULT '',
  sent_date TEXT,
  inspection_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent')),
  file_name TEXT,
  content_type TEXT CHECK(content_type IS NULL OR content_type IN ('application/pdf','image/jpeg','image/png')),
  file_size INTEGER CHECK(file_size IS NULL OR file_size > 0),
  file_data BLOB,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  updated_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK(status='draft' OR sent_date IS NOT NULL),
  CHECK((file_name IS NULL AND content_type IS NULL AND file_size IS NULL AND file_data IS NULL)
    OR (file_name IS NOT NULL AND content_type IS NOT NULL AND file_size IS NOT NULL AND file_data IS NOT NULL))
);

CREATE INDEX inspection_notices_sent_idx ON inspection_notices(status, sent_date);

CREATE TABLE inspection_planning_documents (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL REFERENCES inspections(id),
  kind TEXT NOT NULL CHECK(kind IN ('team_decision')),
  description TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK(content_type IN ('application/pdf','image/jpeg','image/png')),
  file_size INTEGER NOT NULL CHECK(file_size > 0),
  file_data BLOB NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES accounts(id),
  uploaded_at INTEGER NOT NULL
);

CREATE INDEX inspection_planning_documents_inspection_idx
  ON inspection_planning_documents(inspection_id, uploaded_at);

ALTER TABLE inspections ADD COLUMN plan_id TEXT REFERENCES inspection_plans(id);
ALTER TABLE inspections ADD COLUMN target_id TEXT REFERENCES inspection_targets(id);

CREATE INDEX inspections_plan_idx ON inspections(plan_id, scheduled_date);
CREATE INDEX inspections_target_idx ON inspections(target_id);

INSERT INTO inspection_schedules(
  id, inspection_id, scheduled_date, location, status, version,
  created_by, updated_by, created_at, updated_at
)
SELECT 'SCHED-' || id, id, scheduled_date, '', 'scheduled', 1,
  created_by, updated_by, created_at, updated_at
FROM inspections;

DROP VIEW officer_directory;
CREATE VIEW officer_directory AS
  SELECT id AS officer_id, full_name FROM officers
  UNION ALL
  SELECT a.officer_id, min(a.full_name) AS full_name
  FROM accounts a
  WHERE NOT EXISTS (SELECT 1 FROM officers o WHERE o.id=a.officer_id)
  GROUP BY a.officer_id;
