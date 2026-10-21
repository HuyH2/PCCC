-- Additive catalog extension. Preserve every legacy ID and authorization reference.
ALTER TABLE units ADD COLUMN code TEXT COLLATE NOCASE;
ALTER TABLE units ADD COLUMN level TEXT NOT NULL DEFAULT 'AREA' CHECK(level IN ('ROOT','AREA','WARD'));
ALTER TABLE units ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE'));
ALTER TABLE units ADD COLUMN notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=2000);
ALTER TABLE units ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE units ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
UPDATE units SET code=id, level=CASE WHEN parent_id IS NULL THEN 'ROOT' ELSE 'AREA' END;
CREATE UNIQUE INDEX units_code_unique_idx ON units(code COLLATE NOCASE);
CREATE INDEX units_parent_idx ON units(parent_id);

CREATE TABLE officers (
  id TEXT PRIMARY KEY,
  officer_code TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(officer_code) BETWEEN 1 AND 50),
  full_name TEXT NOT NULL CHECK(length(trim(full_name)) BETWEEN 1 AND 150),
  rank TEXT NOT NULL CHECK(length(trim(rank)) BETWEEN 1 AND 100),
  position TEXT NOT NULL CHECK(length(trim(position)) BETWEEN 1 AND 150),
  phone TEXT NOT NULL CHECK(length(phone) BETWEEN 8 AND 25),
  email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(email) BETWEEN 3 AND 254),
  notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
  unit_id TEXT NOT NULL REFERENCES units(id),
  business_role TEXT NOT NULL REFERENCES roles(code) CHECK(business_role IN ('A01','A02','A03','A04','A05','A06')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE','TRANSFERRED')),
  status_reason TEXT,
  status_effective_date TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK(status='ACTIVE' OR (status_reason IS NOT NULL AND status_effective_date IS NOT NULL AND length(trim(status_reason))>0 AND length(status_effective_date)=10))
);
CREATE INDEX officers_unit_status_idx ON officers(unit_id,status);
CREATE INDEX officers_name_idx ON officers(full_name);
CREATE INDEX officers_position_idx ON officers(position);
-- accounts.officer_id and facilities.officer_id deliberately remain compatible
-- with unmatched legacy references; no invented profile/account authorization.
CREATE INDEX accounts_officer_idx ON accounts(officer_id);
ALTER TABLE units ADD COLUMN leader_officer_id TEXT REFERENCES officers(id);
ALTER TABLE regions ADD COLUMN code TEXT COLLATE NOCASE;
ALTER TABLE regions ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE'));
ALTER TABLE regions ADD COLUMN notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=2000);
ALTER TABLE regions ADD COLUMN leader_officer_id TEXT REFERENCES officers(id);
ALTER TABLE regions ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE regions ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
UPDATE regions SET code=id;
CREATE UNIQUE INDEX regions_code_unique_idx ON regions(code COLLATE NOCASE);
CREATE INDEX units_leader_idx ON units(leader_officer_id);
CREATE INDEX regions_leader_idx ON regions(leader_officer_id);

CREATE TRIGGER units_code_required_insert BEFORE INSERT ON units
WHEN NEW.code IS NULL OR length(trim(NEW.code)) NOT BETWEEN 1 AND 50
BEGIN SELECT RAISE(ABORT,'Organization code is required'); END;
CREATE TRIGGER units_code_required_update BEFORE UPDATE OF code ON units
WHEN NEW.code IS NULL OR length(trim(NEW.code)) NOT BETWEEN 1 AND 50
BEGIN SELECT RAISE(ABORT,'Organization code is required'); END;
CREATE TRIGGER regions_code_required_insert BEFORE INSERT ON regions
WHEN NEW.code IS NULL OR length(trim(NEW.code)) NOT BETWEEN 1 AND 50
BEGIN SELECT RAISE(ABORT,'Region code is required'); END;
CREATE TRIGGER regions_code_required_update BEFORE UPDATE OF code ON regions
WHEN NEW.code IS NULL OR length(trim(NEW.code)) NOT BETWEEN 1 AND 50
BEGIN SELECT RAISE(ABORT,'Region code is required'); END;

CREATE TRIGGER units_root_read_only BEFORE UPDATE ON units
WHEN OLD.level='ROOT'
BEGIN SELECT RAISE(ABORT,'Root organization is read-only'); END;
CREATE TRIGGER units_no_delete BEFORE DELETE ON units
BEGIN SELECT RAISE(ABORT,'Organization history cannot be deleted'); END;
CREATE TRIGGER regions_no_delete BEFORE DELETE ON regions
BEGIN SELECT RAISE(ABORT,'Organization history cannot be deleted'); END;
CREATE TRIGGER officers_no_delete BEFORE DELETE ON officers
BEGIN SELECT RAISE(ABORT,'Officer history cannot be deleted'); END;
CREATE TRIGGER units_no_cycle BEFORE UPDATE OF parent_id ON units
WHEN NEW.parent_id IS NOT NULL AND NEW.parent_id<>coalesce(OLD.parent_id,'')
BEGIN
  SELECT CASE WHEN NEW.parent_id IN (
    WITH RECURSIVE descendants(id) AS (
      SELECT OLD.id UNION SELECT u.id FROM units u JOIN descendants d ON u.parent_id=d.id
    ) SELECT id FROM descendants
  ) THEN RAISE(ABORT,'Organization hierarchy cannot contain a cycle') END;
END;
