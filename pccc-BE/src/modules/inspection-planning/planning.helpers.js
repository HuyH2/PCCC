import { assert } from "../../core/errors.js";
import { object, text } from "../../core/validation.js";
import { requirePermission } from "../authorization/authorization.service.js";

// ---------------------------------------------------------------------------
// File size limit (same env variable as inspections module)
// ---------------------------------------------------------------------------

export const MAX_FILE_BYTES = Number(process.env.INSPECTION_DOCUMENT_MAX_BYTES ?? 5 * 1024 * 1024);
if (
  !Number.isInteger(MAX_FILE_BYTES) ||
  MAX_FILE_BYTES < 1024 ||
  MAX_FILE_BYTES > 10 * 1024 * 1024
) {
  throw new Error("INSPECTION_DOCUMENT_MAX_BYTES must be an integer between 1024 and 10485760.");
}

// ---------------------------------------------------------------------------
// File type validators (planning documents sent as base64 in JSON body)
// ---------------------------------------------------------------------------

const FILE_VALIDATORS = {
  "application/pdf": (data) => data.subarray(0, 5).toString() === "%PDF-",
  "image/jpeg": (data) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
  "image/png": (data) =>
    data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
};

// ---------------------------------------------------------------------------
// Primitive validators
// ---------------------------------------------------------------------------

export function trimmed(value, label, min, max) {
  return text(typeof value === "string" ? value.trim() : value, label, min, max);
}

export function optionalText(value, label, max) {
  return value == null ? "" : trimmed(value, label, 0, max);
}

export function integer(value, label, min, max) {
  assert(
    Number.isInteger(value) && value >= min && value <= max,
    400,
    "INVALID_INPUT",
    `${label} không hợp lệ.`,
  );
  return value;
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

export function optionalTime(value, label) {
  if (value == null || value === "") return null;
  assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(value), 400, "INVALID_INPUT", `${label} không hợp lệ.`);
  return value;
}

// ---------------------------------------------------------------------------
// Permission & role guards
// ---------------------------------------------------------------------------

export function requirePlanning(user, action = "view") {
  requirePermission(user, "M06.view");
  if (action !== "view") requirePermission(user, `M06.${action}`);
}

export function requireRole(user, roles, message) {
  assert(roles.includes(user.role), 403, "FORBIDDEN", message);
}

// ---------------------------------------------------------------------------
// Scope builder — maps user scopes to plan-level SQL predicate
// ---------------------------------------------------------------------------

export function planScope(user) {
  if (user.scopes.some((scope) => scope.kind === "all")) return { sql: "1=1", params: [] };
  const clauses = [];
  const params = [];
  for (const scope of user.scopes) {
    if (scope.kind === "unit") {
      clauses.push(`p.unit_id IN (WITH RECURSIVE d(id) AS (
        SELECT id FROM units WHERE id=? UNION SELECT u.id FROM units u JOIN d ON u.parent_id=d.id
      ) SELECT id FROM d)`);
      params.push(scope.targetId);
    } else if (scope.kind === "region") {
      clauses.push(`(SELECT unit_id FROM regions WHERE id=?) IN (
        WITH RECURSIVE d(id) AS (
          SELECT p.unit_id UNION SELECT u.id FROM units u JOIN d ON u.parent_id=d.id
        ) SELECT id FROM d)`);
      params.push(scope.targetId);
    } else if (scope.kind === "facility") {
      clauses.push(`(SELECT r.unit_id FROM facilities f
        JOIN regions r ON r.id=f.region_id WHERE f.id=?) IN (
          WITH RECURSIVE d(id) AS (
            SELECT p.unit_id UNION SELECT u.id FROM units u JOIN d ON u.parent_id=d.id
          ) SELECT id FROM d)`);
      params.push(scope.targetId);
    }
  }
  return { sql: clauses.length ? `(${clauses.join(" OR ")})` : "0=1", params };
}

// ---------------------------------------------------------------------------
// Unit hierarchy helper
// ---------------------------------------------------------------------------

export async function unitWithin(db, childUnitId, parentUnitId) {
  return Boolean(
    await db
      .prepare(
        `WITH RECURSIVE d(id) AS (
          SELECT id FROM units WHERE id=?
          UNION SELECT u.id FROM units u JOIN d ON u.parent_id=d.id
        ) SELECT 1 FROM d WHERE id=?`,
      )
      .get(parentUnitId, childUnitId),
  );
}

// ---------------------------------------------------------------------------
// Base64 file parser — used by planning documents embedded in JSON payloads
// ---------------------------------------------------------------------------

export function parseFile(value, label = "Tệp đính kèm") {
  if (value == null) return null;
  object(value, ["name", "content_type", "content_base64"]);
  const name = trimmed(value.name, "Tên file", 1, 255);
  const contentType = value.content_type;
  assert(
    FILE_VALIDATORS[contentType],
    400,
    "INVALID_INPUT",
    `${label} chỉ nhận PDF, JPEG hoặc PNG.`,
  );
  assert(
    typeof value.content_base64 === "string" &&
      value.content_base64.length > 0 &&
      value.content_base64.length % 4 === 0 &&
      /^[A-Za-z0-9+/]*={0,2}$/.test(value.content_base64),
    400,
    "INVALID_INPUT",
    `${label} không hợp lệ.`,
  );
  const data = Buffer.from(value.content_base64, "base64");
  assert(
    data.length > 0 && data.length <= MAX_FILE_BYTES,
    413,
    "FILE_TOO_LARGE",
    `File tối đa ${(MAX_FILE_BYTES / 1048576).toFixed(1)} MB.`,
  );
  assert(
    FILE_VALIDATORS[contentType](data),
    400,
    "INVALID_INPUT",
    "Nội dung file không khớp định dạng khai báo.",
  );
  return { name, contentType, data };
}
