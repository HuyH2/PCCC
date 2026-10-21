-- UC-INS-06: commanders (A01) and deputies (A02) create checklists. Seeded rows keep NULL author.
ALTER TABLE inspection_checklists ADD COLUMN created_by TEXT REFERENCES accounts(id);
-- No two active checklists with the same name for the same facility type.
CREATE UNIQUE INDEX inspection_checklists_active_name_idx
  ON inspection_checklists(lower(name), coalesce(facility_type,'')) WHERE is_active=1;
