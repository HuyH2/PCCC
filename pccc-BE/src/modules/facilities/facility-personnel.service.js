import { randomUUID } from "node:crypto";
import { transaction } from "../../core/database.js";
import { assert } from "../../core/errors.js";
import { object, pagination, text } from "../../core/validation.js";
import { writeAudit } from "../audit/audit.service.js";
import { requirePermission } from "../authorization/authorization.service.js";
import { getFacility } from "./facilities.service.js";

// ============================================================================
// Constants & Regex Patterns
// ============================================================================

const phonePattern = /^[0-9+().\s-]{8,25}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const personnelColumns = `
  p.id,
  p.facility_id,
  p.full_name,
  p.position,
  p.phone,
  p.email,
  p.is_head,
  p.training_status,
  p.certificate_expiry,
  p.notes,
  p.is_active,
  p.version,
  p.created_by,
  p.updated_by,
  p.created_at,
  p.updated_at,
  creator.full_name AS created_by_name,
  updater.full_name AS updated_by_name
`.trim();

// ============================================================================
// Internal Validation Helpers
// ============================================================================

function trimmed(value, label, min, max) {
  text(value, label, min, max);
  return text(value.trim(), label, min, max);
}

function nullableText(value, label, max) {
  if (value == null || value === "") {
    return null;
  }
  return trimmed(value, label, 1, max);
}

function date(value, label) {
  if (value == null || value === "") {
    return null;
  }
  assert(
    typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
    400,
    "INVALID_INPUT",
    `${label} không hợp lệ.`,
  );
  return value;
}

/**
 * Validate input payload for creating or updating facility personnel.
 * Enforces field lengths, phone/email formats, active status for head of facility,
 * and optimistic lock version matching on update.
 */
function validatePersonnel(input, before = null) {
  object(input, [
    "fullName",
    "position",
    "phone",
    "email",
    "isHead",
    "trainingStatus",
    "certificateExpiry",
    "notes",
    "isActive",
    "version",
  ]);

  const fullName = trimmed(input.fullName, "Họ và tên", 1, 150);
  const position = trimmed(input.position, "Chức vụ/vai trò", 1, 150);
  const phone = nullableText(input.phone, "Số điện thoại", 25);
  const email = nullableText(input.email, "Email", 254)?.toLowerCase() ?? null;

  assert(!phone || phonePattern.test(phone), 400, "INVALID_INPUT", "Số điện thoại không hợp lệ.");
  assert(!email || emailPattern.test(email), 400, "INVALID_INPUT", "Email không hợp lệ.");
  assert(
    typeof input.isHead === "boolean",
    400,
    "INVALID_INPUT",
    "Vai trò người đứng đầu không hợp lệ.",
  );

  const isActive = input.isActive === undefined ? true : input.isActive;
  assert(typeof isActive === "boolean", 400, "INVALID_INPUT", "Trạng thái nhân sự không hợp lệ.");
  assert(!input.isHead || isActive, 400, "INVALID_INPUT", "Người đứng đầu phải đang hoạt động.");

  if (before) {
    assert(
      Number.isInteger(input.version) && input.version === before.version,
      409,
      "VERSION_CONFLICT",
      "Hồ sơ nhân sự đã thay đổi. Hãy tải lại trước khi lưu.",
    );
  }

  return {
    fullName,
    position,
    phone,
    email,
    isHead: Number(input.isHead),
    trainingStatus: nullableText(input.trainingStatus, "Tình trạng huấn luyện", 100),
    certificateExpiry: date(input.certificateExpiry, "Hạn chứng nhận"),
    notes: nullableText(input.notes, "Ghi chú", 2000) ?? "",
    isActive: Number(isActive),
  };
}

/**
 * Ensures only one active head of facility exists per facility.
 * If a new active head is designated, any existing active head is stepped down
 * with version incremented and an audit record created.
 */
function auditHeadReplacement(db, user, ip, facilityId, replacementId, now) {
  const previousHead = db
    .prepare(
      `SELECT * FROM facility_personnel
       WHERE facility_id = ? AND is_head = 1 AND is_active = 1 AND id <> ?`,
    )
    .get(facilityId, replacementId);

  if (!previousHead) {
    return;
  }

  db.prepare(
    `UPDATE facility_personnel
     SET is_head = 0, version = version + 1, updated_by = ?, updated_at = ?
     WHERE id = ?`,
  ).run(user.id, now, previousHead.id);

  writeAudit(db, {
    actorId: user.id,
    feature: "M03",
    objectType: "facility_personnel",
    objectId: previousHead.id,
    action: "facility.personnel_head_reassigned",
    before: { is_head: 1 },
    after: { is_head: 0, replacement_id: replacementId },
    ip,
  });
}

