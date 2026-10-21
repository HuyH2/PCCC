// M06 — Shared constants and SQL building blocks.
// Every file in this module imports from here instead of redefining values.

export const MAX_INSPECTION_FILE_BYTES = Number(
  process.env.INSPECTION_DOCUMENT_MAX_BYTES ?? 5 * 1024 * 1024,
);
if (
  !Number.isInteger(MAX_INSPECTION_FILE_BYTES) ||
  MAX_INSPECTION_FILE_BYTES < 1024 ||
  MAX_INSPECTION_FILE_BYTES > 10 * 1024 * 1024
)
  throw new Error("INSPECTION_DOCUMENT_MAX_BYTES must be an integer between 1024 and 10485760.");

export const INSPECTION_FILE_SIZE_MESSAGE = `File tối đa ${(
  MAX_INSPECTION_FILE_BYTES /
  (1024 * 1024)
).toFixed(1)} MB.`;

export const INSPECTION_KINDS = ["periodic", "unscheduled", "thematic"];
export const INSPECTION_STATUSES = ["planned", "in_progress", "evaluated", "completed"];
// 'evaluated' (Đã đánh giá) = checklist results locked; derived, see migration 007.
export const STATUS_SQL = `CASE WHEN i.status='in_progress' AND i.results_submitted_at IS NOT NULL
  THEN 'evaluated' ELSE i.status END`;
export const RESULT_STATUSES = ["pending", "pass", "fail", "not_applicable"];
export const OUTCOMES = ["pass", "conditional", "fail"];

export const FILE_TYPES = {
  "application/pdf": {
    extension: /\.pdf$/i,
    valid: (data) => data.subarray(0, 5).toString() === "%PDF-",
  },
  "image/jpeg": {
    extension: /\.jpe?g$/i,
    valid: (data) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
  },
  "image/png": {
    extension: /\.png$/i,
    valid: (data) =>
      data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
};

export const inspectionColumns = `i.id,i.code,i.facility_id,f.name AS facility_name,f.address AS facility_address,
  r.name AS region_name,i.kind,i.topic,i.reason,i.scheduled_date,i.lead_officer_id,
  o.full_name AS lead_officer_name,${STATUS_SQL} AS status,i.checklist_id,c.name AS checklist_name,i.officer_note,
  i.results_submitted_at,rs.full_name AS results_submitted_by_name,
  i.outcome,i.conclusion,i.completed_at,i.completed_by,i.version,i.created_by,i.updated_by,
  i.created_at,i.updated_at`;

export const inspectionJoins = `inspections i JOIN facilities f ON f.id=i.facility_id
  JOIN regions r ON r.id=f.region_id
  LEFT JOIN officer_directory o ON o.officer_id=i.lead_officer_id
  LEFT JOIN inspection_checklists c ON c.id=i.checklist_id
  LEFT JOIN accounts rs ON rs.id=i.results_submitted_by`;
