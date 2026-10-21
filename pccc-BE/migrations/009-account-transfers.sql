-- UC-ADM-04. The current catalog has facilities.officer_id but no region owner table.
CREATE TABLE region_assignments (
  region_id TEXT PRIMARY KEY REFERENCES regions(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  assigned_at INTEGER NOT NULL
);
CREATE INDEX region_assignments_account_idx ON region_assignments(account_id);

CREATE TABLE account_transfers (
  id TEXT PRIMARY KEY,
  source_account_id TEXT NOT NULL REFERENCES accounts(id),
  target_account_id TEXT NOT NULL REFERENCES accounts(id),
  source_officer_id TEXT NOT NULL,
  target_officer_id TEXT NOT NULL,
  effective_at INTEGER NOT NULL,
  performed_by TEXT NOT NULL REFERENCES accounts(id),
  reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 1000),
  created_at INTEGER NOT NULL,
  audit_log_id INTEGER NOT NULL UNIQUE REFERENCES audit_logs(id),
  CHECK(source_account_id <> target_account_id)
);
CREATE INDEX account_transfers_time_idx ON account_transfers(effective_at DESC, id);
CREATE INDEX account_transfers_source_idx ON account_transfers(source_account_id, effective_at DESC);
CREATE INDEX account_transfers_target_idx ON account_transfers(target_account_id, effective_at DESC);

CREATE TABLE account_transfer_items (
  id INTEGER PRIMARY KEY,
  transfer_id TEXT NOT NULL REFERENCES account_transfers(id),
  region_id TEXT REFERENCES regions(id),
  facility_id TEXT REFERENCES facilities(id),
  source_officer_id TEXT NOT NULL,
  target_officer_id TEXT NOT NULL,
  CHECK((region_id IS NOT NULL AND facility_id IS NULL)
     OR (region_id IS NULL AND facility_id IS NOT NULL))
);
CREATE UNIQUE INDEX account_transfer_items_region_idx ON account_transfer_items(transfer_id, region_id)
  WHERE region_id IS NOT NULL;
CREATE UNIQUE INDEX account_transfer_items_facility_idx ON account_transfer_items(transfer_id, facility_id)
  WHERE facility_id IS NOT NULL;
