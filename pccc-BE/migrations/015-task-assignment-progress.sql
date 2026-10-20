-- Add assignment and progress fields without rewriting existing task records.
ALTER TABLE tasks ADD COLUMN kind TEXT NOT NULL DEFAULT 'assigned'
  CHECK(kind IN ('routine','unscheduled','assigned'));
ALTER TABLE tasks ADD COLUMN due_at INTEGER;
ALTER TABLE tasks ADD COLUMN progress INTEGER NOT NULL DEFAULT 0
  CHECK(progress BETWEEN 0 AND 100);
ALTER TABLE tasks ADD COLUMN updated_at INTEGER;
CREATE INDEX tasks_due_idx ON tasks(due_at);
