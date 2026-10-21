import { randomUUID } from "node:crypto";
import { ApiError, assert } from "./errors.js";
import { object, pagination, text } from "./validation.js";
import {
  requirePermission,
  facilityScope,
} from "../modules/authorization/authorization.service.js";
import { audit } from "../modules/audit/audit.service.js";
import { transaction } from "./database.js";

const descendants = `WITH RECURSIVE descendants(id) AS (
  SELECT id FROM units WHERE id=? UNION SELECT u.id FROM units u JOIN descendants d ON u.parent_id=d.id
) SELECT id FROM descendants`;
const ancestors = `WITH RECURSIVE ancestors(id,parent_id) AS (
  SELECT id,parent_id FROM units WHERE id=? UNION SELECT u.id,u.parent_id FROM units u JOIN ancestors a ON u.id=a.parent_id
) SELECT id FROM ancestors`;
const nodeFields = ["code", "name", "level", "parentId", "leaderOfficerId", "status", "notes"];
const officerFields = [
  "officerCode",
  "fullName",
  "rank",
  "position",
  "phone",
  "email",
  "notes",
  "unitId",
  "businessRole",
];

const hasAll = (principal) => principal.scopes.some((s) => s.kind === "all");
const combine = (clauses, params) => ({
  sql: clauses.length ? `(${clauses.join(" OR ")})` : "0=1",
  params,
});

/** Authorization is applied in SQL before lists, counts, lookup and pagination. */
export function unitWriteScope(principal, alias = "u") {
  if (hasAll(principal)) return { sql: "1=1", params: [] };
  const scopes = principal.scopes.filter((s) => s.kind === "unit");
  return combine(
    scopes.map(() => `${alias}.id IN (${descendants})`),
    scopes.map((s) => s.targetId),
  );
}

export function regionScope(principal, alias = "r", write = false) {
  if (hasAll(principal)) return { sql: "1=1", params: [] };
  const clauses = [],
    params = [];
  for (const scope of principal.scopes) {
    if (scope.kind === "unit") clauses.push(`${alias}.unit_id IN (${descendants})`);
    else if (scope.kind === "region") clauses.push(`${alias}.id=?`);
    else if (scope.kind === "facility" && !write)
      clauses.push(`${alias}.id IN (SELECT region_id FROM facilities WHERE id=?)`);
    else continue;
    params.push(scope.targetId);
  }
  return combine(clauses, params);
}

/** Parent context is readable, but never turns a region/facility grant into a unit write grant. */
export function unitReadScope(principal, alias = "u") {
  if (hasAll(principal)) return { sql: "1=1", params: [] };
  const writable = unitWriteScope(principal, alias);
  const clauses = [writable.sql],
    params = [...writable.params];
  for (const scope of principal.scopes) {
    if (scope.kind === "unit") clauses.push(`${alias}.id IN (${ancestors})`);
    else if (scope.kind === "region")
      clauses.push(`${alias}.id IN (
      WITH RECURSIVE ancestors(id,parent_id) AS (
        SELECT u.id,u.parent_id FROM units u JOIN regions r ON r.unit_id=u.id WHERE r.id=?
        UNION SELECT u.id,u.parent_id FROM units u JOIN ancestors a ON u.id=a.parent_id
      ) SELECT id FROM ancestors)`);
    else if (scope.kind === "facility")
      clauses.push(`${alias}.id IN (
      WITH RECURSIVE ancestors(id,parent_id) AS (
        SELECT u.id,u.parent_id FROM units u JOIN regions r ON r.unit_id=u.id JOIN facilities f ON f.region_id=r.id WHERE f.id=?
        UNION SELECT u.id,u.parent_id FROM units u JOIN ancestors a ON u.id=a.parent_id
      ) SELECT id FROM ancestors)`);
    else continue;
    params.push(scope.targetId);
  }
  return combine(clauses, params);
}

export function officerScope(principal, alias = "o") {
  if (hasAll(principal)) return { sql: "1=1", params: [] };
  const writable = unitWriteScope(principal, "ou");
  // Unit grants expose staff belonging to that unit hierarchy. Only explicit
  // territorial/facility grants expose the officer attached to a scoped facility;
  // legacy facility references must not expand an ordinary unit staff directory.
  const facilities = facilityScope({
    ...principal,
    scopes: principal.scopes.filter((s) => s.kind === "region" || s.kind === "facility"),
  });
  const visibleUnits = unitReadScope(principal, "ou");
  return {
    sql: `(EXISTS(SELECT 1 FROM units ou WHERE ou.id=${alias}.unit_id AND ${writable.sql})
      OR EXISTS(SELECT 1 FROM facilities f WHERE f.officer_id=${alias}.id AND ${facilities.sql})
      OR (${alias}.id=? AND EXISTS(SELECT 1 FROM accounts a WHERE a.id=? AND a.officer_id=${alias}.id)
        AND EXISTS(SELECT 1 FROM units ou WHERE ou.id=${alias}.unit_id AND ${visibleUnits.sql})))`,
    params: [
      ...writable.params,
      ...facilities.params,
      principal.officerId,
      principal.id,
      ...visibleUnits.params,
    ],
  };
}

function scopedRow(db, table, alias, scope, id, message) {
  const row = db
    .prepare(`SELECT ${alias}.* FROM ${table} ${alias} WHERE ${scope.sql} AND ${alias}.id=?`)
    .get(...scope.params, id);
  assert(row, 404, "NOT_FOUND", message);
  return row;
}
const findUnit = (db, principal, id, write = false) =>
  scopedRow(
    db,
    "units",
    "u",
    write ? unitWriteScope(principal) : unitReadScope(principal),
    id,
    "Không tìm thấy đơn vị trong phạm vi được cấp.",
  );
