-- Locking checklist results ("Chốt kết quả"). The status CHECK of inspections cannot be altered in
-- place and a table rebuild breaks child foreign keys inside the migration transaction, so the API
-- derives status 'evaluated' = in_progress + results_submitted_at (see inspections.service.js).
ALTER TABLE inspections ADD COLUMN results_submitted_at INTEGER;
ALTER TABLE inspections ADD COLUMN results_submitted_by TEXT REFERENCES accounts(id);
