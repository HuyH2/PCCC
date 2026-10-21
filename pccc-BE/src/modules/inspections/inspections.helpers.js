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

export async function nextCode(db, now) {
  const year = new Date(now).getFullYear();
  const prefix = `KT-${year}-`;
  const last = await db
    .prepare("SELECT code FROM inspections WHERE code LIKE ? ORDER BY code DESC LIMIT 1")
    .get(`${prefix}%`);
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
// Permission
// ---------------------------------------------------------------------------

export function requireInspectionAccess(user, action = "view") {
  requirePermission(user, "M06.view");
  if (action !== "view") requirePermission(user, `M06.${action}`);
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