const findRegion = (db, principal, id, write = false) =>
  scopedRow(
    db,
    "regions",
    "r",
    regionScope(principal, "r", write),
    id,
    "Không tìm thấy khu phố trong phạm vi được cấp.",
  );
const findOfficer = (db, principal, id) =>
  scopedRow(
    db,
    "officers",
    "o",
    officerScope(principal),
    id,
    "Không tìm thấy cán bộ trong phạm vi được cấp.",
  );

function trimmed(value, label, min, max) {
  return text(typeof value === "string" ? value.trim() : value, label, min, max);
}
function code(value, label) {
  const result = trimmed(value, label, 1, 50);
  assert(
    /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(result),
    400,
    "INVALID_INPUT",
    `${label} chỉ chứa chữ, số và các ký tự . _ / -.`,
  );
  return result;
}
function idValue(value, label, nullable = false) {
  if (nullable && (value === null || value === "")) return null;
  return trimmed(value, label, 1, 128);
}
function status(value, allowed = ["ACTIVE", "INACTIVE"]) {
  assert(allowed.includes(value), 400, "INVALID_INPUT", "Trạng thái không hợp lệ.");
  return value;
}
function date(value) {
  assert(
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value),
    400,
    "INVALID_INPUT",
    "Ngày hiệu lực phải theo định dạng YYYY-MM-DD.",
  );
  const parsed = new Date(`${value}T00:00:00Z`);
  assert(
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value,
    400,
    "INVALID_INPUT",
    "Ngày hiệu lực không tồn tại.",
  );
  return value;
}

function officerSnapshot(db, row) {
  const related = db
    .prepare(
      "SELECT u.name unit_name,r.name role_name FROM units u JOIN roles r ON r.code=? WHERE u.id=?",
    )
    .get(row.business_role, row.unit_id);
  const links = db
    .prepare(
      "SELECT count(*) total,sum(CASE WHEN status='active' THEN 1 ELSE 0 END) active FROM accounts WHERE officer_id=?",
    )
    .get(row.id);
  return {
    id: row.id,
    officerCode: row.officer_code,
    fullName: row.full_name,
    rank: row.rank,
    position: row.position,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    unitId: row.unit_id,
    unitName: related.unit_name,
    businessRole: row.business_role,
    businessRoleName: related.role_name,
    status: row.status,
    statusReason: row.status_reason,
    statusEffectiveDate: row.status_effective_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    linkedAccountCount: links.total,
    linkedActiveAccountCount: links.active ?? 0,
  };
}

function officerRows(db, scope, suffix, suffixParams = []) {
  return db
    .prepare(
      `SELECT o.*,u.name unit_name,r.name role_name,
    (SELECT count(*) FROM accounts a WHERE a.officer_id=o.id) link_total,
    (SELECT count(*) FROM accounts a WHERE a.officer_id=o.id AND a.status='active') link_active
    FROM officers o JOIN units u ON u.id=o.unit_id JOIN roles r ON r.code=o.business_role
    WHERE ${scope.sql} ${suffix}`,
    )
    .all(...scope.params, ...suffixParams)
    .map((r) => ({
      id: r.id,
      officerCode: r.officer_code,
      fullName: r.full_name,
      rank: r.rank,
      position: r.position,
      phone: r.phone,
      email: r.email,
      notes: r.notes,
      unitId: r.unit_id,
      unitName: r.unit_name,
      businessRole: r.business_role,
      businessRoleName: r.role_name,
      status: r.status,
      statusReason: r.status_reason,
      statusEffectiveDate: r.status_effective_date,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      linkedAccountCount: r.link_total,
      linkedActiveAccountCount: r.link_active,
    }));
}

function nodeSnapshot(db, principal, row, kind, counts = true, context = null) {
  const parentId = kind === "unit" ? row.parent_id : row.unit_id;
  const parent = parentId
    ? context
      ? context.units.get(parentId)
      : db.prepare("SELECT name,level FROM units WHERE id=?").get(parentId)
    : null;
  // Only expose leader identity if the officer itself is inside the caller's scope.
  const leaderScope = officerScope(principal);
  const leader = row.leader_officer_id
    ? context
      ? context.officers.get(row.leader_officer_id)
      : db
          .prepare(`SELECT id,full_name FROM officers o WHERE ${leaderScope.sql} AND o.id=?`)
          .get(...leaderScope.params, row.leader_officer_id)
    : null;
  const writable = kind === "unit" ? unitWriteScope(principal) : regionScope(principal, "r", true);
  const editable = context
    ? (kind === "unit" ? context.writableUnits : context.writableRegions).has(row.id)
    : db
        .prepare(
          `SELECT 1 FROM ${kind === "unit" ? "units u" : "regions r"} WHERE ${writable.sql} AND ${kind === "unit" ? "u" : "r"}.id=?`,
        )
        .get(...writable.params, row.id);
  const contextOnly = !editable;
  const result = {
    id: row.id,
    kind,
    code: row.code ?? row.id,
    name: row.name,
    level: kind === "unit" ? row.level : "NEIGHBORHOOD",
    parentId,
    parentName: parent?.name ?? null,
    leaderOfficerId: !contextOnly ? (leader?.id ?? null) : null,
    leaderName: !contextOnly ? (leader?.full_name ?? null) : null,
    leaderHidden: !contextOnly && Boolean(row.leader_officer_id && !leader),
    status: row.status,
    notes: !contextOnly ? row.notes : "",
    readOnly: row.level === "ROOT" || !editable,
    legacyParent: kind === "region" && parent?.level !== "WARD",
    ...(!contextOnly ? { createdAt: row.created_at, updatedAt: row.updated_at } : {}),
  };
  if (counts) {
    if (context) {
      const totals = (kind === "unit" ? context.unitCounts : context.regionCounts).get(row.id);
      result.facilityCount = totals?.facilities ?? 0;
      result.officerCount = totals?.officers ?? 0;
      return result;
    }
    const facilities = facilityScope(principal),
      officers = officerScope(principal);
    result.facilityCount = db
      .prepare(
        `SELECT count(*) total FROM facilities f WHERE ${facilities.sql} AND ${kind === "unit" ? `f.region_id IN (SELECT id FROM regions WHERE unit_id IN (${descendants}))` : "f.region_id=?"}`,
      )
      .get(...facilities.params, row.id).total;
    result.officerCount = db
      .prepare(
        `SELECT count(*) total FROM officers o WHERE ${officers.sql} AND ${kind === "unit" ? `o.unit_id IN (${descendants})` : `EXISTS(SELECT 1 FROM facilities f WHERE ${facilities.sql} AND f.region_id=? AND f.officer_id=o.id)`}`,
      )
      .get(...officers.params, ...(kind === "region" ? facilities.params : []), row.id).total;
  }
  return result;
}

