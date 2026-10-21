-- One account per officer code. The service checks this before writing; the unique
-- index is the database-level guard for concurrent writers and direct SQL.
-- If a legacy database already contains duplicates, resolve them before deploying.
CREATE UNIQUE INDEX IF NOT EXISTS accounts_officer_unique ON accounts(officer_id);

-- BR-03: assignment history is append-only. audit_logs already has the same guarantee.
CREATE TRIGGER IF NOT EXISTS assignment_events_no_update
BEFORE UPDATE ON assignment_events
BEGIN
  SELECT RAISE(ABORT, 'assignment_events is append-only');
END;

CREATE TRIGGER IF NOT EXISTS assignment_events_no_delete
BEFORE DELETE ON assignment_events
BEGIN
  SELECT RAISE(ABORT, 'assignment_events is append-only');
END;