// ============================================================================
// Public Personnel Services (UC-FAC-03)
// ============================================================================

/**
 * Fetch a single personnel row with creator/updater details.
 * Exported so other facility services (such as attachments) can verify personnel ownership.
 */
export function personnelRow(db, facilityId, personnelId) {
  return db
    .prepare(
      `SELECT ${personnelColumns}
       FROM facility_personnel p
       JOIN accounts creator ON creator.id = p.created_by
       JOIN accounts updater ON updater.id = p.updated_by
       WHERE p.facility_id = ? AND p.id = ?`,
    )
    .get(facilityId, personnelId);
}

/**
 * List facility personnel with pagination, ordered by head-first, active-first, then name.
 */
export function listFacilityPersonnel(db, user, facilityId, url) {
  getFacility(db, user, facilityId);
  const { page, pageSize } = pagination(url);
  const includeInactive = url.searchParams.get("includeInactive") === "true";
  const where = `p.facility_id = ?${includeInactive ? "" : " AND p.is_active = 1"}`;

  const items = db
    .prepare(
      `SELECT ${personnelColumns}
       FROM facility_personnel p
       JOIN accounts creator ON creator.id = p.created_by
       JOIN accounts updater ON updater.id = p.updated_by
       WHERE ${where}
       ORDER BY p.is_head DESC, p.is_active DESC, p.full_name, p.id
       LIMIT ? OFFSET ?`,
    )
    .all(facilityId, pageSize, (page - 1) * pageSize);

  const total = db
    .prepare(`SELECT count(*) AS n FROM facility_personnel p WHERE ${where}`)
    .get(facilityId).n;

  return {
    items,
    total,
    page,
    pageSize,
  };
}

/**
 * Get detailed information of a specific personnel in a facility.
 */
export function getFacilityPersonnel(db, user, facilityId, personnelId) {
  getFacility(db, user, facilityId);
  const personnel = personnelRow(db, facilityId, personnelId);
  assert(personnel, 404, "NOT_FOUND", "Không tìm thấy nhân sự trong cơ sở này.");
  return { personnel };
}

/**
 * Create or update a personnel record in a facility.
 * Enforces M03.edit permission, facility data scope, optimistic locking, and head reassignment audit.
 */
export function saveFacilityPersonnel(db, user, facilityId, input, personnelId, ip) {
  requirePermission(user, "M03.edit");
  getFacility(db, user, facilityId);

  const before = personnelId
    ? getFacilityPersonnel(db, user, facilityId, personnelId).personnel
    : null;
  const values = validatePersonnel(input, before);

  return transaction(db, () => {
    const id = personnelId ?? randomUUID();
    const now = Date.now();

    if (values.isHead) {
      auditHeadReplacement(db, user, ip, facilityId, id, now);
    }

    if (before) {
      db.prepare(
        `UPDATE facility_personnel
         SET full_name = ?, position = ?, phone = ?, email = ?, is_head = ?,
             training_status = ?, certificate_expiry = ?, notes = ?, is_active = ?,
             version = version + 1, updated_by = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        values.fullName,
        values.position,
        values.phone,
        values.email,
        values.isHead,
        values.trainingStatus,
        values.certificateExpiry,
        values.notes,
        values.isActive,
        user.id,
        now,
        id,
      );
    } else {
      db.prepare(
        `INSERT INTO facility_personnel (
           id, facility_id, full_name, position, phone, email, is_head,
           training_status, certificate_expiry, notes, is_active,
           created_by, updated_by, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        facilityId,
        values.fullName,
        values.position,
        values.phone,
        values.email,
        values.isHead,
        values.trainingStatus,
        values.certificateExpiry,
        values.notes,
        values.isActive,
        user.id,
        user.id,
        now,
        now,
      );
    }

    const after = personnelRow(db, facilityId, id);
    writeAudit(db, {
      actorId: user.id,
      feature: "M03",
      objectType: "facility_personnel",
      objectId: id,
      action: before ? "facility.personnel_updated" : "facility.personnel_created",
      before,
      after,
      ip,
    });

    return { personnel: after };
  });
}
