-- One open suspension case per facility. Restored cases remain available for audit.
CREATE TABLE facility_violations (
  id INTEGER PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 1000),
  suspension_decision_reference TEXT NOT NULL CHECK(length(trim(suspension_decision_reference)) BETWEEN 1 AND 200),
  suspension_at INTEGER NOT NULL,
  suspended_by TEXT NOT NULL REFERENCES accounts(id),
  status TEXT NOT NULL DEFAULT 'suspended' CHECK(status IN ('suspended','restored')),
  remediation_evidence TEXT,
  restoration_decision_reference TEXT,
  approved_by TEXT REFERENCES accounts(id),
  approved_at INTEGER,
  CHECK((status='suspended' AND approved_by IS NULL AND approved_at IS NULL AND restoration_decision_reference IS NULL)
    OR (status='restored' AND approved_by IS NOT NULL AND approved_at IS NOT NULL
      AND remediation_evidence IS NOT NULL AND restoration_decision_reference IS NOT NULL
      AND length(trim(remediation_evidence)) > 0 AND length(trim(restoration_decision_reference)) > 0))
);
CREATE UNIQUE INDEX facility_violations_open_idx ON facility_violations(facility_id) WHERE status='suspended';
CREATE INDEX facility_violations_facility_time_idx ON facility_violations(facility_id,suspension_at DESC);