function nodeAuditSnapshot(row, kind) {
  return {
    id: row.id,
    kind,
    code: row.code,
    name: row.name,
    level: kind === "unit" ? row.level : "NEIGHBORHOOD",
    parentId: kind === "unit" ? row.parent_id : row.unit_id,
    leaderOfficerId: row.leader_officer_id,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** One scoped batch per relation, independent of how many tree or lookup rows exist. */
function nodeContext(db, principal) {
  const readableUnits = unitReadScope(principal),
    writableUnits = unitWriteScope(principal),
    writableRegions = regionScope(principal, "r", true),
    visibleOfficers = officerScope(principal),
    visibleFacilities = facilityScope(principal);
  const units = new Map(
    db
      .prepare(`SELECT u.id,u.name,u.level,u.parent_id FROM units u WHERE ${readableUnits.sql}`)
      .all(...readableUnits.params)
      .map((r) => [r.id, r]),
  );
  const officers = new Map(
    db
      .prepare(`SELECT o.id,o.full_name,o.unit_id FROM officers o WHERE ${visibleOfficers.sql}`)
      .all(...visibleOfficers.params)
      .map((r) => [r.id, r]),
  );
  const facilities = db
    .prepare(
      `SELECT f.id,f.officer_id,f.region_id,r.unit_id FROM facilities f JOIN regions r ON r.id=f.region_id WHERE ${visibleFacilities.sql}`,
    )
    .all(...visibleFacilities.params);
  const unitCounts = new Map(),
    regionCounts = new Map(),
    regionOfficers = new Map();
  const addUnitCount = (unitId, field) => {
    const visited = new Set();
    while (units.has(unitId) && !visited.has(unitId)) {
      visited.add(unitId);
      const totals = unitCounts.get(unitId) ?? { officers: 0, facilities: 0 };
      totals[field]++;
      unitCounts.set(unitId, totals);
      unitId = units.get(unitId).parent_id;
    }
  };
  for (const officer of officers.values()) addUnitCount(officer.unit_id, "officers");
  for (const facility of facilities) {
    addUnitCount(facility.unit_id, "facilities");
    const totals = regionCounts.get(facility.region_id) ?? { officers: 0, facilities: 0 };
    totals.facilities++;
    regionCounts.set(facility.region_id, totals);
    if (officers.has(facility.officer_id)) {
      const ids = regionOfficers.get(facility.region_id) ?? new Set();
      ids.add(facility.officer_id);
      regionOfficers.set(facility.region_id, ids);
    }
  }
  for (const [id, ids] of regionOfficers) regionCounts.get(id).officers = ids.size;
  return {
    units,
    officers,
    unitCounts,
    regionCounts,
    writableUnits: new Set(
      db
        .prepare(`SELECT u.id FROM units u WHERE ${writableUnits.sql}`)
        .all(...writableUnits.params)
        .map((r) => r.id),
    ),
    writableRegions: new Set(
      db
        .prepare(`SELECT r.id FROM regions r WHERE ${writableRegions.sql}`)
        .all(...writableRegions.params)
        .map((r) => r.id),
    ),
  };
}

function validateOfficer(db, principal, payload, before) {
  object(payload, officerFields.concat(before ? [] : ["status"]));
  assert(Object.keys(payload).length > 0, 400, "INVALID_INPUT", "Chưa có thông tin cần lưu.");
  if (!before && payload.status !== undefined)
    assert(payload.status === "ACTIVE", 400, "INVALID_INPUT", "Hồ sơ mới phải đang công tác.");
  const merged = {
    officerCode: before?.officer_code,
    fullName: before?.full_name,
    rank: before?.rank,
    position: before?.position,
    phone: before?.phone,
    email: before?.email,
    notes: before?.notes ?? "",
    unitId: before?.unit_id,
    businessRole: before?.business_role,
    ...payload,
  };
  merged.officerCode = code(merged.officerCode, "Mã cán bộ");
  merged.fullName = trimmed(merged.fullName, "Họ tên", 1, 150);
  merged.rank = trimmed(merged.rank, "Cấp bậc", 1, 100);
  merged.position = trimmed(merged.position, "Chức vụ", 1, 150);
  merged.phone = trimmed(merged.phone, "Số điện thoại", 8, 25);
  assert(
    /^\+?[0-9 ()-]+$/.test(merged.phone) &&
      merged.phone.replace(/\D/g, "").length >= 8 &&
      merged.phone.replace(/\D/g, "").length <= 15,
    400,
    "INVALID_INPUT",
    "Số điện thoại phải có 8–15 chữ số.",
  );
  merged.email = trimmed(merged.email, "Email", 3, 254).toLowerCase();
  assert(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(merged.email),
    400,
    "INVALID_INPUT",
    "Email không đúng định dạng.",
  );
  merged.notes = trimmed(merged.notes, "Ghi chú", 0, 2000);
  merged.unitId = idValue(merged.unitId, "Đơn vị");
  merged.businessRole = idValue(merged.businessRole, "Vai trò nghiệp vụ");
  assert(
    db
      .prepare("SELECT 1 FROM roles WHERE code=? AND enabled=1 AND code<>'A07'")
      .get(merged.businessRole),
    400,
    "INVALID_INPUT",
    "Vai trò nghiệp vụ chưa được kích hoạt.",
  );
  const changedUnit = !before || before.unit_id !== merged.unitId;
  const unit = changedUnit
    ? findUnit(db, principal, merged.unitId, true)
    : db.prepare("SELECT * FROM units WHERE id=?").get(merged.unitId);
  assert(
    unit && (unit.status === "ACTIVE" || (!changedUnit && before.status !== "ACTIVE")),
    409,
    "INACTIVE_PARENT",
    "Cán bộ đang công tác phải thuộc đơn vị hoạt động.",
  );
  if (before && changedUnit) assertNoResponsibilities(db, before.id);
  const duplicate = db
    .prepare(
      "SELECT officer_code,email FROM officers WHERE id<>? AND (officer_code=? COLLATE NOCASE OR email=? COLLATE NOCASE)",
    )
    .get(before?.id ?? "", merged.officerCode, merged.email);
  if (duplicate)
    throw new ApiError(
      409,
      duplicate.officer_code.toLowerCase() === merged.officerCode.toLowerCase()
        ? "DUPLICATE_OFFICER_CODE"
        : "DUPLICATE_EMAIL",
      duplicate.officer_code.toLowerCase() === merged.officerCode.toLowerCase()
        ? "Mã cán bộ đã tồn tại."
        : "Email đã tồn tại.",
    );
  return merged;
}

function assertNoResponsibilities(db, officerId) {
  const involved = db
    .prepare(
      `SELECT
    (SELECT count(*) FROM units WHERE leader_officer_id=? AND status='ACTIVE') units,
    (SELECT count(*) FROM regions WHERE leader_officer_id=? AND status='ACTIVE') regions,
    (SELECT count(*) FROM facilities WHERE officer_id=? AND status='active') facilities,
    (SELECT count(*) FROM incident_assignments a JOIN incidents i ON i.id=a.incident_id
      WHERE a.officer_id=? AND a.status IN ('ASSIGNED','IN_PROGRESS')
        AND i.processing_status IN ('NEW','IN_PROGRESS')) incident_tasks`,
    )
    .get(officerId, officerId, officerId, officerId);
  assert(
    Object.values(involved).every((count) => count === 0),
    409,
    "ACTIVE_RESPONSIBILITIES",
    "Cán bộ còn phụ trách đơn vị, khu phố, cơ sở hoặc nhiệm vụ sự cố đang hoạt động. Cần xử lý phân công trước khi thay đổi công tác; hệ thống không tự chuyển giao địa bàn.",
  );
}

function validateLeader(db, principal, officerId, unitId) {
  if (officerId === null) return;
  const officer = findOfficer(db, principal, officerId);
  assert(
    officer.status === "ACTIVE",
    409,
    "INACTIVE_OFFICER",
    "Người phụ trách phải đang công tác.",
  );
  assert(
    db
      .prepare(`SELECT 1 FROM units WHERE id=? AND id IN (${ancestors})`)
      .get(officer.unit_id, unitId),
    400,
    "INVALID_LEADER",
    "Người phụ trách phải thuộc đơn vị này hoặc đơn vị cấp trên.",
  );
}

function assertUnitDeactivation(db, id) {
  const counts = db
    .prepare(
      `SELECT
    (SELECT count(*) FROM units WHERE parent_id=? AND status='ACTIVE') children,
    (SELECT count(*) FROM regions WHERE unit_id IN (${descendants}) AND status='ACTIVE') regions,
    (SELECT count(*) FROM officers WHERE unit_id IN (${descendants}) AND status='ACTIVE') officers,
    (SELECT count(*) FROM facilities f JOIN regions r ON r.id=f.region_id WHERE r.unit_id IN (${descendants}) AND f.status='active') facilities,
    (SELECT count(*) FROM account_scopes s JOIN accounts a ON a.id=s.account_id WHERE a.status='active' AND (
      s.unit_id IN (${descendants}) OR s.region_id IN (SELECT id FROM regions WHERE unit_id IN (${descendants}))
      OR s.facility_id IN (SELECT f.id FROM facilities f JOIN regions r ON r.id=f.region_id WHERE r.unit_id IN (${descendants})))) scopes,
    (SELECT count(*) FROM incidents i WHERE i.unit_id IN (${descendants})
      OR i.region_id IN (SELECT id FROM regions WHERE unit_id IN (${descendants}))
      OR i.facility_id IN (SELECT f.id FROM facilities f JOIN regions r ON r.id=f.region_id WHERE r.unit_id IN (${descendants}))) incidents`,
    )
    .get(id, id, id, id, id, id, id, id, id, id);
  assert(
    Object.values(counts).every((n) => n === 0),
    409,
    "ACTIVE_DEPENDENCIES",
    "Đơn vị còn đơn vị/khu phố con, cán bộ, cơ sở, phạm vi tài khoản đang hoạt động hoặc hồ sơ sự cố cần bảo toàn địa bàn.",
  );
}

function assertRegionDeactivation(db, id) {
  const counts = db
    .prepare(
      `SELECT
    (SELECT count(*) FROM facilities WHERE region_id=? AND status='active') facilities,
    (SELECT count(*) FROM account_scopes s JOIN accounts a ON a.id=s.account_id WHERE a.status='active' AND (s.region_id=? OR s.facility_id IN (SELECT id FROM facilities WHERE region_id=?))) scopes,
    (SELECT count(*) FROM incidents WHERE region_id=? OR facility_id IN (SELECT id FROM facilities WHERE region_id=?)) incidents`,
    )
    .get(id, id, id, id, id);
  assert(
    Object.values(counts).every((n) => n === 0),
    409,
    "ACTIVE_DEPENDENCIES",
    "Khu phố còn cơ sở, phạm vi tài khoản đang hoạt động hoặc hồ sơ sự cố cần bảo toàn địa bàn.",
  );
}

function assertUnreferencedUnit(db, id) {
  const counts = db
    .prepare(
      `SELECT
    (SELECT count(*) FROM units WHERE id IN (${descendants}) AND leader_officer_id IS NOT NULL) leaders,
    (SELECT count(*) FROM regions WHERE unit_id IN (${descendants})) regions,
    (SELECT count(*) FROM officers WHERE unit_id IN (${descendants})) officers,
    (SELECT count(*) FROM account_scopes WHERE unit_id IN (${descendants})) scopes,
    (SELECT count(*) FROM incidents i WHERE i.unit_id IN (${descendants})
      OR i.region_id IN (SELECT id FROM regions WHERE unit_id IN (${descendants}))
      OR i.facility_id IN (SELECT f.id FROM facilities f JOIN regions r ON r.id=f.region_id WHERE r.unit_id IN (${descendants}))) incidents`,
    )
    .get(id, id, id, id, id, id, id);
  assert(
    Object.values(counts).every((n) => n === 0),
    409,
    "REPARENT_REFERENCED",
    "Đơn vị có cán bộ, địa bàn, phạm vi phân quyền hoặc hồ sơ sự cố. Đổi cha cần quy trình chuyển giao riêng để bảo toàn phạm vi hiện có.",
  );
}

function validateNode(db, principal, payload, before, kind) {
  object(payload, nodeFields);
  assert(Object.keys(payload).length > 0, 400, "INVALID_INPUT", "Chưa có thông tin cần lưu.");
  const data = {
    code: before?.code,
    name: before?.name,
    level: kind === "region" ? "NEIGHBORHOOD" : before?.level,
    parentId: kind === "region" ? before?.unit_id : before?.parent_id,
    leaderOfficerId: before?.leader_officer_id ?? null,
    status: before?.status ?? "ACTIVE",
    notes: before?.notes ?? "",
    ...payload,
  };
  data.code = code(data.code, "Mã đơn vị/khu phố");
  data.name = trimmed(data.name, "Tên đơn vị/khu phố", 1, 200);
  data.notes = trimmed(data.notes, "Ghi chú", 0, 2000);
  data.parentId = idValue(data.parentId, "Đơn vị cha");
  data.leaderOfficerId = idValue(data.leaderOfficerId, "Người phụ trách", true);
  data.status = status(data.status);
  assert(
    kind === "region" ? data.level === "NEIGHBORHOOD" : ["AREA", "WARD"].includes(data.level),
    400,
    "INVALID_LEVEL",
    "Chỉ được cấu hình cấp Khu vực, Phường hoặc Khu phố; PC07 là danh mục gốc chỉ đọc.",
  );
  if (before && kind === "unit")
    assert(
      data.level === before.level,
      409,
      "LEVEL_IMMUTABLE",
      "Không đổi cấp của đơn vị đã tồn tại.",
    );
  const parentChanged =
    !before || data.parentId !== (kind === "unit" ? before.parent_id : before.unit_id);
  assert(
    data.parentId !== before?.id,
    400,
    "INVALID_HIERARCHY",
    "Đơn vị không thể làm cha chính nó.",
  );
  const parent = parentChanged
    ? findUnit(db, principal, data.parentId, true)
    : db.prepare("SELECT * FROM units WHERE id=?").get(data.parentId);
  assert(parent, 400, "INVALID_PARENT", "Đơn vị cha không tồn tại.");
  assert(
    data.status !== "ACTIVE" || parent.status === "ACTIVE",
    409,
    "INACTIVE_PARENT",
    "Đơn vị cha phải đang hoạt động.",
  );
  assert(
    kind === "region"
      ? parent.level === "WARD" || (!parentChanged && before)
      : parent.level === (data.level === "AREA" ? "ROOT" : "AREA"),
    400,
    "INVALID_HIERARCHY",
    "Quan hệ hợp lệ: PC07 → Khu vực → Phường → Khu phố. Khu phố cũ được giữ cha cho đến khi chuyển giao.",
  );
  if (before && parentChanged) {
    if (kind === "unit") {
      assert(
        !db
          .prepare(`SELECT 1 FROM units WHERE id=? AND id IN (${descendants})`)
          .get(data.parentId, before.id),
        400,
        "INVALID_HIERARCHY",
        "Không thể tạo vòng lặp cha/con.",
      );
      assertUnreferencedUnit(db, before.id);
    } else {
      const linked = db
        .prepare(
          `SELECT 1 FROM facilities WHERE region_id=? UNION SELECT 1 FROM account_scopes WHERE region_id=?
           UNION SELECT 1 FROM incidents WHERE region_id=? OR facility_id IN (SELECT id FROM facilities WHERE region_id=?) LIMIT 1`,
        )
        .get(before.id, before.id, before.id, before.id);
      assert(
        !linked && !before.leader_officer_id,
        409,
        "REPARENT_REFERENCED",
        "Khu phố có cơ sở, phân công, phạm vi quyền hoặc hồ sơ sự cố; cần quy trình chuyển giao địa bàn riêng.",
      );
    }
  }
  // A new unit can be led by an officer in its parent; after insert the same ancestor rule applies.
  if (
    !before ||
    data.leaderOfficerId !== before.leader_officer_id ||
    parentChanged ||
    data.status !== before.status
  )
    validateLeader(
      db,
      principal,
      data.leaderOfficerId,
      before?.id && kind === "unit" && !parentChanged ? before.id : data.parentId,
    );
  if (data.status === "INACTIVE" && before?.status === "ACTIVE")
    kind === "unit"
      ? assertUnitDeactivation(db, before.id)
      : assertRegionDeactivation(db, before.id);
  const table = kind === "unit" ? "units" : "regions";
  assert(
    !db
      .prepare(`SELECT 1 FROM ${table} WHERE code=? COLLATE NOCASE AND id<>?`)
      .get(data.code, before?.id ?? ""),
    409,
    "DUPLICATE_CODE",
    "Mã đơn vị/khu phố đã tồn tại.",
  );
  return data;
}

function writeWithAudit(db, work) {
  try {
    return transaction(db, work);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // Database unique constraints also cover simultaneous requests, not just prechecks.
    if (String(error.message).includes("UNIQUE constraint failed")) {
      const field = String(error.message).includes("officers.email")
        ? "Email"
        : String(error.message).includes("officers.officer_code")
          ? "Mã cán bộ"
          : "Mã đơn vị/khu phố";
      throw new ApiError(409, "DUPLICATE", `${field} đã tồn tại.`);
    }
    throw error;
  }
}

export function createOfficer(db, principal, payload, ip) {
  requirePermission(principal, "M02.create");
  return writeWithAudit(db, () => {
    const data = validateOfficer(db, principal, payload);
    const id = randomUUID(),
      now = Date.now();
    db.prepare(
      `INSERT INTO officers(id,officer_code,full_name,rank,position,phone,email,notes,unit_id,business_role,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      data.officerCode,
      data.fullName,
      data.rank,
      data.position,
      data.phone,
      data.email,
      data.notes,
      data.unitId,
      data.businessRole,
      now,
      now,
    );
    const after = officerSnapshot(db, db.prepare("SELECT * FROM officers WHERE id=?").get(id));
    audit(db, principal.id, "organization.officer_created", id, null, after, ip);
    return after;
  });
}

export function updateOfficer(db, principal, id, payload, ip) {
  requirePermission(principal, "M02.edit");
  return writeWithAudit(db, () => {
    const before = findOfficer(db, principal, id);
    const data = validateOfficer(db, principal, payload, before);
    db.prepare(
      `UPDATE officers SET officer_code=?,full_name=?,rank=?,position=?,phone=?,email=?,notes=?,unit_id=?,business_role=?,updated_at=? WHERE id=?`,
    ).run(
      data.officerCode,
      data.fullName,
      data.rank,
      data.position,
      data.phone,
      data.email,
      data.notes,
      data.unitId,
      data.businessRole,
      Date.now(),
      id,
    );
    const after = officerSnapshot(db, db.prepare("SELECT * FROM officers WHERE id=?").get(id));
    audit(
      db,
      principal.id,
      "organization.officer_updated",
      id,
      officerSnapshot(db, before),
      after,
      ip,
    );
    return after;
  });
}

export function changeOfficerStatus(db, principal, id, payload, ip) {
  requirePermission(principal, "M02.edit");
  object(payload, ["status", "reason", "effectiveDate"]);
  const newStatus = status(payload.status, ["ACTIVE", "INACTIVE", "TRANSFERRED"]);
  const reason = trimmed(payload.reason, "Lý do", 1, 1000),
    effectiveDate = date(payload.effectiveDate);
  return writeWithAudit(db, () => {
    const before = findOfficer(db, principal, id);
    assert(before.status !== newStatus, 409, "UNCHANGED_STATUS", "Cán bộ đã có trạng thái này.");
    if (newStatus !== "ACTIVE") assertNoResponsibilities(db, id);
    else
      assert(
        db.prepare("SELECT 1 FROM units WHERE id=? AND status='ACTIVE'").get(before.unit_id),
        409,
        "INACTIVE_PARENT",
        "Phải kích hoạt đơn vị trước khi khôi phục công tác.",
      );
    db.prepare(
      "UPDATE officers SET status=?,status_reason=?,status_effective_date=?,updated_at=? WHERE id=?",
    ).run(newStatus, reason, effectiveDate, Date.now(), id);
    const after = officerSnapshot(db, db.prepare("SELECT * FROM officers WHERE id=?").get(id));
    audit(
      db,
      principal.id,
      "organization.officer_status_changed",
      id,
      officerSnapshot(db, before),
      after,
      ip,
    );
    return after;
  });
}

export function saveNode(db, principal, kind, id, payload, ip) {
  requirePermission(principal, id ? "M02.edit" : "M02.create");
  return writeWithAudit(db, () => {
    const before = id
      ? kind === "unit"
        ? findUnit(db, principal, id, true)
        : findRegion(db, principal, id, true)
      : null;
    assert(before?.level !== "ROOT", 409, "READ_ONLY_ROOT", "PC07 là danh mục gốc chỉ đọc.");
    const data = validateNode(db, principal, payload, before, kind);
    const target = id ?? randomUUID(),
      now = Date.now(),
      table = kind === "unit" ? "units" : "regions",
      parentColumn = kind === "unit" ? "parent_id" : "unit_id";
    if (id)
      db.prepare(
        `UPDATE ${table} SET code=?,name=?,${parentColumn}=?,leader_officer_id=?,status=?,notes=?,updated_at=? WHERE id=?`,
      ).run(
        data.code,
        data.name,
        data.parentId,
        data.leaderOfficerId,
        data.status,
        data.notes,
        now,
        id,
      );
    else if (kind === "unit")
      db.prepare(
        "INSERT INTO units(id,code,name,level,parent_id,leader_officer_id,status,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      ).run(
        target,
        data.code,
        data.name,
        data.level,
        data.parentId,
        data.leaderOfficerId,
        data.status,
        data.notes,
        now,
        now,
      );
    else
      db.prepare(
        "INSERT INTO regions(id,code,name,unit_id,leader_officer_id,status,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
      ).run(
        target,
        data.code,
        data.name,
        data.parentId,
        data.leaderOfficerId,
        data.status,
        data.notes,
        now,
        now,
      );
    const afterRow = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(target);
    const after = nodeSnapshot(db, principal, afterRow, kind);
    audit(
      db,
      principal.id,
      `organization.${kind}_${id ? "updated" : "created"}`,
      target,
      before ? nodeAuditSnapshot(before, kind) : null,
      nodeAuditSnapshot(afterRow, kind),
      ip,
    );
    return after;
  });
}

export function changeNodeStatus(db, principal, kind, id, payload, ip) {
  object(payload, ["status"]);
  requirePermission(principal, "M02.edit");
  status(payload.status);
  return writeWithAudit(db, () => {
    const before =
      kind === "unit" ? findUnit(db, principal, id, true) : findRegion(db, principal, id, true);
    assert(before.level !== "ROOT", 409, "READ_ONLY_ROOT", "PC07 là danh mục gốc chỉ đọc.");
    assert(
      before.status !== payload.status,
      409,
      "UNCHANGED_STATUS",
      "Đơn vị/khu phố đã có trạng thái này.",
    );
    const parent = db
      .prepare("SELECT * FROM units WHERE id=?")
      .get(kind === "unit" ? before.parent_id : before.unit_id);
    if (payload.status === "INACTIVE")
      kind === "unit" ? assertUnitDeactivation(db, id) : assertRegionDeactivation(db, id);
    else {
      assert(
        parent?.status === "ACTIVE",
        409,
        "INACTIVE_PARENT",
        "Phải kích hoạt đơn vị cha trước.",
      );
      validateLeader(
        db,
        principal,
        before.leader_officer_id,
        kind === "unit" ? id : before.unit_id,
      );
    }
    const table = kind === "unit" ? "units" : "regions";
    db.prepare(`UPDATE ${table} SET status=?,updated_at=? WHERE id=?`).run(
      payload.status,
      Date.now(),
      id,
    );
    const afterRow = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
    const after = nodeSnapshot(db, principal, afterRow, kind);
    audit(
      db,
      principal.id,
      `organization.${kind}_status_changed`,
      id,
      nodeAuditSnapshot(before, kind),
      nodeAuditSnapshot(afterRow, kind),
      ip,
    );
    return after;
  });
}

export function organizationTree(db, principal) {
  requirePermission(principal, "M02.view");
  const units = unitReadScope(principal),
    regions = regionScope(principal),
    officers = officerScope(principal);
  const context = nodeContext(db, principal);
  const items = db
    .prepare(`SELECT u.* FROM units u WHERE ${units.sql} ORDER BY u.code,u.id`)
    .all(...units.params)
    .map((r) => nodeSnapshot(db, principal, r, "unit", true, context));
  items.push(
    ...db
      .prepare(`SELECT r.* FROM regions r WHERE ${regions.sql} ORDER BY r.code,r.id`)
      .all(...regions.params)
      .map((r) => nodeSnapshot(db, principal, r, "region", true, context)),
  );
  return {
    items,
    stats: {
      unitCount: items.filter((r) => r.kind === "unit").length,
      regionCount: items.filter((r) => r.kind === "region").length,
      activeCount: items.filter((r) => r.status === "ACTIVE").length,
      officerCount: db
        .prepare(`SELECT count(*) total FROM officers o WHERE ${officers.sql}`)
        .get(...officers.params).total,
    },
    permissions: {
      view: true,
      create: principal.permissions.includes("M02.create"),
      edit: principal.permissions.includes("M02.edit"),
    },
  };
}

export function organizationOptions(db, principal) {
  requirePermission(principal, "M02.view");
  const units = unitWriteScope(principal),
    officers = officerScope(principal);
  const context = nodeContext(db, principal);
  return {
    units: db
      .prepare(`SELECT u.* FROM units u WHERE ${units.sql} ORDER BY u.name,u.id`)
      .all(...units.params)
      .map((r) => nodeSnapshot(db, principal, r, "unit", true, context)),
    officers: officerRows(db, officers, "ORDER BY o.full_name,o.id"),
    roles: db
      .prepare("SELECT code,name FROM roles WHERE enabled=1 AND code<>'A07' ORDER BY code")
      .all(),
  };
}

export function listOfficers(db, principal, url) {
  requirePermission(principal, "M02.view");
  const scope = officerScope(principal),
    { page, pageSize } = pagination(url);
  const search = trimmed(
    url.searchParams.get("search") ?? url.searchParams.get("q") ?? "",
    "Từ khóa",
    0,
    100,
  );
  const filterStatus = url.searchParams.get("status"),
    unitId = url.searchParams.get("unitId");
  let sql = `${scope.sql} AND (instr(search_text(o.full_name),search_text(?))>0 OR instr(search_text(o.position),search_text(?))>0 OR instr(search_text(u.name),search_text(?))>0 OR instr(search_text(o.officer_code),search_text(?))>0)`;
  const params = [...scope.params, search, search, search, search];
  if (filterStatus) {
    status(filterStatus, ["ACTIVE", "INACTIVE", "TRANSFERRED"]);
    sql += " AND o.status=?";
    params.push(filterStatus);
  }
  if (unitId) {
    idValue(unitId, "Đơn vị");
    sql += " AND o.unit_id=?";
    params.push(unitId);
  }
  return {
    items: officerRows(db, { sql, params }, "ORDER BY o.full_name,o.id LIMIT ? OFFSET ?", [
      pageSize,
      (page - 1) * pageSize,
    ]),
    total: db
      .prepare(`SELECT count(*) total FROM officers o JOIN units u ON u.id=o.unit_id WHERE ${sql}`)
      .get(...params).total,
    page,
    pageSize,
  };
}

export function listUnits(db, principal, url) {
  requirePermission(principal, "M02.view");
  const scope = unitReadScope(principal),
    { page, pageSize } = pagination(url),
    search = trimmed(url.searchParams.get("search") ?? "", "Từ khóa", 0, 100);
  const filterStatus = url.searchParams.get("status");
  let sql = `${scope.sql} AND (instr(search_text(u.name),search_text(?))>0 OR instr(search_text(u.code),search_text(?))>0)`;
  const params = [...scope.params, search, search];
  if (filterStatus) {
    status(filterStatus);
    sql += " AND u.status=?";
    params.push(filterStatus);
  }
  const context = nodeContext(db, principal);
  return {
    items: db
      .prepare(`SELECT u.* FROM units u WHERE ${sql} ORDER BY u.code,u.id LIMIT ? OFFSET ?`)
      .all(...params, pageSize, (page - 1) * pageSize)
      .map((r) => nodeSnapshot(db, principal, r, "unit", true, context)),
    total: db.prepare(`SELECT count(*) total FROM units u WHERE ${sql}`).get(...params).total,
    page,
    pageSize,
  };
}

/** Synchronous service execution after body has finished prevents stale-session writes. */
export async function handleOrganization({
  db,
  user,
  authenticateAgain,
  path,
  method,
  url,
  readBody,
  send,
  ip,
}) {
  if (!/^\/api\/(organization|units|regions|officers)(\/|$)/.test(path)) return false;
  if (method === "GET") {
    if (path === "/api/organization/tree") {
      send(200, organizationTree(db, user));
      return true;
    }
    if (path === "/api/organization/options") {
      send(200, organizationOptions(db, user));
      return true;
    }
    if (path === "/api/officers") {
      send(200, listOfficers(db, user, url));
      return true;
    }
    if (path === "/api/units") {
      send(200, listUnits(db, user, url));
      return true;
    }
    const match = path.match(/^\/api\/(units|regions|officers)\/([^/]+)$/);
    if (match) {
      requirePermission(user, "M02.view");
      const id = decodeURIComponent(match[2]);
      const result =
        match[1] === "officers"
          ? { officer: officerSnapshot(db, findOfficer(db, user, id)) }
          : match[1] === "units"
            ? { unit: nodeSnapshot(db, user, findUnit(db, user, id), "unit") }
            : { region: nodeSnapshot(db, user, findRegion(db, user, id), "region") };
      send(200, result);
      return true;
    }
    return false;
  }
  const createMatch = method === "POST" && path.match(/^\/api\/(units|regions|officers)$/);
  const updateMatch =
    method === "PATCH" && path.match(/^\/api\/(units|regions|officers)\/([^/]+)(\/status)?$/);
  if (!createMatch && !updateMatch) return false;
  requirePermission(user, createMatch ? "M02.create" : "M02.edit");
  const payload = await readBody();
  const current = authenticateAgain();
  const resource = createMatch ? createMatch[1] : updateMatch[1],
    id = updateMatch ? decodeURIComponent(updateMatch[2]) : null;
  let result;
  if (resource === "officers")
    result = updateMatch?.[3]
      ? changeOfficerStatus(db, current, id, payload, ip)
      : id
        ? updateOfficer(db, current, id, payload, ip)
        : createOfficer(db, current, payload, ip);
  else
    result = updateMatch?.[3]
      ? changeNodeStatus(db, current, resource === "units" ? "unit" : "region", id, payload, ip)
      : saveNode(db, current, resource === "units" ? "unit" : "region", id, payload, ip);
  send(createMatch ? 201 : 200, {
    [resource === "officers" ? "officer" : resource === "units" ? "unit" : "region"]: result,
    message: createMatch ? "Đã tạo thành công." : "Đã cập nhật thành công.",
  });
  return true;
}
