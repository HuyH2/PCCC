import { randomUUID } from "node:crypto";
import { transaction } from "../../core/database.js";
import { assert } from "../../core/errors.js";
import { object, text } from "../../core/validation.js";
import { officerScope, regionScope } from "../../core/organization.js";
import { writeAudit } from "../audit/audit.service.js";
import { facilityScope, requirePermission } from "../authorization/authorization.service.js";

const facilityStatuses = new Set(["active", "paused", "suspended", "unlicensed"]);

function requiredText(value, field, max) {
  text(value, field, 1, max);
  const normalized = value.trim();
  assert(normalized.length > 0, 400, "INVALID_INPUT", `${field} không được để trống.`);
  return normalized;
}

function facilityQuery(db, principal, id) {
  const scope = facilityScope(principal);
  const facility = db
    .prepare(
      `SELECT f.*,r.name AS region_name,o.full_name AS officer_name
      FROM facilities f JOIN regions r ON r.id=f.region_id
      LEFT JOIN officer_directory o ON o.officer_id=f.officer_id
      WHERE ${scope.sql} AND f.id=?`,
    )
    .get(...scope.params, id);
  assert(facility, 404, "NOT_FOUND", "Không tìm thấy cơ sở trong phạm vi được cấp.");
  return facility;
}

export function assertUniqueNameAndAddress(db, name, address, exceptId = "") {
  assert(
    !db
      .prepare(
        `SELECT 1 FROM facilities
        WHERE id<>? AND fold(trim(name))=fold(trim(?)) AND fold(trim(address))=fold(trim(?))`,
      )
      .get(exceptId, name, address),
    409,
    "DUPLICATE_FACILITY",
    "Đã tồn tại cơ sở cùng tên và địa chỉ.",
  );
}

export function getFacility(db, principal, id) {
  requirePermission(principal, "M03.view");
  return { facility: facilityQuery(db, principal, id) };
}

export function listFacilityOptions(db, principal) {
  const permission = ["M03.view", "M03.create", "M03.edit"].find((code) =>
    principal.permissions.includes(code),
  );
  assert(permission, 403, "FORBIDDEN", "Bạn không có quyền xem danh mục cơ sở.");
  requirePermission(principal, permission);
  const regions = regionScope(principal, "r");
  const officers = officerScope(principal, "o");
  const facilities = facilityScope(principal);
  return {
    regions: db
      .prepare(
        `SELECT r.id,r.name,r.unit_id,u.name AS unit_name FROM regions r
        JOIN units u ON u.id=r.unit_id WHERE ${regions.sql} ORDER BY u.name,r.name,r.id`,
      )
      .all(...regions.params),
    officers: db
      .prepare(
        `SELECT o.id,o.full_name,o.officer_code,o.unit_id FROM officers o
        WHERE o.status='ACTIVE' AND (
          ${officers.sql} OR EXISTS (SELECT 1 FROM facilities f
            WHERE f.officer_id=o.id AND ${facilities.sql})
          OR EXISTS (SELECT 1 FROM region_assignments ra
            JOIN accounts a ON a.id=ra.account_id JOIN regions r ON r.id=ra.region_id
            WHERE a.officer_id=o.id AND ${regions.sql})
        ) ORDER BY o.full_name,o.id`,
      )
      .all(...officers.params, ...facilities.params, ...regions.params),
  };
}

export function listFacilities(
  db,
  principal,
  { page, pageSize, search, regionId = "", officerId = "", status = "" },
) {
  requirePermission(principal, "M03.view");
  assert(search.length <= 100, 400, "INVALID_INPUT", "Từ khóa tìm kiếm quá dài.");
  if (regionId) text(regionId, "Khu vực", 1, 100);
  if (officerId) text(officerId, "Cán bộ", 1, 100);
  if (status)
    assert(facilityStatuses.has(status), 400, "INVALID_INPUT", "Trạng thái cơ sở không hợp lệ.");
  const scope = facilityScope(principal);
  const clauses = [
    scope.sql,
    "(instr(fold(f.name),fold(?))>0 OR instr(fold(f.address),fold(?))>0)",
  ];
  const params = [...scope.params, search, search];
  if (regionId) {
    clauses.push("f.region_id=?");
    params.push(regionId);
  }
  if (officerId) {
    clauses.push("f.officer_id=?");
    params.push(officerId);
  }
  if (status) {
    clauses.push("f.status=?");
    params.push(status);
  }
  const where = clauses.join(" AND ");
  const from = `FROM facilities f JOIN regions r ON r.id=f.region_id
    LEFT JOIN officer_directory o ON o.officer_id=f.officer_id WHERE ${where}`;
  return {
    items: db
      .prepare(
        `SELECT f.*,r.name AS region_name,o.full_name AS officer_name ${from}
        ORDER BY f.id LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize),
    total: db.prepare(`SELECT count(*) AS total ${from}`).get(...params).total,
    page,
    pageSize,
  };
}

export function createFacility(db, principal, input, ip) {
  requirePermission(principal, "M03.create");
  object(input, ["name", "address", "regionId", "officerId"]);
  const name = requiredText(input.name, "Tên cơ sở", 200);
  const address = requiredText(input.address, "Địa chỉ", 500);
  const regionId = requiredText(input.regionId, "Khu vực", 100);
  const officerId = requiredText(input.officerId, "Cán bộ phụ trách", 100);
  const regionWriteScope = regionScope(principal, "r", true);
  const region = db
    .prepare(`SELECT r.id FROM regions r WHERE r.id=? AND ${regionWriteScope.sql}`)
    .get(regionId, ...regionWriteScope.params);
  assert(region, 404, "NOT_FOUND", "Không tìm thấy khu vực trong phạm vi được cấp.");

  const officerReadScope = officerScope(principal, "o");
  const facilityReadScope = facilityScope(principal);
  const officer = db
    .prepare(
      `SELECT o.id FROM officers o WHERE o.id=? AND o.status='ACTIVE' AND (
        ${officerReadScope.sql} OR EXISTS (SELECT 1 FROM facilities f
          WHERE f.region_id=? AND f.officer_id=o.id AND ${facilityReadScope.sql})
        OR EXISTS (SELECT 1 FROM region_assignments ra JOIN accounts a ON a.id=ra.account_id
          WHERE ra.region_id=? AND a.officer_id=o.id)
      )`,
    )
    .get(officerId, ...officerReadScope.params, regionId, ...facilityReadScope.params, regionId);
  assert(officer, 404, "NOT_FOUND", "Không tìm thấy cán bộ trong phạm vi được cấp.");

  return transaction(db, () => {
    assertUniqueNameAndAddress(db, name, address);
    const id = randomUUID();
    db.prepare(
      "INSERT INTO facilities(id,name,address,region_id,officer_id,status) VALUES (?,?,?,?,?,'active')",
    ).run(id, name, address, regionId, officerId);
    const facility = facilityQuery(db, principal, id);
    writeAudit(db, {
      actorId: principal.id,
      feature: "M03",
      objectType: "facility",
      objectId: id,
      action: "facility.created",
      after: facility,
      ip,
    });
    return { facility };
  });
}
