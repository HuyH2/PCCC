import { randomUUID } from "node:crypto";
import { assert } from "../../core/errors.js";
import { foldSearchText, transaction } from "../../core/database.js";
import { object, pagination, text } from "../../core/validation.js";
import {
  facilityScope,
  requirePermission,
  unitScope,
} from "../authorization/authorization.service.js";
import { writeAudit } from "../audit/audit.service.js";

const PLAN_ROLES = ["A01", "A02", "A04"];
const ALLOCATION_ROLES = ["A01", "A02"];
const CASE_ROLES = ["A03", "A04"];
const RESCHEDULE_ROLES = ["A01", "A03"];
const PLAN_STATUSES = ["draft", "published", "closed"];
const FILE_TYPES = {
  "application/pdf": (data) => data.subarray(0, 5).toString() === "%PDF-",
  "image/jpeg": (data) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
  "image/png": (data) =>
    data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
};
const MAX_FILE_BYTES = Number(process.env.INSPECTION_DOCUMENT_MAX_BYTES ?? 5 * 1024 * 1024);
if (
  !Number.isInteger(MAX_FILE_BYTES) ||
  MAX_FILE_BYTES < 1024 ||
  MAX_FILE_BYTES > 10 * 1024 * 1024
) {
  throw new Error("INSPECTION_DOCUMENT_MAX_BYTES must be an integer between 1024 and 10485760.");
}

function trimmed(value, label, min, max) {
  return text(typeof value === "string" ? value.trim() : value, label, min, max);
}

function optionalText(value, label, max) {
  return value == null ? "" : trimmed(value, label, 0, max);
}

function integer(value, label, min, max) {
  assert(
    Number.isInteger(value) && value >= min && value <= max,
    400,
    "INVALID_INPUT",
    `${label} không hợp lệ.`,
  );
  return value;
}

function date(value, label) {
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

function optionalTime(value, label) {
  if (value == null || value === "") return null;
  assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(value), 400, "INVALID_INPUT", `${label} không hợp lệ.`);
  return value;
}

function requireRole(user, roles, message) {
  assert(roles.includes(user.role), 403, "FORBIDDEN", message);
}

function requirePlanning(user, action = "view") {
  requirePermission(user, "M06.view");
  if (action !== "view") requirePermission(user, `M06.${action}`);
}

