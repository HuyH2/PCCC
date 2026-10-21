CREATE TABLE data_transfer_jobs (
  id TEXT PRIMARY KEY,
  direction TEXT NOT NULL CHECK(direction IN ('import','export')),
  dataset_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_format TEXT NOT NULL CHECK(file_format IN ('csv','xlsx')),
  status TEXT NOT NULL CHECK(status IN (
    'validating','preview_ready','importing','succeeded','partial','failed'
  )),
  filters_json TEXT NOT NULL DEFAULT '{}',
  total_records INTEGER NOT NULL DEFAULT 0 CHECK(total_records >= 0),
  successful_records INTEGER NOT NULL DEFAULT 0 CHECK(successful_records >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK(error_count >= 0),
  error_summary TEXT,
  actor_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  CHECK(successful_records + error_count <= total_records)
);

CREATE INDEX data_transfer_jobs_actor_time_idx
  ON data_transfer_jobs(actor_id,created_at DESC,id DESC);
CREATE INDEX data_transfer_jobs_dataset_time_idx
  ON data_transfer_jobs(dataset_id,created_at DESC,id DESC);
CREATE TRIGGER data_transfer_jobs_no_delete BEFORE DELETE ON data_transfer_jobs
  BEGIN SELECT RAISE(ABORT,'Data transfer jobs are retained'); END;

CREATE TABLE data_transfer_errors (
  id INTEGER PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES data_transfer_jobs(id) ON DELETE RESTRICT,
  row_number INTEGER NOT NULL CHECK(row_number > 0),
  field_name TEXT,
  error_code TEXT,
  message TEXT NOT NULL CHECK(length(trim(message)) BETWEEN 1 AND 1000),
  created_at INTEGER NOT NULL
);

CREATE INDEX data_transfer_errors_job_row_idx
  ON data_transfer_errors(job_id,row_number,id);
CREATE TRIGGER data_transfer_errors_no_update BEFORE UPDATE ON data_transfer_errors
  BEGIN SELECT RAISE(ABORT,'Data transfer errors are append-only'); END;
CREATE TRIGGER data_transfer_errors_no_delete BEFORE DELETE ON data_transfer_errors
  BEGIN SELECT RAISE(ABORT,'Data transfer errors are append-only'); END;
