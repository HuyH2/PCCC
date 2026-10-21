import { randomUUID } from "node:crypto";
import { assert } from "../../core/errors.js";
import { object, pagination } from "../../core/validation.js";
import { foldSearchText, transaction } from "../../core/database.js";
import { facilityScope, unitScope } from "../authorization/authorization.service.js";
import { writeAudit } from "../audit/audit.service.js";
import {
  trimmed,
  optionalText,
  integer,
  requirePlanning,
  requireRole,
  planScope,
} from "./planning.helpers.js";
import { scopedPlan } from "./planning.queries.js";

const PLAN_ROLES = ["A01", "A02", "A04"];
const ALLOCATION_ROLES = ["A01", "A02"];
const PLAN_STATUSES = ["draft", "published", "closed"];

// ---------------------------------------------------------------------------
// List & detail
// ---------------------------------------------------------------------------

export function listPlans(db, user, url) {
  requirePlanning(user);
  const { page, pageSize } = pagination(url);
  const scope = planScope(user);
  const clauses = [scope.sql];
  const params = [...scope.params];
  const q = foldSearchText(optionalText(url.searchParams.get("q"), "Từ khóa", 200));
  if (q) {
    clauses.push("(instr(fold(p.code),?)>0 OR instr(fold(p.title),?)>0)");
    params.push(q, q);
  }
  const year = url.searchParams.get("year");
  if (year != null) {
    assert(/^\d{4}$/.test(year), 400, "INVALID_INPUT", "Năm không hợp lệ.");
    clauses.push("p.year=?");
    params.push(Number(year));
  }
  const status = url.searchParams.get("status");
  if (status) {
    assert(
      PLAN_STATUSES.includes(status),
      400,
      "INVALID_INPUT",
      "Trạng thái kế hoạch không hợp lệ.",
    );
    clauses.push("p.status=?");
    params.push(status);
  }
  const where = clauses.join(" AND ");
  const base = `FROM inspection_plans p JOIN units u ON u.id=p.unit_id WHERE ${where}`;
  return {
    items: db
      .prepare(
        `SELECT p.*,u.name AS unit_name,
          (SELECT count(*) FROM inspections i WHERE i.plan_id=p.id) AS inspection_count,
          (SELECT count(*) FROM inspections i WHERE i.plan_id=p.id AND i.status='completed') AS completed_count
        ${base} ORDER BY p.year DESC,p.updated_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize),
    total: db.prepare(`SELECT count(*) AS n ${base}`).get(...params).n,
    page,
    pageSize,
  };
}

export function planDetail(db, user, id) {
  const plan = scopedPlan(db, user, id);
  const targets = db
    .prepare(
      `SELECT t.*,o.full_name AS officer_name,r.name AS region_name,
        (WITH RECURSIVE descendants(id) AS (
          SELECT t.id UNION ALL SELECT child.id FROM inspection_targets child
          JOIN descendants d ON child.parent_id=d.id
        ) SELECT count(*) FROM inspections i WHERE i.plan_id=t.plan_id
          AND (t.period_type='year' OR i.target_id IN (SELECT id FROM descendants))) AS actual_count
      FROM inspection_targets t LEFT JOIN officers o ON o.id=t.officer_id
      LEFT JOIN regions r ON r.id=t.region_id WHERE t.plan_id=?
      ORDER BY CASE t.period_type WHEN 'year' THEN 1 WHEN 'month' THEN 2 ELSE 3 END,
        t.month,t.week,o.full_name`,
    )
    .all(id);
  return { plan, targets };
}

// ---------------------------------------------------------------------------
// Create & update plan
// ---------------------------------------------------------------------------

export function createPlan(db, user, payload, ip) {
  requirePlanning(user, "create");
  requireRole(user, PLAN_ROLES, "Vai trò hiện tại không được lập kế hoạch kiểm tra năm.");
  object(payload, [
    "code",
    "year",
    "title",
    "facility_group",
    "legal_basis",
    "unit_id",
    "annual_target",
    "status",
  ]);
  const year = integer(payload.year, "Năm kế hoạch", 2000, 2100);
  const title = trimmed(payload.title, "Tên kế hoạch", 1, 300);
  const unitId = trimmed(payload.unit_id, "Đơn vị", 1, 100);
  const annualTarget = integer(payload.annual_target, "Chỉ tiêu năm", 1, 1000000);
  const status = payload.status ?? "draft";
  assert(
    ["draft", "published"].includes(status),
    400,
    "INVALID_INPUT",
    "Trạng thái kế hoạch không hợp lệ.",
  );
  const unit = db.prepare("SELECT id FROM units WHERE id=?").get(unitId);
  assert(unit, 400, "INVALID_INPUT", "Đơn vị lập kế hoạch không tồn tại.");
  const scope = unitScope(user);
  const unitAllowed = db
    .prepare(`SELECT 1 FROM units u WHERE ${scope.sql} AND u.id=?`)
    .get(...scope.params, unitId);
  assert(unitAllowed, 403, "FORBIDDEN", "Đơn vị kế hoạch nằm ngoài phạm vi được cấp.");
  const id = randomUUID();
  const code = payload.code
    ? trimmed(payload.code, "Mã kế hoạch", 1, 100)
    : `KHKT-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;
  assert(
    !db.prepare("SELECT 1 FROM inspection_plans WHERE code=? COLLATE NOCASE").get(code),
    409,
    "DUPLICATE",
    "Mã kế hoạch đã tồn tại.",
  );
  const now = Date.now();
  return transaction(db, () => {
    db.prepare(
      `INSERT INTO inspection_plans(
        id,code,year,title,facility_group,legal_basis,unit_id,annual_target,status,
        created_by,updated_by,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      code,
      year,
      title,
      optionalText(payload.facility_group, "Nhóm cơ sở", 200),
      optionalText(payload.legal_basis, "Căn cứ", 2000),
      unitId,
      annualTarget,
      status,
      user.id,
      user.id,
      now,
      now,
    );
    db.prepare(
      `INSERT INTO inspection_targets(
        id,plan_id,period_type,year,target_count,created_by,updated_by,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?)`,
    ).run(randomUUID(), id, "year", year, annualTarget, user.id, user.id, now, now);
    const created = db.prepare("SELECT * FROM inspection_plans WHERE id=?").get(id);
    writeAudit(db, {
      actorId: user.id,
      feature: "M06.planning",
      objectType: "inspection_plan",
      objectId: id,
      action: "inspection_plan.created",
      after: created,
      ip,
    });
    return created;
  });
}

export function updatePlan(db, user, id, payload, ip) {
  requirePlanning(user, "edit");
  requireRole(user, PLAN_ROLES, "Vai trò hiện tại không được cập nhật kế hoạch kiểm tra.");
  object(payload, [
    "title",
    "facility_group",
    "legal_basis",
    "annual_target",
    "status",
    "version",
    "change_reason",
  ]);
  const before = scopedPlan(db, user, id);
  assert(before.status !== "closed", 409, "INVALID_STATE", "Kế hoạch đã đóng không thể chỉnh sửa.");
  assert(
    Number.isInteger(payload.version) && payload.version === before.version,
    409,
    "VERSION_CONFLICT",
    "Kế hoạch đã thay đổi. Hãy tải lại trước khi lưu.",
  );
  const status = payload.status ?? before.status;
  assert(PLAN_STATUSES.includes(status), 400, "INVALID_INPUT", "Trạng thái kế hoạch không hợp lệ.");
  const allowed = before.status === "draft" ? ["draft", "published"] : ["published", "closed"];
  assert(
    allowed.includes(status),
    409,
    "INVALID_STATE",
    "Không thể chuyển trạng thái kế hoạch theo yêu cầu.",
  );
  const annualTarget =
    payload.annual_target == null
      ? before.annual_target
      : integer(payload.annual_target, "Chỉ tiêu năm", 1, 1000000);
  const allocated = db
    .prepare(
      "SELECT coalesce(sum(target_count),0) AS n FROM inspection_targets WHERE plan_id=? AND period_type='month' AND officer_id IS NULL AND region_id IS NULL",
    )
    .get(id).n;
  assert(
    annualTarget >= allocated,
    409,
    "TARGET_EXCEEDED",
    "Chỉ tiêu năm không được nhỏ hơn tổng đã phân bổ theo tháng.",
  );
  const changedPublishedPlan =
    before.status === "published" &&
    (payload.title != null ||
      payload.facility_group != null ||
      payload.legal_basis != null ||
      payload.annual_target != null);
  const changeReason = optionalText(payload.change_reason, "Lý do điều chỉnh", 2000);
  assert(
    !changedPublishedPlan || changeReason.length > 0,
    400,
    "INVALID_INPUT",
    "Phải nhập lý do khi điều chỉnh kế hoạch đã công bố.",
  );
  const next = {
    title: payload.title == null ? before.title : trimmed(payload.title, "Tên kế hoạch", 1, 300),
    facility_group:
      payload.facility_group == null
        ? before.facility_group
        : optionalText(payload.facility_group, "Nhóm cơ sở", 200),
    legal_basis:
      payload.legal_basis == null
        ? before.legal_basis
        : optionalText(payload.legal_basis, "Căn cứ", 2000),
  };
  const now = Date.now();
  return transaction(db, () => {
    db.prepare(
      `UPDATE inspection_plans SET title=?,facility_group=?,legal_basis=?,annual_target=?,status=?,
        version=version+1,updated_by=?,updated_at=? WHERE id=? AND version=?`,
    ).run(
      next.title,
      next.facility_group,
      next.legal_basis,
      annualTarget,
      status,
      user.id,
      now,
      id,
      before.version,
    );
    db.prepare(
      "UPDATE inspection_targets SET target_count=?,updated_by=?,updated_at=? WHERE plan_id=? AND period_type='year'",
    ).run(annualTarget, user.id, now, id);
    const after = db.prepare("SELECT * FROM inspection_plans WHERE id=?").get(id);
    writeAudit(db, {
      actorId: user.id,
      feature: "M06.planning",
      objectType: "inspection_plan",
      objectId: id,
      action: "inspection_plan.updated",
      before,
      after: { ...after, change_reason: changeReason },
      ip,
    });
    return after;
  });
}

// ---------------------------------------------------------------------------
// Ancillary: options dropdown data and facility listing for a plan
// ---------------------------------------------------------------------------

export function planningOptions(db, user, url) {
  requirePlanning(user);
  const planId = url.searchParams.get("planId");
  const plan = planId ? scopedPlan(db, user, planId) : null;
  const unitId = plan?.unit_id;
  const scope = unitScope(user);
  return {
    units: db
      .prepare(`SELECT id,name FROM units u WHERE ${scope.sql} ORDER BY name`)
      .all(...scope.params),
    regions: unitId
      ? db
          .prepare(
            `SELECT id,name,unit_id FROM regions WHERE unit_id IN (
              WITH RECURSIVE d(id) AS (
                SELECT id FROM units WHERE id=? UNION SELECT u.id FROM units u JOIN d ON u.parent_id=d.id
              ) SELECT id FROM d
            ) ORDER BY name`,
          )
          .all(unitId)
      : [],
    officers: unitId
      ? db
          .prepare(
            `SELECT id,officer_code,full_name,position FROM officers WHERE unit_id IN (
              WITH RECURSIVE d(id) AS (
                SELECT id FROM units WHERE id=? UNION SELECT u.id FROM units u JOIN d ON u.parent_id=d.id
              ) SELECT id FROM d
            ) AND status='ACTIVE' ORDER BY full_name`,
          )
          .all(unitId)
      : [],
    checklists: db
      .prepare(
        "SELECT id,name,facility_type FROM inspection_checklists WHERE is_active=1 ORDER BY name",
      )
      .all(),
  };
}

export function listPlanFacilities(db, user, planId, url) {
  const plan = scopedPlan(db, user, planId);
  const { page, pageSize } = pagination(url);
  const scope = facilityScope(user);
  const q = foldSearchText(optionalText(url.searchParams.get("q"), "Từ khóa", 200));
  const where = `${scope.sql} AND f.status='active' AND r.unit_id IN (
    WITH RECURSIVE d(id) AS (SELECT id FROM units WHERE id=? UNION SELECT u.id FROM units u JOIN d ON u.parent_id=d.id)
    SELECT id FROM d) AND (instr(fold(f.name),?)>0 OR instr(fold(f.address),?)>0)`;
  const params = [...scope.params, plan.unit_id, q, q];
  const base = `FROM facilities f JOIN regions r ON r.id=f.region_id LEFT JOIN officer_directory o ON o.officer_id=f.officer_id WHERE ${where}`;
  return {
    items: db
      .prepare(
        `SELECT f.id,f.name,f.address,f.region_id,r.name AS region_name,f.officer_id,o.full_name AS officer_name,
      (SELECT count(*) FROM inspections i WHERE i.plan_id=? AND i.facility_id=f.id) AS planned_count
      ${base} ORDER BY f.name LIMIT ? OFFSET ?`,
      )
      .all(planId, ...params, pageSize, (page - 1) * pageSize),
    total: db.prepare(`SELECT count(*) AS n ${base}`).get(...params).n,
    page,
    pageSize,
  };
}
