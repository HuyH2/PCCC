import { assert } from "../../core/errors.js";
import { facilityScope, requirePermission } from "../authorization/authorization.service.js";

// M03 — facilities are always filtered by the caller's data scope before search/count/pagination.
export function getFacility(db, principal, id) {
  requirePermission(principal, "M03.view");
  const scope = facilityScope(principal);
  const facility = db
    .prepare(`SELECT f.* FROM facilities f WHERE ${scope.sql} AND f.id=?`)
    .get(...scope.params, id);
  assert(facility, 404, "NOT_FOUND", "Không tìm thấy cơ sở trong phạm vi được cấp.");
  return { facility };
}

export function listFacilities(db, principal, { page, pageSize, search }) {
  requirePermission(principal, "M03.view");
  assert(search.length <= 100, 400, "INVALID_INPUT", "Từ khóa tìm kiếm quá dài.");
  const scope = facilityScope(principal);
  const sql = `${scope.sql} AND (instr(lower(f.name),lower(?))>0 OR instr(lower(f.address),lower(?))>0)`;
  const params = [...scope.params, search, search];
  return {
    items: db
      .prepare(`SELECT f.* FROM facilities f WHERE ${sql} ORDER BY f.id LIMIT ? OFFSET ?`)
      .all(...params, pageSize, (page - 1) * pageSize),
    total: db.prepare(`SELECT count(*) AS total FROM facilities f WHERE ${sql}`).get(...params)
      .total,
    page,
    pageSize,
  };
}
