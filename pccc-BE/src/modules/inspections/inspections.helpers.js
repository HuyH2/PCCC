import { assert } from "../../core/errors.js";
import { text } from "../../core/validation.js";
import { requirePermission } from "../authorization/authorization.service.js";
import { writeAudit } from "../audit/audit.service.js";

// ---------------------------------------------------------------------------
// Primitive validators
// ---------------------------------------------------------------------------

export function trimmed(value, label, min, max) {
  return text(typeof value === "string" ? value.trim() : value, label, min, max);
}

export function date(value, label) {
  assert(
    typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    400,
    "INVALID_INPUT",
    `${label} không hợp lệ.`,
  );
  return value;
}

// ---------------------------------------------------------------------------
// State guards
// ---------------------------------------------------------------------------

export function expectVersion(inspection, version) {
  assert(
    Number.isInteger(version) && inspection.version === version,
    409,
    "VERSION_CONFLICT",
    "Cuộc kiểm tra đã được thay đổi. Hãy tải lại trước khi lưu.",
  );
}

export function expectStatus(inspection, statuses, message) {
  assert(statuses.includes(inspection.status), 409, "INVALID_STATE", message);
}

// ---------------------------------------------------------------------------
// Code generation & checklist lookup
// ---------------------------------------------------------------------------

// Sequential code KT-YYYY-NNNN. Only purely numeric suffixes count, so codes issued earlier
// in another format (e.g. random hex) can never break the sequence.
export async function nextCode(db, year) {
  const prefix = `KT-${year}-`;
  const last = await db
    .prepare("SELECT code FROM inspections WHERE code ~ ? ORDER BY code DESC LIMIT 1")
    .get(`^KT-${year}-[0-9]+$`);
  const sequence = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

export async function activeChecklist(db, id) {
  trimmed(id, "Checklist", 1, 100);
  assert(
    await db.prepare("SELECT 1 FROM inspection_checklists WHERE id=? AND is_active=1").get(id),
    400,
    "INVALID_INPUT",
    "Checklist không tồn tại hoặc đã ngưng sử dụng.",
  );
  return id;
}

// ---------------------------------------------------------------------------
// Schedule conflict: one facility or one lead officer cannot hold two inspections that overlap
// in time on the same day. A missing start/end time is treated as the whole day.
// ---------------------------------------------------------------------------

function timesOverlap(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return true;
  return startA < endB && startB < endA;
}

export async function assertNoScheduleConflict(
  db,
  { facilityId, officerId, date: day, startTime = null, endTime = null, excludeId = null },
) {
  const rows = await db
    .prepare(
      `SELECT i.code,i.facility_id,i.lead_officer_id,s.start_time,s.end_time
      FROM inspection_schedules s JOIN inspections i ON i.id=s.inspection_id
      WHERE s.scheduled_date=? AND s.status<>'cancelled' AND i.id<>?
        AND (i.facility_id=? OR i.lead_officer_id=?)`,
    )
    .all(day, excludeId ?? "", facilityId, officerId);
  const clash = rows.find((row) => timesOverlap(startTime, endTime, row.start_time, row.end_time));
  assert(
    !clash,
    409,
    "SCHEDULE_CONFLICT",
    `Trùng lịch với cuộc kiểm tra ${clash?.code}: cùng ${
      clash?.facility_id === facilityId ? "cơ sở" : "trưởng đoàn"
    } trong khung giờ này.`,
  );
}

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

export function requireInspectionAccess(user, action = "view") {
  requirePermission(user, "M06.view");
  if (action !== "view") requirePermission(user, `M06.${action}`);
}

// Executing an inspection (checklist, record, conclusion, completion, follow-up) belongs to the
// assigned lead officer; the deputy commander (A02) supervises and may act for the team.
export const INSPECTION_SUPERVISOR_ROLES = ["A02"];

export function requireAssignedOfficer(user, inspection) {
  assert(
    INSPECTION_SUPERVISOR_ROLES.includes(user.role) ||
      inspection.lead_officer_id === user.officerId,
    403,
    "FORBIDDEN",
    "Chỉ cán bộ được phân công (trưởng đoàn) hoặc Phó chỉ huy mới được cập nhật cuộc kiểm tra này.",
  );
}

// ---------------------------------------------------------------------------
// Audit shorthand for M06 inspection objects
// ---------------------------------------------------------------------------

export async function writeInspectionAudit(db, user, ip, objectId, action, before, after) {
  await writeAudit(db, {
    actorId: user.id,
    feature: "M06",
    objectType: "inspection",
    objectId,
    action,
    before,
    after,
    ip,
  });
}
