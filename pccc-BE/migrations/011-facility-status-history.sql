-- Status changes are append-only and tied to the account that performed them.
CREATE TABLE facility_status_history (
  id INTEGER PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 1000),
  decision_reference TEXT,
  actor_id TEXT NOT NULL REFERENCES accounts(id),
  occurred_at INTEGER NOT NULL,
  audit_log_id INTEGER NOT NULL UNIQUE REFERENCES audit_logs(id),
  CHECK(previous_status <> new_status)
);
CREATE INDEX facility_status_history_facility_time_idx
  ON facility_status_history(facility_id, occurred_at DESC, id DESC);
CREATE TRIGGER facility_status_history_no_update BEFORE UPDATE ON facility_status_history
  BEGIN SELECT RAISE(ABORT,'Facility status history is append-only'); END;
CREATE TRIGGER facility_status_history_no_delete BEFORE DELETE ON facility_status_history
  BEGIN SELECT RAISE(ABORT,'Facility status history is append-only'); END;
