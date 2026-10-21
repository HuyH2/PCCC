import { transaction } from "../../core/database.js";
import { assert } from "../../core/errors.js";
import { object, pagination, text } from "../../core/validation.js";
import { writeAudit } from "../audit/audit.service.js";
import { assertUniqueNameAndAddress, getFacility } from "./facilities.service.js";
import { facilityScope, requirePermission } from "../authorization/authorization.service.js";
import { requireAdministrator } from "../authorization/authorization.service.js";

const statuses = new Set(["active", "paused", "suspended", "unlicensed"]);
const timePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[+-]\d{2}:\d{2})$/;
function trimmedText(value, field, max) {
  text(value, field, 1, max);
  return text(value.trim(), field, 1, max);
}

function parseFilters(url) {
  const bounds = {};
  for (const key of ["from", "to"]) {
    const raw = url.searchParams.get(key);
    if (!raw) continue;
    assert(
      timePattern.test(raw) &&
        Number.isFinite(Date.parse(raw)) &&
        new Date(raw.slice(0, 10)).toISOString().slice(0, 10) === raw.slice(0, 10),
      400,
      "INVALID_INPUT",
      "Thời gian cần có múi giờ ISO 8601.",
    );
    bounds[key] = Date.parse(raw);
  }
  assert(
    bounds.from == null || bounds.to == null || bounds.from <= bounds.to,
    400,
    "INVALID_INPUT",
    "Khoảng thời gian không hợp lệ.",
  );
  const type = url.searchParams.get("type") || "all";
  assert(
    ["all", "status", "details"].includes(type),
    400,
    "INVALID_INPUT",
    "Loại thay đổi không hợp lệ.",
  );
  return { ...bounds, type, ...pagination(url) };
}

