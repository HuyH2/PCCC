-- M07: the repository had no persisted tasks. These minimal task records anchor
-- per-task communication; task-specific assignment is the data access boundary.
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '',
  assigned_by TEXT NOT NULL REFERENCES accounts(id),
  assigned_to TEXT NOT NULL REFERENCES accounts(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed','cancelled')),
  created_at INTEGER NOT NULL
);
CREATE INDEX tasks_assigner_time_idx ON tasks(assigned_by,created_at DESC);
CREATE INDEX tasks_assignee_time_idx ON tasks(assigned_to,created_at DESC);

CREATE TABLE task_messages (
  id INTEGER PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  sender_id TEXT NOT NULL REFERENCES accounts(id),
  body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 2000),
  created_at INTEGER NOT NULL,
  edited_at INTEGER,
  deleted_at INTEGER,
  deleted_by TEXT REFERENCES accounts(id),
  seed_key TEXT UNIQUE,
  CHECK((deleted_at IS NULL AND deleted_by IS NULL) OR (deleted_at IS NOT NULL AND deleted_by IS NOT NULL))
);
CREATE INDEX task_messages_task_time_idx ON task_messages(task_id,created_at DESC,id DESC);
CREATE TRIGGER task_messages_no_delete BEFORE DELETE ON task_messages
  BEGIN SELECT RAISE(ABORT,'Task messages must be soft-deleted'); END;

