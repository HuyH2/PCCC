CREATE TABLE violations (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  violation_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('Nhẹ','Trung bình','Nghiêm trọng')),
  detected_on TEXT NOT NULL,
  description TEXT NOT NULL,
  facility_condition TEXT NOT NULL DEFAULT 'violation'
    CHECK(facility_condition IN ('violation','unlicensed','insufficient')),
  remediation_deadline TEXT,
  tracked_officer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'recorded'
    CHECK(status IN ('recorded','remediation','pending_approval','returned','completed')),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX violations_facility_idx ON violations(facility_id, detected_on DESC);
CREATE INDEX violations_status_idx ON violations(status, remediation_deadline);
CREATE INDEX violations_type_idx ON violations(violation_type);

CREATE TABLE suspensions (
  id TEXT PRIMARY KEY,
  violation_id TEXT NOT NULL UNIQUE REFERENCES violations(id),
  decision_number TEXT NOT NULL,
  reason TEXT NOT NULL,
  issued_on TEXT NOT NULL,
  effective_until TEXT,
  previous_facility_status TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE remediation_records (
  id TEXT PRIMARY KEY,
  violation_id TEXT NOT NULL REFERENCES violations(id),
  note TEXT NOT NULL,
  progress INTEGER NOT NULL CHECK(progress BETWEEN 0 AND 100),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX remediation_violation_idx ON remediation_records(violation_id, created_at);

CREATE TABLE violation_evidences (
  id TEXT PRIMARY KEY,
  violation_id TEXT NOT NULL REFERENCES violations(id),
  file_name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK(file_size > 0),
  content BLOB NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES accounts(id),
  uploaded_at INTEGER NOT NULL
);
CREATE INDEX violation_evidence_violation_idx ON violation_evidences(violation_id, uploaded_at);

CREATE TABLE violation_status_history (
  id INTEGER PRIMARY KEY,
  violation_id TEXT NOT NULL REFERENCES violations(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  actor_id TEXT NOT NULL REFERENCES accounts(id),
  occurred_at INTEGER NOT NULL
);
CREATE INDEX violation_status_history_idx ON violation_status_history(violation_id, occurred_at);
