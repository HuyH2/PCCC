-- M07 — lịch công tác, giao việc, tiến độ, KPI và giải trình.
-- tasks already carries the current assignee; task_assignments keeps the audit
-- trail of assignments and is backfilled once from the current task rows.
ALTER TABLE tasks ADD COLUMN completed_at INTEGER;
UPDATE tasks SET completed_at=COALESCE(updated_at,created_at)
WHERE status='completed' AND completed_at IS NULL;
CREATE INDEX tasks_completed_idx ON tasks(assigned_to,completed_at);

CREATE TABLE task_assignments (
  id INTEGER PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  assignee_id TEXT NOT NULL REFERENCES accounts(id),
  assigned_by TEXT NOT NULL REFERENCES accounts(id),
  assigned_at INTEGER NOT NULL,
  ended_at INTEGER,
  note TEXT,
  CHECK(ended_at IS NULL OR ended_at >= assigned_at)
);
CREATE UNIQUE INDEX task_assignments_current_uq
  ON task_assignments(task_id) WHERE ended_at IS NULL;
CREATE INDEX task_assignments_assignee_idx
  ON task_assignments(assignee_id,assigned_at DESC,id DESC);
INSERT INTO task_assignments(task_id,assignee_id,assigned_by,assigned_at,note)
SELECT id,assigned_to,assigned_by,created_at,'Khởi tạo từ dữ liệu công việc' FROM tasks;

CREATE TABLE task_progress (
  id INTEGER PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  progress INTEGER NOT NULL CHECK(progress BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed','cancelled')),
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX task_progress_task_idx ON task_progress(task_id,created_at DESC,id DESC);
INSERT INTO task_progress(task_id,account_id,progress,status,note,created_at)
SELECT id,assigned_to,progress,status,'Tiến độ khởi tạo',COALESCE(updated_at,created_at) FROM tasks;
CREATE TRIGGER task_progress_no_update BEFORE UPDATE ON task_progress
  BEGIN SELECT RAISE(ABORT,'task_progress is append-only'); END;
CREATE TRIGGER task_progress_no_delete BEFORE DELETE ON task_progress
  BEGIN SELECT RAISE(ABORT,'task_progress is append-only'); END;

CREATE TABLE kpi_targets (
  id INTEGER PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  period TEXT NOT NULL CHECK(period GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  target_tasks INTEGER NOT NULL CHECK(target_tasks BETWEEN 0 AND 10000),
  note TEXT,
  created_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(account_id,period)
);
CREATE INDEX kpi_targets_period_idx ON kpi_targets(period,account_id);

CREATE TABLE kpi_results (
  id INTEGER PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  period TEXT NOT NULL,
  target_tasks INTEGER NOT NULL,
  completed_tasks INTEGER NOT NULL,
  previous_debt INTEGER NOT NULL,
  debt INTEGER NOT NULL,
  waived_debt INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL,
  computed_at INTEGER NOT NULL,
  UNIQUE(account_id,period)
);
CREATE INDEX kpi_results_period_idx ON kpi_results(period,account_id);

CREATE TABLE explanations (
  id INTEGER PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  period TEXT,
  requested_by TEXT NOT NULL REFERENCES accounts(id),
  reason TEXT NOT NULL,
  response TEXT,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK(status IN ('requested','submitted','accepted','rejected')),
  requested_at INTEGER NOT NULL,
  submitted_at INTEGER,
  reviewed_by TEXT REFERENCES accounts(id),
  reviewed_at INTEGER,
  review_note TEXT,
  debt_waived INTEGER NOT NULL DEFAULT 0 CHECK(debt_waived IN (0,1)),
  seed_key TEXT UNIQUE,
  CHECK(task_id IS NOT NULL OR period IS NOT NULL),
  CHECK(period IS NULL OR period GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]')
);
CREATE INDEX explanations_account_idx
  ON explanations(account_id,requested_at DESC,id DESC);
CREATE INDEX explanations_requester_idx
  ON explanations(requested_by,requested_at DESC,id DESC);
