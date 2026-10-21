-- UC-ORG-03. The current owner of a region/facility lives in region_assignments /
-- facilities.officer_id; this table keeps every assignment change with its history.
CREATE TABLE assignment_events (
  id INTEGER PRIMARY KEY,
  region_id TEXT REFERENCES regions(id),
  facility_id TEXT REFERENCES facilities(id),
  from_account_id TEXT REFERENCES accounts(id),
  to_account_id TEXT REFERENCES accounts(id),
  action TEXT NOT NULL CHECK(action IN ('assign','unassign')),
  reason TEXT,
  effective_date TEXT,
  performed_by TEXT NOT NULL REFERENCES accounts(id),
  occurred_at INTEGER NOT NULL,
  audit_log_id INTEGER,
  CHECK((region_id IS NOT NULL AND facility_id IS NULL)
     OR (region_id IS NULL AND facility_id IS NOT NULL))
);
CREATE INDEX assignment_events_region_idx ON assignment_events(region_id, occurred_at DESC, id DESC);
CREATE INDEX assignment_events_facility_idx ON assignment_events(facility_id, occurred_at DESC, id DESC);
CREATE INDEX assignment_events_performer_idx ON assignment_events(performed_by, occurred_at DESC);

-- UC-ORG-03 is performed by the commander/deputy commander (A01/A02); A05 keeps the
-- catalogue. Grants are inserted here because seed preserves existing role grants.
INSERT OR IGNORE INTO role_permissions(role_code, permission_code)
SELECT g.role_code, g.permission_code
FROM (
  SELECT 'A01' AS role_code, 'M02.view' AS permission_code
  UNION ALL SELECT 'A01', 'M02.edit'
  UNION ALL SELECT 'A02', 'M02.view'
  UNION ALL SELECT 'A02', 'M02.edit'
  UNION ALL SELECT 'A05', 'M02.view'
  UNION ALL SELECT 'A05', 'M02.create'
  UNION ALL SELECT 'A05', 'M02.edit'
) g
WHERE EXISTS (SELECT 1 FROM roles r WHERE r.code = g.role_code)
  AND EXISTS (SELECT 1 FROM permissions p WHERE p.code = g.permission_code);