function historyWhere(filters, prefix) {
  const clauses = [];
  const params = [];
  if (filters.from != null) {
    clauses.push(`${prefix} >= ?`);
    params.push(filters.from);
  }
  if (filters.to != null) {
    clauses.push(`${prefix} <= ?`);
    params.push(filters.to);
  }
  return { sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", params };
}

export function getFacilityStatus(db, user, id) {
  const { facility } = getFacility(db, user, id);
  return { facilityId: id, status: facility.status };
}

export function listFacilityViolations(db, user, url) {
  requirePermission(user, "M03.view");
  const { page, pageSize } = pagination(url);
  const status = url.searchParams.get("status") || "all";
  assert(
    ["all", "suspended", "restored"].includes(status),
    400,
    "INVALID_INPUT",
    "Trạng thái hồ sơ đình chỉ không hợp lệ.",
  );
  const scope = facilityScope(user);
  const where = `${scope.sql}${status === "all" ? "" : " AND v.status=?"}`;
  const params = [...scope.params, ...(status === "all" ? [] : [status])];
  return {
    items: db
      .prepare(
        `SELECT v.*,f.name AS facility_name,f.status AS facility_status,
        a.full_name AS suspended_by_name,p.full_name AS approved_by_name
      FROM facility_violations v JOIN facilities f ON f.id=v.facility_id
      JOIN accounts a ON a.id=v.suspended_by LEFT JOIN accounts p ON p.id=v.approved_by
      WHERE ${where} ORDER BY v.suspension_at DESC,v.id DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize),
    total: db
      .prepare(
        `SELECT count(*) AS n FROM facility_violations v
      JOIN facilities f ON f.id=v.facility_id WHERE ${where}`,
      )
      .get(...params).n,
    page,
    pageSize,
  };
}

export function listFacilityStatusHistory(db, user, id, url) {
  getFacility(db, user, id);
  const filters = parseFilters(url);
  const where = historyWhere(filters, "h.occurred_at");
  const params = [id, ...where.params];
  return {
    items: db
      .prepare(
        `SELECT h.*, a.full_name AS actor_name, a.username AS actor_username
      FROM facility_status_history h JOIN accounts a ON a.id=h.actor_id
      WHERE h.facility_id=?${where.sql} ORDER BY h.occurred_at DESC,h.id DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, filters.pageSize, (filters.page - 1) * filters.pageSize),
    total: db
      .prepare(
        `SELECT count(*) AS n FROM facility_status_history h WHERE h.facility_id=?${where.sql}`,
      )
      .get(...params).n,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export function listFacilityChanges(db, user, id, url) {
  getFacility(db, user, id);
  const filters = parseFilters(url);
  const where = historyWhere(filters, "l.occurred_at");
  const params = [id, ...where.params];
  return {
    items: db
      .prepare(
        `SELECT l.id,l.action,l.before_json,l.after_json,l.occurred_at,
        a.full_name AS actor_name,a.username AS actor_username
      FROM audit_logs l LEFT JOIN accounts a ON a.id=l.actor_id
      WHERE l.object_type='facility' AND l.object_id=? AND l.action='facility.details_updated'${where.sql}
      ORDER BY l.occurred_at DESC,l.id DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, filters.pageSize, (filters.page - 1) * filters.pageSize),
    total: db
      .prepare(
        `SELECT count(*) AS n FROM audit_logs l WHERE l.object_type='facility'
      AND l.object_id=? AND l.action='facility.details_updated'${where.sql}`,
      )
      .get(...params).n,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export function listFacilityTimeline(db, user, id, url) {
  getFacility(db, user, id);
  const filters = parseFilters(url);
  const statusWhere = historyWhere(filters, "h.occurred_at");
  const detailWhere = historyWhere(filters, "l.occurred_at");
  const segments = [];
  const params = [];
  if (filters.type !== "details") {
    segments.push(`SELECT 'status' AS type,h.id AS id,h.previous_status AS previous_status,
      h.new_status AS new_status,h.reason AS reason,h.decision_reference AS decision_reference,
      NULL AS before_json,NULL AS after_json,
      h.occurred_at AS occurred_at,a.full_name AS actor_name,a.username AS actor_username
      FROM facility_status_history h JOIN accounts a ON a.id=h.actor_id
      WHERE h.facility_id=?${statusWhere.sql}`);
    params.push(id, ...statusWhere.params);
  }
  if (filters.type !== "status") {
    segments.push(`SELECT 'details' AS type,l.id AS id,NULL AS previous_status,NULL AS new_status,
      NULL AS reason,NULL AS decision_reference,l.before_json AS before_json,l.after_json AS after_json,
      l.occurred_at AS occurred_at,a.full_name AS actor_name,a.username AS actor_username
      FROM audit_logs l LEFT JOIN accounts a ON a.id=l.actor_id
      WHERE l.object_type='facility' AND l.object_id=? AND l.action='facility.details_updated'${detailWhere.sql}`);
    params.push(id, ...detailWhere.params);
  }
  const union = segments.join(" UNION ALL ");
  return {
    items: db
      .prepare(
        `SELECT * FROM (${union}) ORDER BY occurred_at DESC,type DESC,id DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, filters.pageSize, (filters.page - 1) * filters.pageSize),
    total: db.prepare(`SELECT count(*) AS n FROM (${union})`).get(...params).n,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export function updateFacilityDetails(db, user, id, input, ip) {
  requirePermission(user, "M03.edit");
  const before = getFacility(db, user, id).facility;
  object(input, ["name", "address"]);
  assert(Object.keys(input).length > 0, 400, "INVALID_INPUT", "Cần có thông tin thay đổi.");
  const name = input.name === undefined ? before.name : trimmedText(input.name, "Tên cơ sở", 200);
  const address =
    input.address === undefined ? before.address : trimmedText(input.address, "Địa chỉ", 500);
  assert(
    name !== before.name || address !== before.address,
    409,
    "NO_CHANGE",
    "Thông tin cơ sở không thay đổi.",
  );
  return transaction(db, () => {
    assertUniqueNameAndAddress(db, name, address, id);
    db.prepare("UPDATE facilities SET name=?,address=? WHERE id=?").run(name, address, id);
    const after = { ...before, name, address };
    writeAudit(db, {
      actorId: user.id,
      feature: "M03",
      objectType: "facility",
      objectId: id,
      action: "facility.details_updated",
      before: { name: before.name, address: before.address },
      after: { name, address },
      ip,
    });
    return { facility: after };
  });
}

export function updateFacilityStatus(db, user, id, input, ip) {
  const before = getFacility(db, user, id).facility;
  object(input, [
    "status",
    "reason",
    "decisionReference",
    "remediationEvidence",
    "approvalConfirmed",
  ]);
  const status = text(input.status, "Trạng thái", 1, 30);
  assert(statuses.has(status), 400, "INVALID_INPUT", "Trạng thái cơ sở không hợp lệ.");
  assert(status !== before.status, 409, "NO_CHANGE", "Trạng thái cơ sở không thay đổi.");
  const reason = trimmedText(input.reason, "Lý do", 1000);
  const administrator = user.role === "A05" && user.scopes.some((scope) => scope.kind === "all");
  if (before.status === "suspended") {
    assert(
      status === "active",
      409,
      "INVALID_TRANSITION",
      "Cơ sở đình chỉ chỉ có thể được phê duyệt hoạt động lại.",
    );
    requireAdministrator(user, "M01.edit");
    assert(
      input.approvalConfirmed === true,
      400,
      "APPROVAL_REQUIRED",
      "Admin phải xác nhận phê duyệt hoạt động lại.",
    );
    trimmedText(input.remediationEvidence, "Hồ sơ khắc phục", 2000);
    trimmedText(input.decisionReference, "Số quyết định hoạt động lại", 200);
  } else if (status === "suspended") {
    if (administrator) requireAdministrator(user, "M01.edit");
    else requirePermission(user, "M03.approve");
    trimmedText(input.decisionReference, "Số quyết định đình chỉ", 200);
    assert(
      input.remediationEvidence === undefined && input.approvalConfirmed === undefined,
      400,
      "INVALID_INPUT",
      "Hồ sơ khắc phục chỉ dùng khi phê duyệt hoạt động lại.",
    );
  } else {
    requirePermission(user, "M03.edit");
    assert(
      input.decisionReference === undefined &&
        input.remediationEvidence === undefined &&
        input.approvalConfirmed === undefined,
      400,
      "INVALID_INPUT",
      "Thông tin quyết định/phê duyệt chỉ dùng cho đình chỉ hoặc hoạt động lại.",
    );
  }
  return transaction(db, () => {
    const openCase =
      before.status === "suspended"
        ? db
            .prepare(
              "SELECT id FROM facility_violations WHERE facility_id=? AND status='suspended'",
            )
            .get(id)
        : null;
    if (before.status === "suspended")
      assert(openCase, 409, "MISSING_VIOLATION", "Không tìm thấy hồ sơ đình chỉ để phê duyệt.");
    const changed = db
      .prepare("UPDATE facilities SET status=? WHERE id=? AND status=?")
      .run(status, id, before.status);
    assert(changed.changes === 1, 409, "STALE_STATUS", "Trạng thái đã thay đổi. Vui lòng tải lại.");
    const now = Date.now();
    const auditId = writeAudit(db, {
      actorId: user.id,
      feature: "M03",
      objectType: "facility",
      objectId: id,
      action: "facility.status_changed",
      before: { status: before.status },
      after: {
        status,
        reason,
        decisionReference: input.decisionReference ?? null,
        remediationEvidence: input.remediationEvidence ?? null,
        approvalConfirmed: input.approvalConfirmed ?? null,
      },
      ip,
    });
    db.prepare(
      `INSERT INTO facility_status_history
      (facility_id,previous_status,new_status,reason,decision_reference,actor_id,occurred_at,audit_log_id)
      VALUES (?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      before.status,
      status,
      reason,
      input.decisionReference?.trim() ?? null,
      user.id,
      now,
      auditId,
    );
    if (status === "suspended")
      db.prepare(
        `INSERT INTO facility_violations
        (facility_id,description,suspension_decision_reference,suspension_at,suspended_by)
        VALUES (?,?,?,?,?)`,
      ).run(id, reason, input.decisionReference.trim(), now, user.id);
    if (before.status === "suspended")
      db.prepare(
        `UPDATE facility_violations SET status='restored',remediation_evidence=?,
        restoration_decision_reference=?,approved_by=?,approved_at=? WHERE id=?`,
      ).run(
        input.remediationEvidence.trim(),
        input.decisionReference.trim(),
        user.id,
        now,
        openCase.id,
      );
    return { facilityId: id, status, previousStatus: before.status, occurredAt: now };
  });
}