function planScope(user) {
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

function scopedPlan(db, user, id) {
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

function scopedFacility(db, user, facilityId) {
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

function scopedPeriodicInspection(db, user, id) {
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

function ensureOfficer(db, officerId, unitId) {
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

function unitWithin(db, childUnitId, parentUnitId) {
  return Boolean(
    db
      .prepare(
        `WITH RECURSIVE d(id) AS (
          SELECT id FROM units WHERE id=?
          UNION SELECT u.id FROM units u JOIN d ON u.parent_id=d.id
        ) SELECT 1 FROM d WHERE id=?`,
      )
      .get(parentUnitId, childUnitId),
  );
}

function parseFile(value, label = "Tệp đính kèm") {
  if (value == null) return null;
  object(value, ["name", "content_type", "content_base64"]);
  const name = trimmed(value.name, "Tên file", 1, 255);
  const contentType = value.content_type;
  assert(FILE_TYPES[contentType], 400, "INVALID_INPUT", `${label} chỉ nhận PDF, JPEG hoặc PNG.`);
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
    FILE_TYPES[contentType](data),
    400,
    "INVALID_INPUT",
    "Nội dung file không khớp định dạng khai báo.",
  );
  return { name, contentType, data };
}

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
  const plan = transaction(db, () => {
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
  return plan;
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

export function createTarget(db, user, planId, payload, ip) {
  requirePlanning(user, "edit");
  requireRole(user, ALLOCATION_ROLES, "Chỉ Chỉ huy hoặc Phó chỉ huy được phân bổ chỉ tiêu.");
  object(payload, [
    "period_type",
    "month",
    "week",
    "officer_id",
    "region_id",
    "target_count",
    "parent_id",
  ]);
  const plan = scopedPlan(db, user, planId);
  assert(
    plan.status !== "closed",
    409,
    "INVALID_STATE",
    "Kế hoạch đã đóng không thể phân bổ thêm.",
  );
  const periodType = payload.period_type;
  assert(
    ["month", "week"].includes(periodType),
    400,
    "INVALID_INPUT",
    "Kỳ phân bổ phải là tháng hoặc tuần.",
  );
  const month = integer(payload.month, "Tháng", 1, 12);
  const week = periodType === "week" ? integer(payload.week, "Tuần", 1, 53) : null;
  const targetCount = integer(payload.target_count, "Chỉ tiêu", 1, 1000000);
  const officerId = payload.officer_id ? trimmed(payload.officer_id, "Cán bộ", 1, 100) : null;
  const regionId = payload.region_id ? trimmed(payload.region_id, "Địa bàn", 1, 100) : null;
  if (officerId) {
    const officer = db
      .prepare("SELECT * FROM officers WHERE id=? AND status='ACTIVE'")
      .get(officerId);
    assert(
      officer && unitWithin(db, officer.unit_id, plan.unit_id),
      400,
      "INVALID_INPUT",
      "Cán bộ không thuộc đơn vị của kế hoạch.",
    );
  }
  if (regionId) {
    const region = db.prepare("SELECT unit_id FROM regions WHERE id=?").get(regionId);
    assert(
      region && unitWithin(db, region.unit_id, plan.unit_id),
      400,
      "INVALID_INPUT",
      "Địa bàn không thuộc đơn vị của kế hoạch.",
    );
  }
  let parentId = payload.parent_id ?? null;
  if (parentId) {
    const parent = db
      .prepare("SELECT * FROM inspection_targets WHERE id=? AND plan_id=?")
      .get(parentId, planId);
    assert(parent, 400, "INVALID_INPUT", "Chỉ tiêu cha không hợp lệ.");
  }
  const aggregate = officerId == null && regionId == null;
  if (aggregate && periodType === "month") {
    const yearTarget = db
      .prepare("SELECT id FROM inspection_targets WHERE plan_id=? AND period_type='year'")
      .get(planId);
    assert(yearTarget, 409, "INVALID_STATE", "Kế hoạch chưa có chỉ tiêu năm.");
    assert(
      !parentId || parentId === yearTarget.id,
      400,
      "INVALID_INPUT",
      "Chỉ tiêu tháng phải thuộc chỉ tiêu năm.",
    );
    parentId = yearTarget.id;
    const existing = db
      .prepare(
        "SELECT coalesce(sum(target_count),0) AS n FROM inspection_targets WHERE plan_id=? AND period_type='month' AND officer_id IS NULL AND region_id IS NULL",
      )
      .get(planId).n;
    assert(
      existing + targetCount <= plan.annual_target,
      409,
      "TARGET_EXCEEDED",
      "Tổng chỉ tiêu tháng vượt chỉ tiêu năm.",
    );
  }
  if (aggregate && periodType === "week") {
    const monthTarget = db
      .prepare(
        "SELECT id,target_count FROM inspection_targets WHERE plan_id=? AND period_type='month' AND month=? AND officer_id IS NULL AND region_id IS NULL",
      )
      .get(planId, month);
    assert(
      monthTarget,
      409,
      "MISSING_PARENT_TARGET",
      "Cần phân bổ chỉ tiêu tháng trước khi phân bổ tuần.",
    );
    const existing = db
      .prepare(
        "SELECT coalesce(sum(target_count),0) AS n FROM inspection_targets WHERE plan_id=? AND period_type='week' AND month=? AND officer_id IS NULL AND region_id IS NULL",
      )
      .get(planId, month).n;
    assert(
      existing + targetCount <= monthTarget.target_count,
      409,
      "TARGET_EXCEEDED",
      "Tổng chỉ tiêu tuần vượt chỉ tiêu tháng.",
    );
    assert(
      !parentId || parentId === monthTarget.id,
      400,
      "INVALID_INPUT",
      "Chỉ tiêu tuần phải thuộc chỉ tiêu tháng tương ứng.",
    );
    parentId = monthTarget.id;
  }
  if (!aggregate) {
    assert(parentId, 400, "INVALID_INPUT", "Chỉ tiêu cán bộ/địa bàn phải thuộc một chỉ tiêu kỳ.");
    const parent = db
      .prepare("SELECT * FROM inspection_targets WHERE id=? AND plan_id=?")
      .get(parentId, planId);
    assert(
      parent && parent.period_type === periodType && parent.month === month && parent.week === week,
      400,
      "INVALID_INPUT",
      "Chỉ tiêu cha không cùng kỳ phân bổ.",
    );
    const existing = db
      .prepare(
        "SELECT coalesce(sum(target_count),0) AS n FROM inspection_targets WHERE parent_id=?",
      )
      .get(parentId).n;
    assert(
      existing + targetCount <= parent.target_count,
      409,
      "TARGET_EXCEEDED",
      "Tổng giao cho cán bộ/địa bàn vượt chỉ tiêu kỳ.",
    );
  }
  const duplicate = db
    .prepare(
      `SELECT 1 FROM inspection_targets WHERE plan_id=? AND period_type=? AND year=?
    AND coalesce(month,0)=? AND coalesce(week,0)=? AND coalesce(officer_id,'')=? AND coalesce(region_id,'')=?`,
    )
    .get(planId, periodType, plan.year, month, week ?? 0, officerId ?? "", regionId ?? "");
  assert(!duplicate, 409, "DUPLICATE", "Chỉ tiêu cho kỳ và đối tượng này đã tồn tại.");
  const id = randomUUID();
  const now = Date.now();
  return transaction(db, () => {
    db.prepare(
      `INSERT INTO inspection_targets(
      id,plan_id,parent_id,period_type,year,month,week,officer_id,region_id,target_count,
      created_by,updated_by,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      planId,
      parentId,
      periodType,
      plan.year,
      month,
      week,
      officerId,
      regionId,
      targetCount,
      user.id,
      user.id,
      now,
      now,
    );
    const target = db.prepare("SELECT * FROM inspection_targets WHERE id=?").get(id);
    writeAudit(db, {
      actorId: user.id,
      feature: "M06.planning",
      objectType: "inspection_target",
      objectId: id,
      action: "inspection_target.created",
      after: target,
      ip,
    });
    return target;
  });
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

export function createPeriodicInspection(db, user, planId, payload, ip) {
  requirePlanning(user, "create");
  requireRole(
    user,
    CASE_ROLES,
    "Chỉ Cán bộ kiểm tra hoặc Cán bộ tổng hợp được tạo hồ sơ kiểm tra định kỳ.",
  );
  object(payload, [
    "facility_id",
    "target_id",
    "lead_officer_id",
    "scheduled_date",
    "start_time",
    "end_time",
    "location",
    "checklist_id",
    "reason",
    "team_decision",
  ]);
  const plan = scopedPlan(db, user, planId);
  assert(
    plan.status === "published",
    409,
    "INVALID_STATE",
    "Kế hoạch phải được công bố trước khi tạo cuộc kiểm tra.",
  );
  const facility = scopedFacility(db, user, trimmed(payload.facility_id, "Cơ sở", 1, 100));
  assert(
    unitWithin(db, facility.unit_id, plan.unit_id),
    400,
    "INVALID_INPUT",
    "Cơ sở không thuộc đơn vị của kế hoạch.",
  );
  const officer = ensureOfficer(
    db,
    trimmed(payload.lead_officer_id, "Cán bộ phụ trách", 1, 100),
    facility.unit_id,
  );
  const scheduledDate = date(payload.scheduled_date, "Ngày kiểm tra");
  assert(
    Number(scheduledDate.slice(0, 4)) === plan.year,
    400,
    "INVALID_INPUT",
    "Ngày kiểm tra phải thuộc năm của kế hoạch.",
  );
  const startTime = optionalTime(payload.start_time, "Giờ bắt đầu");
  const endTime = optionalTime(payload.end_time, "Giờ kết thúc");
  assert(
    !startTime || !endTime || startTime < endTime,
    400,
    "INVALID_INPUT",
    "Giờ kết thúc phải sau giờ bắt đầu.",
  );
  let targetId = payload.target_id ?? null;
  if (targetId) {
    const target = db
      .prepare("SELECT * FROM inspection_targets WHERE id=? AND plan_id=?")
      .get(targetId, planId);
    assert(target, 400, "INVALID_INPUT", "Chỉ tiêu được chọn không thuộc kế hoạch.");
    assert(
      !target.officer_id || target.officer_id === officer.id,
      400,
      "INVALID_INPUT",
      "Cán bộ không khớp chỉ tiêu được giao.",
    );
    assert(
      !target.region_id || target.region_id === facility.region_id,
      400,
      "INVALID_INPUT",
      "Cơ sở không thuộc địa bàn của chỉ tiêu được chọn.",
    );
    assert(
      target.month == null || target.month === Number(scheduledDate.slice(5, 7)),
      400,
      "INVALID_INPUT",
      "Ngày kiểm tra không thuộc tháng của chỉ tiêu được chọn.",
    );
  }
  const checklistId = payload.checklist_id || null;
  if (checklistId)
    assert(
      db.prepare("SELECT 1 FROM inspection_checklists WHERE id=? AND is_active=1").get(checklistId),
      400,
      "INVALID_INPUT",
      "Checklist không hợp lệ.",
    );
  const decision = parseFile(payload.team_decision, "Quyết định đoàn kiểm tra");
  const id = randomUUID();
  const scheduleId = randomUUID();
  const code = `KT-${plan.year}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const now = Date.now();
  return transaction(db, () => {
    db.prepare(
      `INSERT INTO inspections(
      id,code,facility_id,kind,reason,scheduled_date,lead_officer_id,status,checklist_id,
      created_by,updated_by,created_at,updated_at,plan_id,target_id
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      code,
      facility.id,
      "periodic",
      optionalText(payload.reason, "Ghi chú", 2000),
      scheduledDate,
      officer.id,
      "planned",
      checklistId,
      user.id,
      user.id,
      now,
      now,
      planId,
      targetId,
    );
    db.prepare(
      `INSERT INTO inspection_schedules(
      id,inspection_id,scheduled_date,start_time,end_time,location,created_by,updated_by,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      scheduleId,
      id,
      scheduledDate,
      startTime,
      endTime,
      optionalText(payload.location, "Địa điểm", 500) || facility.address,
      user.id,
      user.id,
      now,
      now,
    );
    if (decision)
      db.prepare(
        `INSERT INTO inspection_planning_documents(
      id,inspection_id,kind,file_name,content_type,file_size,file_data,uploaded_by,uploaded_at
    ) VALUES (?,?,?,?,?,?,?,?,?)`,
      ).run(
        randomUUID(),
        id,
        "team_decision",
        decision.name,
        decision.contentType,
        decision.data.length,
        decision.data,
        user.id,
        now,
      );
    const created = scopedPeriodicInspection(db, user, id);
    writeAudit(db, {
      actorId: user.id,
      feature: "M06.planning",
      objectType: "inspection",
      objectId: id,
      action: "periodic_inspection.created",
      after: created,
      ip,
    });
    return created;
  });
}

export function planningInspectionDetail(db, user, id) {
  const inspection = scopedPeriodicInspection(db, user, id);
  const notice =
    db
      .prepare(
        `SELECT id,inspection_id,notice_number,recipient_name,recipient_contact,
    notice_text,sent_date,inspection_date,status,file_name,content_type,file_size,version,created_at,updated_at
    FROM inspection_notices WHERE inspection_id=?`,
      )
      .get(id) ?? null;
  const history = db
    .prepare(
      `SELECT r.*,a.full_name AS changed_by_name FROM inspection_reschedules r
    JOIN accounts a ON a.id=r.changed_by WHERE r.inspection_id=? ORDER BY r.changed_at DESC`,
    )
    .all(id);
  const documents = db
    .prepare(
      `SELECT id,kind,description,file_name,content_type,file_size,uploaded_at
    FROM inspection_planning_documents WHERE inspection_id=? ORDER BY uploaded_at`,
    )
    .all(id);
  return { inspection, notice, reschedules: history, documents };
}

export function assignLeadOfficer(db, user, id, payload, ip) {
  requirePlanning(user, "edit");
  requireRole(user, CASE_ROLES, "Vai trò hiện tại không được gán cán bộ cho cuộc kiểm tra.");
  object(payload, ["lead_officer_id", "version"]);
  const before = scopedPeriodicInspection(db, user, id);
  assert(
    before.status === "planned",
    409,
    "INVALID_STATE",
    "Chỉ hồ sơ đang chuẩn bị mới được đổi cán bộ.",
  );
  assert(
    payload.version === before.version,
    409,
    "VERSION_CONFLICT",
    "Cuộc kiểm tra đã thay đổi. Hãy tải lại.",
  );
  const officer = ensureOfficer(
    db,
    trimmed(payload.lead_officer_id, "Cán bộ phụ trách", 1, 100),
    before.unit_id,
  );
  const now = Date.now();
  return transaction(db, () => {
    db.prepare(
      "UPDATE inspections SET lead_officer_id=?,version=version+1,updated_by=?,updated_at=? WHERE id=? AND version=?",
    ).run(officer.id, user.id, now, id, before.version);
    const after = scopedPeriodicInspection(db, user, id);
    writeAudit(db, {
      actorId: user.id,
      feature: "M06.planning",
      objectType: "inspection",
      objectId: id,
      action: "inspection.lead_officer_assigned",
      before,
      after,
      ip,
    });
    return after;
  });
}

export function updateSchedule(db, user, id, payload, ip) {
  requirePlanning(user, "edit");
  requireRole(user, CASE_ROLES, "Vai trò hiện tại không được cập nhật lịch kiểm tra.");
  object(payload, ["scheduled_date", "start_time", "end_time", "location", "version"]);
  const inspection = scopedPeriodicInspection(db, user, id);
  assert(
    inspection.status === "planned",
    409,
    "INVALID_STATE",
    "Chỉ hồ sơ đang chuẩn bị mới được cập nhật lịch.",
  );
  assert(
    payload.version === inspection.schedule_version,
    409,
    "VERSION_CONFLICT",
    "Lịch kiểm tra đã thay đổi. Hãy tải lại.",
  );
  const scheduledDate = date(payload.scheduled_date, "Ngày kiểm tra");
  assert(
    scheduledDate === inspection.scheduled_date,
    400,
    "RESCHEDULE_REASON_REQUIRED",
    "Muốn đổi ngày kiểm tra, hãy dùng chức năng dời lịch và nhập lý do.",
  );
  const startTime = optionalTime(payload.start_time, "Giờ bắt đầu");
  const endTime = optionalTime(payload.end_time, "Giờ kết thúc");
  assert(
    !startTime || !endTime || startTime < endTime,
    400,
    "INVALID_INPUT",
    "Giờ kết thúc phải sau giờ bắt đầu.",
  );
  const before = {
    scheduled_date: inspection.scheduled_date,
    start_time: inspection.start_time,
    end_time: inspection.end_time,
    location: inspection.location,
  };
  const now = Date.now();
  return transaction(db, () => {
    db.prepare(
      `UPDATE inspection_schedules SET scheduled_date=?,start_time=?,end_time=?,location=?,
      version=version+1,updated_by=?,updated_at=? WHERE inspection_id=? AND version=?`,
    ).run(
      scheduledDate,
      startTime,
      endTime,
      optionalText(payload.location, "Địa điểm", 500),
      user.id,
      now,
      id,
      inspection.schedule_version,
    );
    db.prepare(
      "UPDATE inspections SET scheduled_date=?,version=version+1,updated_by=?,updated_at=? WHERE id=?",
    ).run(scheduledDate, user.id, now, id);
    const after = scopedPeriodicInspection(db, user, id);
    writeAudit(db, {
      actorId: user.id,
      feature: "M06.planning",
      objectType: "inspection_schedule",
      objectId: inspection.schedule_id,
      action: "inspection_schedule.updated",
      before,
      after: {
        scheduled_date: after.scheduled_date,
        start_time: after.start_time,
        end_time: after.end_time,
        location: after.location,
      },
      ip,
    });
    return after;
  });
}

export function listSchedules(db, user, url) {
  requirePlanning(user);
  const { page, pageSize } = pagination(url);
  const scope = facilityScope(user);
  const clauses = [scope.sql];
  const params = [...scope.params];
  for (const [key, operator] of [
    ["from", ">="],
    ["to", "<="],
  ]) {
    const value = url.searchParams.get(key);
    if (value) {
      clauses.push(`s.scheduled_date${operator}?`);
      params.push(date(value, key === "from" ? "Từ ngày" : "Đến ngày"));
    }
  }
  const kind = url.searchParams.get("kind");
  if (kind) {
    assert(
      ["periodic", "unscheduled", "thematic"].includes(kind),
      400,
      "INVALID_INPUT",
      "Loại kiểm tra không hợp lệ.",
    );
    clauses.push("i.kind=?");
    params.push(kind);
  }
  const where = clauses.join(" AND ");
  const base = `FROM inspection_schedules s JOIN inspections i ON i.id=s.inspection_id
    JOIN facilities f ON f.id=i.facility_id JOIN regions r ON r.id=f.region_id
    LEFT JOIN officer_directory o ON o.officer_id=i.lead_officer_id
    LEFT JOIN inspection_notices n ON n.inspection_id=i.id WHERE ${where}`;
  return {
    items: db
      .prepare(
        `SELECT s.*,i.code AS inspection_code,i.status AS inspection_status,i.plan_id,
      f.id AS facility_id,f.name AS facility_name,r.name AS region_name,o.full_name AS lead_officer_name,
      CASE WHEN n.status='sent' THEN 'sent' WHEN n.id IS NOT NULL THEN 'draft' ELSE 'none' END AS notice_status
      ${base}
      ORDER BY s.scheduled_date,s.start_time LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize),
    total: db.prepare(`SELECT count(*) AS n ${base}`).get(...params).n,
    page,
    pageSize,
  };
}

export function listReschedules(db, user, id) {
  scopedPeriodicInspection(db, user, id);
  return {
    items: db
      .prepare(
        `SELECT r.id,r.inspection_id,r.schedule_id,r.old_date,r.new_date,r.old_start_time,
          r.new_start_time,r.old_end_time,r.new_end_time,r.reason,r.attachment_name,
          r.attachment_type,r.attachment_size,r.changed_by,r.changed_at,a.full_name AS changed_by_name
        FROM inspection_reschedules r JOIN accounts a ON a.id=r.changed_by
        WHERE r.inspection_id=? ORDER BY r.changed_at DESC`,
      )
      .all(id),
  };
}

export function planningFile(db, user, inspectionId, kind, objectId = null) {
  scopedPeriodicInspection(db, user, inspectionId);
  let row;
  if (kind === "notice") {
    row = db
      .prepare(
        `SELECT file_name,content_type,file_size,file_data FROM inspection_notices
        WHERE inspection_id=? AND file_data IS NOT NULL`,
      )
      .get(inspectionId);
  } else if (kind === "document") {
    row = db
      .prepare(
        `SELECT file_name,content_type,file_size,file_data FROM inspection_planning_documents
        WHERE id=? AND inspection_id=?`,
      )
      .get(objectId, inspectionId);
  } else if (kind === "reschedule") {
    row = db
      .prepare(
        `SELECT attachment_name AS file_name,attachment_type AS content_type,
          attachment_size AS file_size,attachment_data AS file_data
        FROM inspection_reschedules WHERE id=? AND inspection_id=? AND attachment_data IS NOT NULL`,
      )
      .get(objectId, inspectionId);
  }
  assert(row, 404, "NOT_FOUND", "Không tìm thấy tệp trong phạm vi được cấp.");
  return row;
}

export function upsertNotice(db, user, id, payload, ip) {
  requirePlanning(user, "edit");
  requireRole(user, CASE_ROLES, "Chỉ Cán bộ kiểm tra hoặc Cán bộ tổng hợp được lập thông báo.");
  object(payload, [
    "notice_number",
    "recipient_name",
    "recipient_contact",
    "notice_text",
    "sent_date",
    "inspection_date",
    "status",
    "version",
    "file",
  ]);
  const inspection = scopedPeriodicInspection(db, user, id);
  assert(
    inspection.status === "planned",
    409,
    "INVALID_STATE",
    "Chỉ hồ sơ đang chuẩn bị mới được lập thông báo.",
  );
  const before =
    db.prepare("SELECT * FROM inspection_notices WHERE inspection_id=?").get(id) ?? null;
  assert(
    !before || payload.version === before.version,
    409,
    "VERSION_CONFLICT",
    "Thông báo đã thay đổi. Hãy tải lại.",
  );
  const status = payload.status ?? "draft";
  assert(
    ["draft", "sent"].includes(status),
    400,
    "INVALID_INPUT",
    "Trạng thái thông báo không hợp lệ.",
  );
  const sentDate = payload.sent_date ? date(payload.sent_date, "Ngày gửi") : null;
  assert(status !== "sent" || sentDate, 400, "INVALID_INPUT", "Thông báo đã gửi phải có ngày gửi.");
  const inspectionDate = date(
    payload.inspection_date ?? inspection.scheduled_date,
    "Ngày kiểm tra",
  );
  assert(
    inspectionDate === inspection.scheduled_date,
    409,
    "SCHEDULE_MISMATCH",
    "Ngày trên thông báo phải trùng lịch kiểm tra hiện tại.",
  );
  const file = parseFile(payload.file);
  const idValue = before?.id ?? randomUUID();
  const now = Date.now();
  return transaction(db, () => {
    if (before)
      db.prepare(
        `UPDATE inspection_notices SET notice_number=?,recipient_name=?,recipient_contact=?,
      notice_text=?,sent_date=?,inspection_date=?,status=?,file_name=coalesce(?,file_name),
      content_type=coalesce(?,content_type),file_size=coalesce(?,file_size),file_data=coalesce(?,file_data),
      version=version+1,updated_by=?,updated_at=? WHERE id=? AND version=?`,
      ).run(
        optionalText(payload.notice_number, "Số thông báo", 100),
        trimmed(payload.recipient_name, "Người nhận", 1, 200),
        optionalText(payload.recipient_contact, "Thông tin liên hệ", 300),
        optionalText(payload.notice_text, "Nội dung", 5000),
        sentDate,
        inspectionDate,
        status,
        file?.name ?? null,
        file?.contentType ?? null,
        file?.data.length ?? null,
        file?.data ?? null,
        user.id,
        now,
        before.id,
        before.version,
      );
    else
      db.prepare(
        `INSERT INTO inspection_notices(
      id,inspection_id,notice_number,recipient_name,recipient_contact,notice_text,sent_date,
      inspection_date,status,file_name,content_type,file_size,file_data,created_by,updated_by,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        idValue,
        id,
        optionalText(payload.notice_number, "Số thông báo", 100),
        trimmed(payload.recipient_name, "Người nhận", 1, 200),
        optionalText(payload.recipient_contact, "Thông tin liên hệ", 300),
        optionalText(payload.notice_text, "Nội dung", 5000),
        sentDate,
        inspectionDate,
        status,
        file?.name ?? null,
        file?.contentType ?? null,
        file?.data.length ?? null,
        file?.data ?? null,
        user.id,
        user.id,
        now,
        now,
      );
    const after = db
      .prepare(
        `SELECT id,inspection_id,notice_number,recipient_name,recipient_contact,notice_text,
      sent_date,inspection_date,status,file_name,content_type,file_size,version,created_at,updated_at
      FROM inspection_notices WHERE id=?`,
      )
      .get(idValue);
    writeAudit(db, {
      actorId: user.id,
      feature: "M06.planning",
      objectType: "inspection_notice",
      objectId: idValue,
      action: before ? "inspection_notice.updated" : "inspection_notice.created",
      before,
      after,
      ip,
    });
    return after;
  });
}

export function rescheduleInspection(db, user, id, payload, ip) {
  requirePlanning(user, "edit");
  requireRole(user, RESCHEDULE_ROLES, "Chỉ Chỉ huy hoặc Cán bộ kiểm tra được dời lịch.");
  object(payload, ["new_date", "start_time", "end_time", "reason", "version", "attachment"]);
  const before = scopedPeriodicInspection(db, user, id);
  assert(
    before.status === "planned",
    409,
    "INVALID_STATE",
    "Chỉ cuộc kiểm tra chưa thực hiện mới được dời lịch.",
  );
  assert(
    payload.version === before.schedule_version,
    409,
    "VERSION_CONFLICT",
    "Lịch kiểm tra đã thay đổi. Hãy tải lại.",
  );
  const newDate = date(payload.new_date, "Ngày mới");
  assert(
    newDate !== before.scheduled_date,
    400,
    "INVALID_INPUT",
    "Ngày mới phải khác ngày hiện tại.",
  );
  const reason = trimmed(payload.reason, "Lý do dời lịch", 1, 2000);
  const startTime = optionalTime(payload.start_time ?? before.start_time, "Giờ bắt đầu");
  const endTime = optionalTime(payload.end_time ?? before.end_time, "Giờ kết thúc");
  assert(
    !startTime || !endTime || startTime < endTime,
    400,
    "INVALID_INPUT",
    "Giờ kết thúc phải sau giờ bắt đầu.",
  );
  const attachment = parseFile(payload.attachment);
  const plan = db.prepare("SELECT year FROM inspection_plans WHERE id=?").get(before.plan_id);
  const outsidePlanYear = plan ? Number(newDate.slice(0, 4)) !== plan.year : false;
  const rescheduleId = randomUUID();
  const now = Date.now();
  return transaction(db, () => {
    db.prepare(
      `INSERT INTO inspection_reschedules(
      id,inspection_id,schedule_id,old_date,new_date,old_start_time,new_start_time,old_end_time,new_end_time,
      reason,attachment_name,attachment_type,attachment_size,attachment_data,changed_by,changed_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      rescheduleId,
      id,
      before.schedule_id,
      before.scheduled_date,
      newDate,
      before.start_time,
      startTime,
      before.end_time,
      endTime,
      reason,
      attachment?.name ?? null,
      attachment?.contentType ?? null,
      attachment?.data.length ?? null,
      attachment?.data ?? null,
      user.id,
      now,
    );
    db.prepare(
      `UPDATE inspection_schedules SET scheduled_date=?,start_time=?,end_time=?,status='rescheduled',
      version=version+1,updated_by=?,updated_at=? WHERE id=? AND version=?`,
    ).run(newDate, startTime, endTime, user.id, now, before.schedule_id, before.schedule_version);
    db.prepare(
      "UPDATE inspections SET scheduled_date=?,version=version+1,updated_by=?,updated_at=? WHERE id=?",
    ).run(newDate, user.id, now, id);
    const notice = db.prepare("SELECT * FROM inspection_notices WHERE inspection_id=?").get(id);
    if (notice)
      db.prepare(
        "UPDATE inspection_notices SET inspection_date=?,status='draft',sent_date=NULL,version=version+1,updated_by=?,updated_at=? WHERE inspection_id=?",
      ).run(newDate, user.id, now, id);
    const history = db
      .prepare(
        `SELECT id,inspection_id,schedule_id,old_date,new_date,old_start_time,
      new_start_time,old_end_time,new_end_time,reason,attachment_name,attachment_type,attachment_size,
      changed_by,changed_at FROM inspection_reschedules WHERE id=?`,
      )
      .get(rescheduleId);
    writeAudit(db, {
      actorId: user.id,
      feature: "M06.planning",
      objectType: "inspection_schedule",
      objectId: before.schedule_id,
      action: "inspection_schedule.rescheduled",
      before: {
        date: before.scheduled_date,
        start_time: before.start_time,
        end_time: before.end_time,
      },
      after: {
        date: newDate,
        start_time: startTime,
        end_time: endTime,
        reason,
        outside_plan_year: outsidePlanYear,
      },
      ip,
    });
    return {
      reschedule: history,
      schedule: scopedPeriodicInspection(db, user, id),
      warning: outsidePlanYear ? "Ngày mới nằm ngoài năm kế hoạch." : null,
    };
  });
}
