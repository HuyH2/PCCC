-- M06 — SCRUM-22: inspection execution and results (UC-INS-06..09).
-- inspections is the shared inspection record: plan/notice/reschedule (teammate 3) and execution
-- (this migration) must use the same inspection_id. Extend it with forward migrations only.

CREATE TABLE inspection_checklists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  -- NULL = applies to every facility type; otherwise a facility-type label (configurable catalog).
  facility_type TEXT CHECK(facility_type IS NULL OR length(trim(facility_type)) BETWEEN 1 AND 100),
  description TEXT NOT NULL DEFAULT '',
  -- Optional link to the guidance document in the M05 library.
  legal_document_id TEXT REFERENCES legal_documents(id),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at INTEGER NOT NULL
);
CREATE INDEX inspection_checklists_type_idx ON inspection_checklists(is_active, facility_type);

CREATE TABLE inspection_checklist_items (
  id TEXT PRIMARY KEY,
  checklist_id TEXT NOT NULL REFERENCES inspection_checklists(id),
  position INTEGER NOT NULL CHECK(position > 0),
  content TEXT NOT NULL CHECK(length(trim(content)) BETWEEN 1 AND 500),
  guidance TEXT NOT NULL DEFAULT '',
  legal_reference TEXT NOT NULL DEFAULT '',
  is_required INTEGER NOT NULL DEFAULT 1 CHECK(is_required IN (0,1)),
  UNIQUE(checklist_id, position)
);

CREATE TABLE inspections (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  kind TEXT NOT NULL CHECK(kind IN ('periodic','unscheduled','thematic')),
  topic TEXT,
  reason TEXT NOT NULL DEFAULT '',
  scheduled_date TEXT NOT NULL,
  lead_officer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed')),
  checklist_id TEXT REFERENCES inspection_checklists(id),
  officer_note TEXT NOT NULL DEFAULT '',
  outcome TEXT CHECK(outcome IS NULL OR outcome IN ('pass','conditional','fail')),
  conclusion TEXT NOT NULL DEFAULT '',
  completed_at INTEGER,
  completed_by TEXT REFERENCES accounts(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  updated_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK(kind <> 'thematic' OR length(trim(coalesce(topic,''))) > 0),
  CHECK(status <> 'completed' OR (outcome IS NOT NULL AND completed_at IS NOT NULL))
);
CREATE INDEX inspections_facility_idx ON inspections(facility_id, scheduled_date);
CREATE INDEX inspections_status_idx ON inspections(status, scheduled_date);

-- One result per checklist item per inspection.
CREATE TABLE inspection_results (
  inspection_id TEXT NOT NULL REFERENCES inspections(id),
  item_id TEXT NOT NULL REFERENCES inspection_checklist_items(id),
  status TEXT NOT NULL CHECK(status IN ('pending','pass','fail','not_applicable')),
  note TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL REFERENCES accounts(id),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(inspection_id, item_id)
);

-- Record (biên bản) and evidence files. No delete API: documents are part of the case history.
CREATE TABLE inspection_documents (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL REFERENCES inspections(id),
  follow_up_id TEXT REFERENCES follow_up_inspections(id),
  kind TEXT NOT NULL CHECK(kind IN ('record','evidence')),
  record_number TEXT,
  description TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK(content_type IN ('application/pdf','image/jpeg','image/png')),
  file_size INTEGER NOT NULL CHECK(file_size > 0),
  file_data BLOB NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES accounts(id),
  uploaded_at INTEGER NOT NULL
);
CREATE INDEX inspection_documents_inspection_idx ON inspection_documents(inspection_id, uploaded_at);

CREATE TABLE follow_up_inspections (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL REFERENCES inspections(id),
  requirement TEXT NOT NULL CHECK(length(trim(requirement)) BETWEEN 1 AND 2000),
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed')),
  outcome TEXT CHECK(outcome IS NULL OR outcome IN ('resolved','unresolved')),
  result_note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  completed_by TEXT REFERENCES accounts(id),
  completed_at INTEGER,
  CHECK((status='open' AND outcome IS NULL AND completed_at IS NULL)
    OR (status='completed' AND outcome IS NOT NULL AND completed_at IS NOT NULL))
);
CREATE INDEX follow_up_inspections_inspection_idx ON follow_up_inspections(inspection_id, created_at);
-- At most one open follow-up per inspection (avoid duplicate submissions).
CREATE UNIQUE INDEX follow_up_inspections_open_idx ON follow_up_inspections(inspection_id) WHERE status='open';
