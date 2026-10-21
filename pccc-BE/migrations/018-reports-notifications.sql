CREATE TABLE report_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '',
  cycle TEXT NOT NULL CHECK(cycle IN ('once','weekly','monthly','quarterly','yearly')),
  warning_days INTEGER NOT NULL DEFAULT 5 CHECK(warning_days BETWEEN 0 AND 90),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE report_schedules (
  id TEXT PRIMARY KEY,
  report_type_id TEXT NOT NULL REFERENCES report_types(id),
  assignee_id TEXT NOT NULL REFERENCES accounts(id),
  requester_id TEXT NOT NULL REFERENCES accounts(id),
  recipient TEXT NOT NULL,
  reference_number TEXT,
  next_due_date TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX report_schedules_due_idx ON report_schedules(active,next_due_date);

CREATE TABLE report_requests (
  id TEXT PRIMARY KEY,
  report_type_id TEXT NOT NULL REFERENCES report_types(id),
  schedule_id TEXT REFERENCES report_schedules(id),
  period_key TEXT,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
  recipient TEXT NOT NULL,
  reference_number TEXT,
  requester_id TEXT NOT NULL REFERENCES accounts(id),
  assignee_id TEXT NOT NULL REFERENCES accounts(id),
  due_date TEXT NOT NULL,
  warning_days INTEGER NOT NULL CHECK(warning_days BETWEEN 0 AND 90),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','submitted','completed','cancelled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  UNIQUE(schedule_id,period_key)
);
CREATE INDEX report_requests_assignee_due_idx ON report_requests(assignee_id,status,due_date);
CREATE INDEX report_requests_requester_idx ON report_requests(requester_id,status);

CREATE TABLE report_submissions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES report_requests(id),
  submitted_by TEXT NOT NULL REFERENCES accounts(id),
  note TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK(file_size BETWEEN 1 AND 10485760),
  file_data BLOB NOT NULL,
  submitted_at INTEGER NOT NULL
);
CREATE INDEX report_submissions_request_idx ON report_submissions(request_id,submitted_at DESC);
CREATE TRIGGER report_submissions_no_update BEFORE UPDATE ON report_submissions
  BEGIN SELECT RAISE(ABORT,'Report submissions are append-only'); END;
CREATE TRIGGER report_submissions_no_delete BEFORE DELETE ON report_submissions
  BEGIN SELECT RAISE(ABORT,'Report submissions are append-only'); END;

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES accounts(id),
  feature TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_path TEXT,
  object_id TEXT,
  dedupe_key TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX notifications_user_time_idx ON notifications(user_id,created_at DESC);
