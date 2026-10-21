import { assert } from "../../core/errors.js";
import { facilityScope } from "../authorization/authorization.service.js";
import { planScope, requirePlanning } from "./planning.helpers.js";

// ---------------------------------------------------------------------------
// Scoped row fetchers — always 404 (never reveal out-of-scope records)
// ---------------------------------------------------------------------------

export function scopedPlan(db, user, id) {
  requirePlanning(user);
  const scope = planScope(user);
  const plan = db
    .prepare(
      `SELECT p.*,u.name AS unit_name,a.full_name AS created_by_name
      FROM inspection_plans p JOIN units u ON u.id=p.unit_id
      JOIN accounts a ON a.id=p.created_by WHERE ${scope.sql} AND p.id=?`,
    )
    .get(...scope.params, id);
  assert(plan, 404, "NOT_FOUND", "Không tìm thấy kế hoạch trong phạm vi được cấp.");
  return plan;
}

export function scopedFacility(db, user, facilityId) {
  const scope = facilityScope(user);
  const facility = db
    .prepare(
      `SELECT f.*,r.name AS region_name,r.unit_id,u.name AS unit_name
      FROM facilities f JOIN regions r ON r.id=f.region_id JOIN units u ON u.id=r.unit_id
      WHERE ${scope.sql} AND f.id=?`,
    )
    .get(...scope.params, facilityId);
  assert(facility, 404, "NOT_FOUND", "Không tìm thấy cơ sở trong phạm vi được cấp.");
  return facility;
}

export function scopedPeriodicInspection(db, user, id) {
  requirePlanning(user);
  const scope = facilityScope(user);
  const row = db
    .prepare(
      `SELECT i.*,f.name AS facility_name,f.address AS facility_address,r.name AS region_name,
        r.unit_id,o.full_name AS lead_officer_name,s.id AS schedule_id,s.start_time,s.end_time,
        s.location,s.status AS schedule_status,s.version AS schedule_version
      FROM inspections i JOIN facilities f ON f.id=i.facility_id
      JOIN regions r ON r.id=f.region_id LEFT JOIN officer_directory o ON o.officer_id=i.lead_officer_id
      LEFT JOIN inspection_schedules s ON s.inspection_id=i.id
      WHERE ${scope.sql} AND i.id=? AND i.kind='periodic'`,
    )
    .get(...scope.params, id);
  assert(row, 404, "NOT_FOUND", "Không tìm thấy cuộc kiểm tra định kỳ trong phạm vi được cấp.");
  return row;
}

// ---------------------------------------------------------------------------
// Officer validation — must be active and belong to the plan's unit
// ---------------------------------------------------------------------------

export function ensureOfficer(db, officerId, unitId) {
  const officer = db
    .prepare("SELECT id,full_name,unit_id,status FROM officers WHERE id=?")
    .get(officerId);
  assert(
    officer?.status === "ACTIVE",
    400,
    "INVALID_INPUT",
    "Cán bộ phụ trách không hợp lệ hoặc đã ngừng hoạt động.",
  );
  assert(
    officer.unit_id === unitId,
    400,
    "INVALID_INPUT",
    "Cán bộ phụ trách không thuộc đơn vị của cơ sở.",
  );
  return officer;
}
