import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  openSync,
  closeSync,
  fsyncSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  lstatSync,
  realpathSync,
} from "node:fs";
import { resolve, extname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError, assert } from "./errors.js";
import { object, pagination, text } from "./validation.js";
import { requirePermission, requireAdministrator, facilityScope } from "../modules/authorization/authorization.service.js";
import { regionScope, unitReadScope, officerScope } from "./organization.js";
import { audit } from "../modules/audit/audit.service.js";
import { transaction } from "./database.js";

const privateDirectory = fileURLToPath(new URL("../private/incident-documents/", import.meta.url));
const records = ["DRAFT", "OFFICIAL"];
const statuses = ["NEW", "IN_PROGRESS", "COMPLETED", "CLOSED"];
const assignmentStatuses = ["ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const terminal = (row) => ["COMPLETED", "CLOSED"].includes(row.processing_status);
const invalid = (condition, message) => assert(condition, 400, "INVALID_INPUT", message);
const trim = (value, label, max = 2000, min = 0) =>
  text(typeof value === "string" ? value.trim() : value, label, min, max);
const nullableId = (value, label) =>
  value == null || value === "" ? null : trim(value, label, 128, 1);
const own = (obj, key) => Object.hasOwn(obj, key);
const descendantIds = `WITH RECURSIVE descendants(id) AS (SELECT id FROM units WHERE id=?
  UNION SELECT u.id FROM units u JOIN descendants d ON u.parent_id=d.id) SELECT id FROM descendants`;

/** Reuses explicit account scopes. No assignment/creator/role can widen these grants. */
export function incidentScope(principal, alias = "i") {
  if (principal.scopes.some((s) => s.kind === "all")) return { sql: "1=1", params: [] };
  const clauses = [],
    params = [];
  for (const s of principal.scopes) {
    if (s.kind === "unit") {
      clauses.push(`(${alias}.unit_id IN (${descendantIds}) OR ${alias}.region_id IN
        (SELECT id FROM regions WHERE unit_id IN (${descendantIds})))`);
      params.push(s.targetId, s.targetId);
    } else if (s.kind === "region") {
      clauses.push(`${alias}.region_id=?`);
      params.push(s.targetId);
    } else if (s.kind === "facility") {
      clauses.push(`${alias}.facility_id=?`);
      params.push(s.targetId);
    }
  }
  return { sql: clauses.length ? `(${clauses.join(" OR ")})` : "0=1", params };
}

export function deadlineWarning(row, policy, now = Date.now()) {
  if (terminal(row)) return "COMPLETED";
  if (row.deadline_at == null) return "NONE";
  if (row.deadline_at < now) return "OVERDUE";
  if (row.deadline_at <= now + policy.warning_hours * 3600000) return "DUE_SOON";
  return "ON_TIME";
}

function policyFor(db) {
  return db.prepare("SELECT * FROM incident_policy WHERE id=1").get();
}
function policyDto(row) {
  return {
    warningHours: row.warning_hours,
    requireDocumentCompletion: Boolean(row.require_document_completion),
    maxUploadBytes: row.max_upload_bytes,
    allowedExtensions: JSON.parse(row.allowed_extensions),
    configurationLabel: row.configuration_label,
  };
}

/** Reject normalized invalid calendar dates and ambiguous timezone-less client values. */
export function incidentTimestamp(value, label, nullable = true) {
  if (nullable && (value == null || value === "")) return null;
  if (typeof value === "number") {
    invalid(
      Number.isSafeInteger(value) && value >= 0 && value <= 253402300799999,
      `${label} không hợp lệ.`,
    );
    return value;
  }
  invalid(typeof value === "string", `${label} không hợp lệ.`);
  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/,
  );
  invalid(match, `${label} phải có ngày, giờ và múi giờ.`);
  const date = new Date(`${match[1]}T00:00:00Z`);
  invalid(
    !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === match[1] &&
      Number(match[2]) <= 23 &&
      Number(match[3]) <= 59 &&
      Number(match[4] || 0) <= 59,
    `${label} không tồn tại.`,
  );
  if (match[6] !== "Z")
    invalid(
      Number(match[6].slice(1, 3)) <= 14 &&
        Number(match[6].slice(4)) <= 59 &&
        (Number(match[6].slice(1, 3)) !== 14 || Number(match[6].slice(4)) === 0),
      `${label} có múi giờ sai.`,
    );
  const result = Date.parse(value);
  invalid(
    Number.isFinite(result) && result >= 0 && result <= 253402300799999,
    `${label} không hợp lệ.`,
  );
  return result;
}

function findIncident(db, user, id) {
  const s = incidentScope(user);
  const row = db
    .prepare(`SELECT i.* FROM incidents i WHERE ${s.sql} AND i.id=?`)
    .get(...s.params, id);
  assert(row, 404, "NOT_FOUND", "Không tìm thấy sự cố trong phạm vi được cấp.");
  return row;
}
function versionCheck(body, row) {
  if (own(body, "version")) {
    invalid(
      Number.isSafeInteger(body.version) && body.version >= 1,
      "Phiên bản hồ sơ không hợp lệ.",
    );
    assert(
      body.version === row.version,
      409,
      "VERSION_CONFLICT",
      "Hồ sơ đã thay đổi. Vui lòng tải lại trước khi lưu.",
    );
  }
}
function allowedAny(user, permissions) {
  requirePermission(user, permissions.find((p) => user.permissions.includes(p)) || permissions[0]);
}
function history(db, user, before, after, reason, notes, now) {
  db.prepare(
    `INSERT INTO incident_status_history(incident_id,from_status,to_status,from_record_status,to_record_status,
    old_deadline_at,new_deadline_at,changed_by,changed_at,reason,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    after.id,
    before?.processing_status ?? null,
    after.processing_status,
    before?.record_status ?? null,
    after.record_status,
    before?.deadline_at ?? null,
    after.deadline_at,
    user.id,
    now,
    reason,
    notes,
  );
}
function incidentAudit(db, user, action, id, before, after, body, ip) {
  audit(
    db,
    user.id,
    action,
    id,
    before,
    { ...after, reason: body?.reason ? trim(body.reason, "Lý do", 2000) : "" },
    ip,
  );
}
function relations(db, user, row, previous = null) {
  let facility = null,
    region = null;
  if (row.facility_id) {
    const s = facilityScope(user);
    facility = db
      .prepare(`SELECT f.* FROM facilities f WHERE ${s.sql} AND f.id=?`)
      .get(...s.params, row.facility_id);
    assert(facility, 404, "NOT_FOUND", "Không tìm thấy cơ sở trong phạm vi được cấp.");
    if (!previous || previous.facility_id !== row.facility_id)
      invalid(facility.status === "active", "Cơ sở đã ngừng hoạt động.");
    if (!row.region_id) row.region_id = facility.region_id;
    invalid(row.region_id === facility.region_id, "Cơ sở không thuộc khu vực đã chọn.");
  }
  if (row.region_id) {
    const s = regionScope(user);
    region = db
      .prepare(`SELECT r.* FROM regions r WHERE ${s.sql} AND r.id=?`)
      .get(...s.params, row.region_id);
    assert(region, 404, "NOT_FOUND", "Không tìm thấy khu vực trong phạm vi được cấp.");
    if (!previous || previous.region_id !== row.region_id)
      invalid(region.status === "ACTIVE", "Khu vực đã ngừng hoạt động.");
    if (!row.unit_id) row.unit_id = region.unit_id;
    invalid(row.unit_id === region.unit_id, "Đơn vị phải quản lý khu vực đã chọn.");
  }
  if (row.unit_id) {
    const s = unitReadScope(user);
    const unit = db
      .prepare(`SELECT u.* FROM units u WHERE ${s.sql} AND u.id=?`)
      .get(...s.params, row.unit_id);
    assert(unit, 404, "NOT_FOUND", "Không tìm thấy đơn vị trong phạm vi được cấp.");
    if (!previous || previous.unit_id !== row.unit_id)
      invalid(unit.status === "ACTIVE", "Đơn vị đã ngừng hoạt động.");
  }
  // The candidate itself must fit a grant; parent-context lookups never confer write rights.
  const s = incidentScope(user);
  const visible = db
    .prepare(`SELECT 1 FROM (SELECT ? unit_id,? region_id,? facility_id) i WHERE ${s.sql}`)
    .get(row.unit_id, row.region_id, row.facility_id, ...s.params);
  assert(visible, 403, "OUT_OF_SCOPE", "Sự cố phải thuộc phạm vi dữ liệu được cấp.");
}

const incidentFields = [
  "incidentType",
  "incidentSubtype",
  "title",
  "description",
  "occurredAt",
  "reportedAt",
  "address",
  "sceneDetails",
  "regionId",
  "unitId",
  "facilityId",
  "recordStatus",
  "deadlineAt",
  "version",
  "reason",
  "notes",
];
function incidentInput(db, user, payload, previous, now) {
  const body = object(payload, incidentFields);
  const row = previous
    ? { ...previous }
    : {
        incident_type: null,
        incident_subtype: null,
        title: "",
        description: "",
        occurred_at: null,
        reported_at: now,
        address: "",
        scene_details: "",
        region_id: null,
        unit_id: null,
        facility_id: null,
        record_status: "DRAFT",
        processing_status: "NEW",
        deadline_at: null,
        completed_at: null,
      };
  for (const [key, col, max] of [
    ["title", "title", 250],
    ["description", "description", 10000],
    ["address", "address", 1000],
    ["sceneDetails", "scene_details", 20000],
  ])
    if (own(body, key)) row[col] = trim(body[key], key, max);
  for (const [key, col] of [
    ["incidentType", "incident_type"],
    ["incidentSubtype", "incident_subtype"],
    ["regionId", "region_id"],
    ["unitId", "unit_id"],
    ["facilityId", "facility_id"],
  ])
    if (own(body, key)) row[col] = nullableId(body[key], key);
  for (const [key, col] of [
    ["occurredAt", "occurred_at"],
    ["reportedAt", "reported_at"],
  ])
    if (own(body, key)) row[col] = incidentTimestamp(body[key], key, key !== "reportedAt");
  if (own(body, "deadlineAt")) {
    invalid(!previous, "Đổi hạn xử lý bằng chức năng deadline riêng để lưu lịch sử.");
    row.deadline_at = incidentTimestamp(body.deadlineAt, "Hạn xử lý");
    if (row.deadline_at != null) allowedAny(user, ["M09.edit", "M09.approve"]);
  }
  if (own(body, "recordStatus")) {
    invalid(records.includes(body.recordStatus), "Trạng thái hồ sơ không hợp lệ.");
    row.record_status = body.recordStatus;
  }
  if (previous) {
    versionCheck(body, previous);
    invalid(
      !(previous.record_status === "OFFICIAL" && row.record_status === "DRAFT"),
      "Hồ sơ chính thức không thể chuyển về nháp.",
    );
    // Switching territory requires selecting its related unit/facility explicitly or clearing stale links.
    if (own(body, "regionId") && body.regionId !== previous.region_id && !own(body, "unitId"))
      row.unit_id = null;
  }
  if (row.incident_type) {
    const type = db.prepare("SELECT * FROM incident_types WHERE code=?").get(row.incident_type);
    invalid(
      type && (type.enabled || previous?.incident_type === row.incident_type),
      "Loại sự cố không có trong danh mục đang sử dụng.",
    );
  }
  if (row.incident_subtype) {
    const subtype = db
      .prepare("SELECT * FROM incident_subtypes WHERE type_code=? AND code=?")
      .get(row.incident_type, row.incident_subtype);
    invalid(
      subtype &&
        (subtype.enabled ||
          (previous?.incident_subtype === row.incident_subtype &&
            previous?.incident_type === row.incident_type)),
      "Phân nhóm không thuộc loại sự cố đã chọn.",
    );
  }
  if (row.record_status === "OFFICIAL")
    invalid(
      row.incident_type && row.occurred_at != null && row.address,
      "Hồ sơ chính thức phải có loại sự cố, thời điểm xảy ra và địa điểm.",
    );
  if (row.deadline_at != null && row.occurred_at != null)
    invalid(row.deadline_at >= row.occurred_at, "Hạn xử lý không được trước thời điểm xảy ra.");
  relations(db, user, row, previous);
  return { body, row };
}

function assignmentDto(db, user, row) {
  const scope = officerScope(user);
  const officer = db
    .prepare(`SELECT o.full_name FROM officers o WHERE ${scope.sql} AND o.id=?`)
    .get(...scope.params, row.officer_id);
  return {
    id: row.id,
    incidentId: row.incident_id,
    officerId: row.officer_id,
    officerName: officer?.full_name || "Cán bộ ngoài phạm vi danh bạ",
    assignedBy: row.assigned_by,
    taskDescription: row.task_description,
    deadlineAt: row.deadline_at,
    status: row.status,
    notes: row.notes,
    assignedAt: row.assigned_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}
function assignmentsFor(db, user, id) {
  return db
    .prepare("SELECT * FROM incident_assignments WHERE incident_id=? ORDER BY assigned_at,id")
    .all(id)
    .map((r) => assignmentDto(db, user, r));
}
function damageDto(r) {
  return {
    id: r.id,
    incidentId: r.incident_id,
    damageGroup: r.damage_group,
    damageType: r.damage_type,
    quantity: r.quantity,
    propertyValue: r.property_value,
    description: r.description,
    notes: r.notes,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
function documentsFor(db, id) {
  return db
    .prepare("SELECT * FROM incident_documents WHERE incident_id=? ORDER BY uploaded_at,id")
    .all(id)
    .map(documentDto);
}
function documentDto(r) {
  return {
    id: r.id,
    incidentId: r.incident_id,
    fileName: r.original_name,
    fileType: r.file_type,
    mimeType: r.mime_type,
    size: r.size_bytes,
    uploadedBy: r.uploaded_by,
    uploadedAt: r.uploaded_at,
  };
}
function incidentDto(db, user, r, policy, now) {
  return {
    id: r.id,
    incidentCode: r.incident_code,
    incidentType: r.incident_type,
    incidentSubtype: r.incident_subtype,
    title: r.title,
    description: r.description,
    occurredAt: r.occurred_at,
    reportedAt: r.reported_at,
    address: r.address,
    sceneDetails: r.scene_details,
    regionId: r.region_id,
    unitId: r.unit_id,
    facilityId: r.facility_id,
    regionName: db.prepare("SELECT name FROM regions WHERE id=?").get(r.region_id)?.name || null,
    unitName: db.prepare("SELECT name FROM units WHERE id=?").get(r.unit_id)?.name || null,
    facilityName:
      db.prepare("SELECT name FROM facilities WHERE id=?").get(r.facility_id)?.name || null,
    recordStatus: r.record_status,
    processingStatus: r.processing_status,
    deadlineAt: r.deadline_at,
    completedAt: r.completed_at,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    version: r.version,
    deadlineWarning: deadlineWarning(r, policy, now),
    assignments: assignmentsFor(db, user, r.id),
  };
}
function period(raw, end = false) {
  invalid(/^\d{4}-\d{2}-\d{2}$/.test(raw), "Bộ lọc ngày phải có định dạng YYYY-MM-DD.");
  const d = new Date(raw + "T00:00:00Z");
  invalid(
    !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === raw,
    "Ngày lọc không tồn tại.",
  );
  return d.getTime() - 7 * 3600000 + (end ? 86400000 : 0);
}
function filterFor(user, url, policy, now, statistics = false) {
  const scope = incidentScope(user);
  const clauses = [scope.sql],
    params = [...scope.params];
  const q = url.searchParams;
  for (const [key, col, valid] of [
    ["incidentType", "incident_type", null],
    ["regionId", "region_id", null],
    ["processingStatus", "processing_status", statuses],
    ["recordStatus", "record_status", records],
  ]) {
    const value = q.get(key);
    if (value) {
      invalid(value.length <= 128 && (!valid || valid.includes(value)), "Bộ lọc không hợp lệ.");
      clauses.push(`i.${col}=?`);
      params.push(value);
    }
  }
  if (statistics) {
    invalid(
      !q.get("recordStatus") || q.get("recordStatus") === "OFFICIAL",
      "Thống kê chỉ tính hồ sơ chính thức.",
    );
    clauses.push("i.record_status='OFFICIAL'");
  }
  const search = q.get("search");
  if (search) {
    invalid(search.length <= 100, "Từ khóa tìm kiếm quá dài.");
    clauses.push(
      "(instr(search_text(i.incident_code||' '||i.title||' '||i.address),search_text(?))>0)",
    );
    params.push(search);
  }
  const from = q.get("from"),
    to = q.get("to");
  if (from) {
    clauses.push("i.occurred_at>=?");
    params.push(period(from));
  }
  if (to) {
    clauses.push("i.occurred_at<?");
    params.push(period(to, true));
  }
  if (from && to) invalid(from <= to, "Từ ngày không được sau đến ngày.");
  const warning = q.get("deadlineWarning");
  if (warning) {
    invalid(
      ["NONE", "ON_TIME", "DUE_SOON", "OVERDUE", "COMPLETED"].includes(warning),
      "Bộ lọc cảnh báo không hợp lệ.",
    );
    if (warning === "COMPLETED") clauses.push("i.processing_status IN ('COMPLETED','CLOSED')");
    else {
      clauses.push("i.processing_status NOT IN ('COMPLETED','CLOSED')");
      if (warning === "NONE") clauses.push("i.deadline_at IS NULL");
      if (warning === "OVERDUE") {
        clauses.push("i.deadline_at<?");
        params.push(now);
      }
      if (warning === "DUE_SOON") {
        clauses.push("i.deadline_at>=? AND i.deadline_at<=?");
        params.push(now, now + policy.warning_hours * 3600000);
      }
      if (warning === "ON_TIME") {
        clauses.push("i.deadline_at>?");
        params.push(now + policy.warning_hours * 3600000);
      }
    }
  }
  return { sql: clauses.join(" AND "), params };
}

function statisticsFor(db, user, url, policy, now) {
  const f = filterFor(user, url, policy, now, true);
  const all = db.prepare(`SELECT i.* FROM incidents i WHERE ${f.sql}`).all(...f.params);
  const groups = (expression, extra = "", joins = "") =>
    db
      .prepare(
        `SELECT ${expression} key,${extra} count(*) count FROM incidents i ${joins} WHERE ${f.sql} GROUP BY ${expression} ORDER BY key`,
      )
      .all(...f.params);
  const dateGroups = (format) =>
    groups(`strftime('${format}',i.occurred_at/1000,'unixepoch','+7 hours')`);
  const damageRows = db
    .prepare(
      `SELECT d.damage_group,d.damage_type,d.quantity,d.property_value
    FROM incident_damages d JOIN incidents i ON i.id=d.incident_id WHERE ${f.sql}`,
    )
    .all(...f.params);
  // Integer VND remain exact even when many records exceed SQLite SUM/JS ranges.
  const humanTotals = new Map();
  let propertyTotal = 0n;
  for (const damage of damageRows) {
    if (damage.damage_group === "PROPERTY") propertyTotal += BigInt(damage.property_value);
    else
      humanTotals.set(
        damage.damage_type,
        (humanTotals.get(damage.damage_type) || 0n) + BigInt(damage.quantity),
      );
  }
  assert(
    propertyTotal <= BigInt(Number.MAX_SAFE_INTEGER) &&
      [...humanTotals.values()].every((value) => value <= BigInt(Number.MAX_SAFE_INTEGER)),
    422,
    "AGGREGATE_TOO_LARGE",
    "Tổng thiệt hại vượt giới hạn biểu diễn. Vui lòng chọn kỳ hoặc khu vực nhỏ hơn.",
  );
  const processing = { new: 0, inProgress: 0, completed: 0, closed: 0 },
    deadlines = { dueSoon: 0, overdue: 0 };
  const keys = { NEW: "new", IN_PROGRESS: "inProgress", COMPLETED: "completed", CLOSED: "closed" };
  for (const r of all) {
    processing[keys[r.processing_status]]++;
    const warning = deadlineWarning(r, policy, now);
    if (warning === "DUE_SOON") deadlines.dueSoon++;
    if (warning === "OVERDUE") deadlines.overdue++;
  }
  const draftScope = filterFor(
    user,
    new URL(
      url.origin +
        "/api/incidents?" +
        new URLSearchParams([...url.searchParams].filter(([k]) => k !== "recordStatus")),
    ),
    policy,
    now,
  );
  return {
    total: all.length,
    byType: groups(
      "i.incident_type",
      "t.name name,",
      "LEFT JOIN incident_types t ON t.code=i.incident_type",
    ),
    byDay: dateGroups("%Y-%m-%d"),
    byMonth: dateGroups("%Y-%m"),
    byYear: dateGroups("%Y"),
    byRegion: groups(
      "i.region_id",
      "coalesce(r.name,'Chưa xác định') name,",
      "LEFT JOIN regions r ON r.id=i.region_id",
    ),
    damages: {
      human: [...humanTotals]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([damageType, quantity]) => ({ damageType, quantity: Number(quantity) })),
      propertyValue: Number(propertyTotal),
    },
    processing,
    deadlines,
    draftsExcluded: db
      .prepare(
        `SELECT count(*) total FROM incidents i WHERE ${draftScope.sql} AND i.record_status='DRAFT'`,
      )
      .get(...draftScope.params).total,
    filters: Object.fromEntries(url.searchParams),
    timezone: "Asia/Ho_Chi_Minh",
  };
}

function optionsFor(db, user, policy) {
  const u = unitReadScope(user),
    r = regionScope(user),
    f = facilityScope(user),
    o = officerScope(user);
  return {
    units: db
      .prepare(
        `SELECT u.id,u.name FROM units u WHERE ${u.sql} AND u.status='ACTIVE' ORDER BY u.name`,
      )
      .all(...u.params),
    regions: db
      .prepare(
        `SELECT r.id,r.name,r.unit_id unitId FROM regions r WHERE ${r.sql} AND r.status='ACTIVE' ORDER BY r.name`,
      )
      .all(...r.params),
    facilities: db
      .prepare(
        `SELECT f.id,f.name,f.region_id regionId FROM facilities f JOIN regions r ON r.id=f.region_id JOIN units u ON u.id=r.unit_id WHERE ${f.sql} AND f.status='active' AND r.status='ACTIVE' AND u.status='ACTIVE' ORDER BY f.name`,
      )
      .all(...f.params),
    officers: user.permissions.includes("M09.approve")
      ? db
          .prepare(
            `SELECT o.id,o.full_name fullName,o.unit_id unitId FROM officers o JOIN units ou ON ou.id=o.unit_id WHERE ${o.sql} AND o.status='ACTIVE' AND ou.status='ACTIVE' ORDER BY o.full_name`,
          )
          .all(...o.params)
      : [],
    incidentTypes: db
      .prepare("SELECT code,name FROM incident_types WHERE enabled=1 ORDER BY code")
      .all()
      .map((type) => ({
        ...type,
        subtypes: db
          .prepare(
            "SELECT code,name FROM incident_subtypes WHERE type_code=? AND enabled=1 ORDER BY code",
          )
          .all(type.code),
      })),
    policy: policyDto(policy),
  };
}

async function readUpload(request, maxBytes) {
  const contentType = request.headers["content-type"] || "";
  assert(
    /^multipart\/form-data;\s*boundary=/i.test(contentType),
    415,
    "UNSUPPORTED_MEDIA_TYPE",
    "Tải tệp bằng multipart/form-data.",
  );
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    assert(
      size <= maxBytes + 16384,
      413,
      "FILE_TOO_LARGE",
      "Tệp tải lên vượt dung lượng cho phép.",
    );
    chunks.push(chunk);
  }
  let form;
  try {
    form = await new Request("http://localhost/upload", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: Buffer.concat(chunks),
    }).formData();
  } catch {
    throw new ApiError(400, "INVALID_UPLOAD", "Dữ liệu tải tệp không hợp lệ.");
  }
  invalid(
    [...form.keys()].every((key) => ["file", "permitted"].includes(key)) &&
      form.getAll("file").length === 1 &&
      form.getAll("permitted").length === 1,
    "Chỉ tải một tệp và xác nhận dữ liệu được phép sử dụng.",
  );
  invalid(
    form.get("permitted") === "true",
    "Phải xác nhận tệp không chứa dữ liệu mật hoặc chưa được cho phép.",
  );
  const file = form.get("file");
  invalid(file && typeof file.arrayBuffer === "function", "Chưa chọn tệp tải lên.");
  assert(
    file.size > 0 && file.size <= maxBytes,
    file.size > maxBytes ? 413 : 400,
    "FILE_TOO_LARGE",
    "Dung lượng tệp không hợp lệ.",
  );
  const name = file.name;
  invalid(
    name &&
      name.length <= 200 &&
      basename(name) === name &&
      !/[\\/\x00-\x1f\x7f]/.test(name) &&
      name !== "." &&
      name !== "..",
    "Tên tệp không hợp lệ.",
  );
  return { name, bytes: Buffer.from(await file.arrayBuffer()) };
}
function detectFile(name, bytes, policy) {
  const extension = extname(name).slice(1).toLowerCase();
  const allowed = JSON.parse(policy.allowed_extensions);
  let mimeType;
  if (
    extension === "pdf" &&
    bytes.subarray(0, 5).toString() === "%PDF-" &&
    bytes.subarray(-1024).includes(Buffer.from("%%EOF"))
  )
    mimeType = "application/pdf";
  if (
    extension === "png" &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.length >= 33 &&
    bytes.subarray(12, 16).toString() === "IHDR"
  )
    mimeType = "image/png";
  if (
    ["jpg", "jpeg"].includes(extension) &&
    bytes.length >= 4 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255 &&
    bytes.at(-2) === 255 &&
    bytes.at(-1) === 217
  )
    mimeType = "image/jpeg";
  if (extension === "txt") {
    try {
      const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) mimeType = "text/plain";
    } catch {
      /* Invalid UTF-8 is not text. */
    }
  }
  assert(
    allowed.includes(extension) && mimeType,
    415,
    "UNSUPPORTED_FILE_TYPE",
    "Loại tệp hoặc nội dung tệp không phù hợp cấu hình demo.",
  );
  return { extension, mimeType };
}
function storageRoot(directory) {
  const path = resolve(directory || process.env.INCIDENT_UPLOAD_DIR || privateDirectory);
  const publicRoot = resolve(
    fileURLToPath(new URL("../../../pccc-FE/public/", import.meta.url)),
  ).toLowerCase();
  const isPublic = (candidate) =>
    candidate.toLowerCase() === publicRoot ||
    candidate.toLowerCase().startsWith(publicRoot + "/") ||
    candidate.toLowerCase().startsWith(publicRoot + "\\");
  assert(!isPublic(path), 500, "STORAGE_ERROR", "Kho tài liệu phải nằm ngoài thư mục public.");
  mkdirSync(path, { recursive: true, mode: 0o700 });
  assert(!lstatSync(path).isSymbolicLink(), 500, "STORAGE_ERROR", "Thư mục lưu tệp không hợp lệ.");
  const canonical = realpathSync(path);
  assert(!isPublic(canonical), 500, "STORAGE_ERROR", "Kho tài liệu phải nằm ngoài thư mục public.");
  return canonical;
}

/** One handler shares existing sessions, RBAC, SQL scope and append-only audit. */
export async function handleIncidents(ctx) {
  const {
    db,
    path,
    method,
    url,
    ip,
    send,
    request,
    response,
    authenticateAgain,
    readBody,
    uploadDirectory,
    now = Date.now,
  } = ctx;
  if (path !== "/api/incidents" && !path.startsWith("/api/incidents/")) return false;
  let user = ctx.user;
  const policy = policyFor(db),
    time = now();
  const dto = (row) => incidentDto(db, user, row, policyFor(db), now());
  const mutation = (body, permissions, work) =>
    transaction(db, () => {
      user = authenticateAgain();
      allowedAny(user, permissions);
      return work(body);
    });

  if (path === "/api/incidents/configuration") {
    requireAdministrator(user, method === "GET" ? "M01.view" : "M01.edit");
    if (method === "GET") {
      send(200, {
        policy: policyDto(policy),
        incidentTypes: db.prepare("SELECT * FROM incident_types ORDER BY code").all(),
        subtypes: db.prepare("SELECT * FROM incident_subtypes ORDER BY type_code,code").all(),
      });
      return true;
    }
    if (method === "PATCH") {
      const body = object(await readBody(), [
        "warningHours",
        "requireDocumentCompletion",
        "maxUploadBytes",
        "allowedExtensions",
        "reason",
      ]);
      transaction(db, () => {
        user = authenticateAgain();
        requireAdministrator(user);
        const before = policyFor(db),
          after = { ...before };
        if (own(body, "warningHours")) {
          invalid(
            Number.isInteger(body.warningHours) &&
              body.warningHours >= 0 &&
              body.warningHours <= 8760,
            "Ngưỡng cảnh báo phải từ 0 đến 8760 giờ.",
          );
          after.warning_hours = body.warningHours;
        }
        if (own(body, "requireDocumentCompletion")) {
          invalid(
            typeof body.requireDocumentCompletion === "boolean",
            "Cấu hình tài liệu bắt buộc không hợp lệ.",
          );
          after.require_document_completion = Number(body.requireDocumentCompletion);
        }
        if (own(body, "maxUploadBytes")) {
          invalid(
            Number.isInteger(body.maxUploadBytes) &&
              body.maxUploadBytes >= 1 &&
              body.maxUploadBytes <= 10485760,
            "Dung lượng tệp tối đa từ 1 byte đến 10 MB.",
          );
          after.max_upload_bytes = body.maxUploadBytes;
        }
        if (own(body, "allowedExtensions")) {
          invalid(
            Array.isArray(body.allowedExtensions) &&
              body.allowedExtensions.length >= 1 &&
              body.allowedExtensions.length <= 5 &&
              body.allowedExtensions.every((e) =>
                ["txt", "pdf", "png", "jpg", "jpeg"].includes(e),
              ) &&
              new Set(body.allowedExtensions).size === body.allowedExtensions.length,
            "Danh mục tệp demo chỉ hỗ trợ TXT, PDF, PNG, JPG/JPEG.",
          );
          after.allowed_extensions = JSON.stringify(body.allowedExtensions);
        }
        after.updated_by = user.id;
        after.updated_at = now();
        db.prepare(
          "UPDATE incident_policy SET warning_hours=?,require_document_completion=?,max_upload_bytes=?,allowed_extensions=?,updated_by=?,updated_at=? WHERE id=1",
        ).run(
          after.warning_hours,
          after.require_document_completion,
          after.max_upload_bytes,
          after.allowed_extensions,
          after.updated_by,
          after.updated_at,
        );
        incidentAudit(db, user, "M09.policy.update", "M09.policy", before, after, body, ip);
      });
      send(200, { policy: policyDto(policyFor(db)) });
      return true;
    }
  }
  const typeMatch = path.match(/^\/api\/incidents\/configuration\/types\/([A-Z0-9_]{1,40})$/);
  if (typeMatch && method === "PUT") {
    requireAdministrator(user);
    const body = object(await readBody(), ["name", "enabled", "subtypes", "reason"]);
    transaction(db, () => {
      user = authenticateAgain();
      requireAdministrator(user);
      const code = typeMatch[1],
        name = trim(body.name, "Tên loại sự cố", 150, 1);
      invalid(typeof body.enabled === "boolean", "Trạng thái danh mục không hợp lệ.");
      const before = {
        type: db.prepare("SELECT * FROM incident_types WHERE code=?").get(code) || null,
        subtypes: db.prepare("SELECT * FROM incident_subtypes WHERE type_code=?").all(code),
      };
      db.prepare(
        "INSERT INTO incident_types(code,name,enabled,configuration_label) VALUES (?,?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name,enabled=excluded.enabled",
      ).run(code, name, Number(body.enabled), policy.configuration_label);
      if (own(body, "subtypes")) {
        invalid(
          Array.isArray(body.subtypes) && body.subtypes.length <= 100,
          "Phân nhóm không hợp lệ.",
        );
        const seen = new Set();
        for (const item of body.subtypes) {
          object(item, ["code", "name", "enabled"]);
          invalid(
            typeof item.code === "string" &&
              /^[A-Z0-9_]{1,40}$/.test(item.code) &&
              !seen.has(item.code),
            "Mã phân nhóm không hợp lệ hoặc bị trùng.",
          );
          seen.add(item.code);
          invalid(typeof item.enabled === "boolean", "Trạng thái phân nhóm không hợp lệ.");
          db.prepare(
            "INSERT INTO incident_subtypes(type_code,code,name,enabled) VALUES (?,?,?,?) ON CONFLICT(type_code,code) DO UPDATE SET name=excluded.name,enabled=excluded.enabled",
          ).run(code, item.code, trim(item.name, "Tên phân nhóm", 150, 1), Number(item.enabled));
        }
      }
      incidentAudit(
        db,
        user,
        "M09.catalog.update",
        `M09.type:${code}`,
        before,
        {
          type: db.prepare("SELECT * FROM incident_types WHERE code=?").get(code),
          subtypes: db.prepare("SELECT * FROM incident_subtypes WHERE type_code=?").all(code),
        },
        body,
        ip,
      );
    });
    send(200, { message: "Đã cập nhật danh mục cấu hình." });
    return true;
  }
  if (method === "GET" && path === "/api/incidents/options") {
    allowedAny(user, ["M09.view", "M09.export"]);
    send(200, optionsFor(db, user, policy));
    return true;
  }
  if (method === "GET" && path === "/api/incidents/statistics") {
    requirePermission(user, "M09.export");
    send(200, statisticsFor(db, user, url, policy, time));
    return true;
  }
  if (path === "/api/incidents") {
    if (method === "GET") {
      requirePermission(user, "M09.view");
      const f = filterFor(user, url, policy, time),
        { page, pageSize } = pagination(url);
      send(200, {
        items: db
          .prepare(
            `SELECT i.* FROM incidents i WHERE ${f.sql} ORDER BY i.created_at DESC,i.id LIMIT ? OFFSET ?`,
          )
          .all(...f.params, pageSize, (page - 1) * pageSize)
          .map(dto),
        total: db.prepare(`SELECT count(*) total FROM incidents i WHERE ${f.sql}`).get(...f.params)
          .total,
        page,
        pageSize,
      });
      return true;
    }
    if (method === "POST") {
      requirePermission(user, "M09.create");
      const payload = await readBody();
      const created = mutation(payload, ["M09.create"], (input) => {
        const current = now(),
          { row, body } = incidentInput(db, user, input, null, current);
        row.id = randomUUID();
        row.incident_code = `SC-${new Date(current + 7 * 3600000).getUTCFullYear()}-${row.id.toUpperCase()}`;
        row.created_by = row.updated_by = user.id;
        row.created_at = row.updated_at = current;
        row.version = 1;
        db.prepare(
          `INSERT INTO incidents(id,incident_code,incident_type,incident_subtype,title,description,occurred_at,reported_at,address,scene_details,region_id,unit_id,facility_id,record_status,processing_status,deadline_at,completed_at,created_by,updated_by,created_at,updated_at,version)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ).run(
          ...[
            "id",
            "incident_code",
            "incident_type",
            "incident_subtype",
            "title",
            "description",
            "occurred_at",
            "reported_at",
            "address",
            "scene_details",
            "region_id",
            "unit_id",
            "facility_id",
            "record_status",
            "processing_status",
            "deadline_at",
            "completed_at",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "version",
          ].map((k) => row[k]),
        );
        history(
          db,
          user,
          null,
          row,
          body.reason ? trim(body.reason, "Lý do") : "",
          body.notes ? trim(body.notes, "Ghi chú") : "",
          current,
        );
        incidentAudit(db, user, "M09.incident.create", row.id, null, row, body, ip);
        return row;
      });
      send(201, { incident: dto(created) });
      return true;
    }
  }
  const match = path.match(/^\/api\/incidents\/([^/]+)(?:\/(.*))?$/);
  assert(match, 404, "NOT_FOUND", "API sự cố không tồn tại.");
  let id;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    throw new ApiError(400, "INVALID_INPUT", "Mã hồ sơ không hợp lệ.");
  }
  invalid(id.length <= 128 && !/[\\/\x00]/.test(id), "Mã hồ sơ không hợp lệ.");
  const suffix = match[2] || "";
  if (method === "GET") {
    requirePermission(user, "M09.view");
    const row = findIncident(db, user, id);
    if (!suffix) {
      send(200, {
        incident: dto(row),
        damages: db
          .prepare("SELECT * FROM incident_damages WHERE incident_id=? ORDER BY created_at,id")
          .all(id)
          .map(damageDto),
        documents: documentsFor(db, id),
        assignments: assignmentsFor(db, user, id),
      });
      return true;
    }
    if (suffix === "damages") {
      send(200, {
        damages: db
          .prepare("SELECT * FROM incident_damages WHERE incident_id=? ORDER BY created_at,id")
          .all(id)
          .map(damageDto),
      });
      return true;
    }
    if (suffix === "assignments") {
      send(200, { assignments: assignmentsFor(db, user, id) });
      return true;
    }
    if (suffix === "documents") {
      send(200, { documents: documentsFor(db, id) });
      return true;
    }
    if (suffix === "history") {
      send(200, {
        history: db
          .prepare(
            "SELECT * FROM incident_status_history WHERE incident_id=? ORDER BY changed_at DESC,id DESC",
          )
          .all(id)
          .map((r) => ({
            id: r.id,
            fromStatus: r.from_status,
            toStatus: r.to_status,
            fromRecordStatus: r.from_record_status,
            toRecordStatus: r.to_record_status,
            oldDeadlineAt: r.old_deadline_at,
            newDeadlineAt: r.new_deadline_at,
            changedBy: r.changed_by,
            changedAt: r.changed_at,
            reason: r.reason,
            notes: r.notes,
          })),
        auditLogs: db
          .prepare(
            "SELECT * FROM audit_logs WHERE object_id=? AND action LIKE 'M09.%' ORDER BY id DESC",
          )
          .all(id)
          .map((r) => ({
            id: r.id,
            action: r.action,
            actorId: r.actor_id,
            occurredAt: r.occurred_at,
            before: r.before_json ? JSON.parse(r.before_json) : null,
            after: r.after_json ? JSON.parse(r.after_json) : null,
          })),
      });
      return true;
    }
    const download = suffix.match(/^documents\/([^/]+)\/download$/);
    if (download) {
      const doc = db
        .prepare("SELECT * FROM incident_documents WHERE incident_id=? AND id=?")
        .get(id, download[1]);
      assert(doc, 404, "NOT_FOUND", "Không tìm thấy tài liệu trong hồ sơ.");
      invalid(
        /^[a-f0-9-]+\.(txt|pdf|png|jpg|jpeg)$/.test(doc.storage_key) &&
          doc.storage_key === doc.stored_name,
        "Thông tin lưu trữ tệp không hợp lệ.",
      );
      const filePath = join(storageRoot(uploadDirectory), doc.storage_key);
      let bytes;
      try {
        assert(
          lstatSync(filePath).isFile() && !lstatSync(filePath).isSymbolicLink(),
          410,
          "DOCUMENT_MISSING",
          "Tệp không còn trong kho lưu trữ.",
        );
        bytes = readFileSync(filePath);
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(
          410,
          "DOCUMENT_MISSING",
          "Tệp không còn trong kho lưu trữ. Vui lòng liên hệ quản trị.",
        );
      }
      assert(
        bytes.length === doc.size_bytes,
        410,
        "DOCUMENT_MISSING",
        "Tệp lưu trữ không khớp hồ sơ.",
      );
      response.statusCode = 200;
      response.setHeader("Content-Type", doc.mime_type);
      response.setHeader("Content-Length", bytes.length);
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="document.${doc.file_type}"; filename*=UTF-8''${encodeURIComponent(doc.original_name).replace(/'/g, "%27")}`,
      );
      response.setHeader("Content-Security-Policy", "sandbox");
      response.end(bytes);
      return true;
    }
  }
  if (method === "PATCH" && !suffix) {
    requirePermission(user, "M09.edit");
    const payload = await readBody();
    const result = mutation(payload, ["M09.edit"], (input) => {
      const previous = findIncident(db, user, id),
        current = now(),
        { body, row } = incidentInput(db, user, input, previous, current);
      row.updated_at = current;
      row.updated_by = user.id;
      row.version++;
      db.prepare(
        `UPDATE incidents SET incident_type=?,incident_subtype=?,title=?,description=?,occurred_at=?,reported_at=?,address=?,scene_details=?,region_id=?,unit_id=?,facility_id=?,record_status=?,updated_by=?,updated_at=?,version=? WHERE id=?`,
      ).run(
        ...[
          "incident_type",
          "incident_subtype",
          "title",
          "description",
          "occurred_at",
          "reported_at",
          "address",
          "scene_details",
          "region_id",
          "unit_id",
          "facility_id",
          "record_status",
          "updated_by",
          "updated_at",
          "version",
        ].map((k) => row[k]),
        id,
      );
      if (previous.record_status !== row.record_status)
        history(
          db,
          user,
          previous,
          row,
          body.reason ? trim(body.reason, "Lý do") : "",
          body.notes ? trim(body.notes, "Ghi chú") : "",
          current,
        );
      const action =
        previous.incident_type !== row.incident_type ||
        previous.incident_subtype !== row.incident_subtype
          ? "M09.classification.update"
          : previous.scene_details !== row.scene_details
            ? "M09.scene.update"
            : "M09.incident.update";
      incidentAudit(db, user, action, id, previous, row, body, ip);
      return row;
    });
    send(200, { incident: dto(result) });
    return true;
  }
  const damageMatch = suffix.match(/^damages(?:\/([^/]+))?$/);
  if (
    damageMatch &&
    ((method === "POST" && !damageMatch[1]) || (method === "PATCH" && damageMatch[1]))
  ) {
    requirePermission(user, "M09.edit");
    const payload = await readBody();
    const result = mutation(payload, ["M09.edit"], (input) => {
      findIncident(db, user, id);
      const body = object(input, [
        "damageGroup",
        "damageType",
        "quantity",
        "propertyValue",
        "description",
        "notes",
        "reason",
      ]);
      const before = damageMatch[1]
        ? db
            .prepare("SELECT * FROM incident_damages WHERE incident_id=? AND id=?")
            .get(id, damageMatch[1])
        : null;
      if (damageMatch[1]) assert(before, 404, "NOT_FOUND", "Không tìm thấy thiệt hại trong hồ sơ.");
      const row = before
        ? { ...before }
        : {
            id: randomUUID(),
            incident_id: id,
            damage_group: "HUMAN",
            damage_type: "OTHER",
            quantity: 0,
            property_value: 0,
            description: "",
            notes: "",
            created_at: now(),
          };
      if (own(body, "damageGroup")) {
        invalid(["HUMAN", "PROPERTY"].includes(body.damageGroup), "Nhóm thiệt hại không hợp lệ.");
        row.damage_group = body.damageGroup;
      }
      if (own(body, "damageType"))
        row.damage_type = trim(body.damageType, "Loại thiệt hại", 100, 1);
      for (const [key, col, max] of [
        ["quantity", "quantity", 1000000000],
        ["propertyValue", "property_value", 9000000000000000],
      ])
        if (own(body, key)) {
          invalid(
            Number.isSafeInteger(body[key]) && body[key] >= 0 && body[key] <= max,
            `${key} phải là số nguyên không âm trong giới hạn.`,
          );
          row[col] = body[key];
        }
      invalid(
        row.damage_group !== "HUMAN" || row.property_value === 0,
        "Thiệt hại người không ghi giá trị tài sản.",
      );
      for (const key of ["description", "notes"])
        if (own(body, key)) row[key] = trim(body[key], key);
      row.updated_by = user.id;
      row.updated_at = now();
      if (before)
        db.prepare(
          "UPDATE incident_damages SET damage_group=?,damage_type=?,quantity=?,property_value=?,description=?,notes=?,updated_by=?,updated_at=? WHERE id=?",
        ).run(
          row.damage_group,
          row.damage_type,
          row.quantity,
          row.property_value,
          row.description,
          row.notes,
          row.updated_by,
          row.updated_at,
          row.id,
        );
      else
        db.prepare(
          "INSERT INTO incident_damages(id,incident_id,damage_group,damage_type,quantity,property_value,description,notes,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
          row.id,
          id,
          row.damage_group,
          row.damage_type,
          row.quantity,
          row.property_value,
          row.description,
          row.notes,
          row.updated_by,
          row.created_at,
          row.updated_at,
        );
      incidentAudit(
        db,
        user,
        before ? "M09.damage.update" : "M09.damage.create",
        id,
        before ? { damage: before } : null,
        { damage: row },
        body,
        ip,
      );
      return row;
    });
    send(method === "POST" ? 201 : 200, { damage: damageDto(result) });
    return true;
  }
  const assignmentMatch = suffix.match(/^assignments(?:\/([^/]+))?$/);
  if (
    assignmentMatch &&
    ((method === "POST" && !assignmentMatch[1]) || (method === "PATCH" && assignmentMatch[1]))
  ) {
    const required = method === "POST" ? ["M09.approve"] : ["M09.approve", "M09.edit"];
    allowedAny(user, required);
    const payload = await readBody();
    const result = mutation(payload, required, (input) => {
      const incident = findIncident(db, user, id);
      invalid(
        !terminal(incident) && incident.record_status === "OFFICIAL",
        "Chỉ phân công hồ sơ chính thức còn xử lý.",
      );
      const before = assignmentMatch[1]
        ? db
            .prepare("SELECT * FROM incident_assignments WHERE incident_id=? AND id=?")
            .get(id, assignmentMatch[1])
        : null;
      if (assignmentMatch[1])
        assert(before, 404, "NOT_FOUND", "Không tìm thấy phân công trong hồ sơ.");
      const manage = user.permissions.includes("M09.approve");
      if (!manage)
        assert(
          before && before.officer_id === user.officerId,
          403,
          "FORBIDDEN",
          "Chỉ cán bộ được giao nhiệm vụ được cập nhật tiến độ của mình.",
        );
      const body = object(
        input,
        manage
          ? ["officerId", "taskDescription", "deadlineAt", "status", "notes", "reason"]
          : ["status", "notes", "reason"],
      );
      const row = before
        ? { ...before }
        : {
            id: randomUUID(),
            incident_id: id,
            officer_id: null,
            assigned_by: user.id,
            task_description: "",
            deadline_at: null,
            status: "ASSIGNED",
            notes: "",
            assigned_at: now(),
            completed_at: null,
          };
      if (own(body, "officerId")) row.officer_id = nullableId(body.officerId, "Cán bộ");
      if (own(body, "taskDescription"))
        row.task_description = trim(body.taskDescription, "Nhiệm vụ", 2000, 1);
      if (own(body, "deadlineAt"))
        row.deadline_at = incidentTimestamp(body.deadlineAt, "Hạn nhiệm vụ");
      if (own(body, "status")) {
        invalid(assignmentStatuses.includes(body.status), "Trạng thái nhiệm vụ không hợp lệ.");
        row.status = body.status;
      }
      if (!manage && own(body, "status")) {
        const progressTransitions = {
          ASSIGNED: ["IN_PROGRESS", "COMPLETED"],
          IN_PROGRESS: ["COMPLETED"],
          COMPLETED: [],
          CANCELLED: [],
        };
        invalid(
          progressTransitions[before.status].includes(row.status),
          "Chuyển tiến độ nhiệm vụ không hợp lệ.",
        );
      }
      if (own(body, "notes")) row.notes = trim(body.notes, "Ghi chú");
      invalid(row.officer_id && row.task_description, "Phải chọn cán bộ và nhập nhiệm vụ.");
      const scope = officerScope(user);
      const officer = db
        .prepare(
          `SELECT o.* FROM officers o JOIN units ou ON ou.id=o.unit_id WHERE ${scope.sql} AND o.id=? AND o.status='ACTIVE' AND ou.status='ACTIVE'`,
        )
        .get(...scope.params, row.officer_id);
      assert(
        officer,
        404,
        "NOT_FOUND",
        "Cán bộ không tồn tại, không còn công tác hoặc ngoài phạm vi được cấp.",
      );
      if (row.deadline_at != null && incident.occurred_at != null)
        invalid(
          row.deadline_at >= incident.occurred_at,
          "Hạn nhiệm vụ không được trước thời điểm xảy ra.",
        );
      if (
        before &&
        before.deadline_at != null &&
        (row.deadline_at == null || row.deadline_at > before.deadline_at)
      )
        invalid(
          body.reason && trim(body.reason, "Lý do", 2000, 1),
          "Gia hạn nhiệm vụ phải có lý do.",
        );
      if (before && ["COMPLETED", "CANCELLED"].includes(before.status))
        invalid(
          before.status === row.status && before.officer_id === row.officer_id,
          "Nhiệm vụ đã kết thúc không thể mở lại hoặc đổi cán bộ.",
        );
      const duplicate = db
        .prepare(
          "SELECT 1 FROM incident_assignments WHERE incident_id=? AND officer_id=? AND task_description=? AND status NOT IN ('COMPLETED','CANCELLED') AND id<>?",
        )
        .get(id, row.officer_id, row.task_description, row.id);
      assert(
        !duplicate || ["COMPLETED", "CANCELLED"].includes(row.status),
        409,
        "DUPLICATE_ASSIGNMENT",
        "Cán bộ đã được giao nhiệm vụ này trong hồ sơ.",
      );
      row.completed_at = row.status === "COMPLETED" ? before?.completed_at || now() : null;
      row.updated_at = now();
      if (before && manage) row.assigned_by = user.id;
      if (before)
        db.prepare(
          "UPDATE incident_assignments SET officer_id=?,assigned_by=?,task_description=?,deadline_at=?,status=?,notes=?,completed_at=?,updated_at=? WHERE id=?",
        ).run(
          row.officer_id,
          row.assigned_by,
          row.task_description,
          row.deadline_at,
          row.status,
          row.notes,
          row.completed_at,
          row.updated_at,
          row.id,
        );
      else
        db.prepare(
          "INSERT INTO incident_assignments(id,incident_id,officer_id,assigned_by,task_description,deadline_at,status,notes,assigned_at,completed_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
          row.id,
          id,
          row.officer_id,
          row.assigned_by,
          row.task_description,
          row.deadline_at,
          row.status,
          row.notes,
          row.assigned_at,
          row.completed_at,
          row.updated_at,
        );
      incidentAudit(
        db,
        user,
        before ? "M09.assignment.update" : "M09.assignment.create",
        id,
        before ? { assignment: before } : null,
        { assignment: row },
        body,
        ip,
      );
      return row;
    });
    send(method === "POST" ? 201 : 200, { assignment: assignmentDto(db, user, result) });
    return true;
  }
  if (
    ((suffix === "deadline" || suffix === "status") && method === "PATCH") ||
    (suffix === "complete" && method === "POST")
  ) {
    allowedAny(user, suffix === "complete" ? ["M09.approve"] : ["M09.edit", "M09.approve"]);
    const payload = await readBody();
    const result = mutation(
      payload,
      suffix === "complete" ? ["M09.approve"] : ["M09.edit", "M09.approve"],
      (input) => {
        const body = object(
          input,
          suffix === "deadline"
            ? ["deadlineAt", "reason", "notes", "version"]
            : ["processingStatus", "reason", "notes", "version"],
        );
        const previous = findIncident(db, user, id),
          row = { ...previous },
          current = now();
        versionCheck(body, previous);
        const reason = body.reason ? trim(body.reason, "Lý do", 2000) : "",
          notes = body.notes ? trim(body.notes, "Ghi chú", 2000) : "";
        if (suffix === "deadline") {
          invalid(!terminal(row), "Hồ sơ đã kết thúc không thể đổi hạn xử lý.");
          invalid(own(body, "deadlineAt"), "Chưa cung cấp hạn xử lý.");
          row.deadline_at = incidentTimestamp(body.deadlineAt, "Hạn xử lý");
          if (
            previous.deadline_at != null &&
            (row.deadline_at == null || row.deadline_at > previous.deadline_at)
          )
            invalid(reason, "Gia hạn hoặc bỏ hạn phải nhập lý do.");
          if (row.deadline_at != null && row.occurred_at != null)
            invalid(
              row.deadline_at >= row.occurred_at,
              "Hạn xử lý không được trước thời điểm xảy ra.",
            );
        } else {
          const next = suffix === "complete" ? "COMPLETED" : body.processingStatus;
          invalid(statuses.includes(next), "Trạng thái xử lý không hợp lệ.");
          if (["COMPLETED", "CLOSED"].includes(next)) requirePermission(user, "M09.approve");
          const transitions = {
            NEW: ["IN_PROGRESS", "COMPLETED"],
            IN_PROGRESS: ["COMPLETED"],
            COMPLETED: ["CLOSED"],
            CLOSED: [],
          };
          invalid(
            transitions[row.processing_status].includes(next),
            "Chuyển trạng thái xử lý không hợp lệ.",
          );
          invalid(
            row.record_status === "OFFICIAL",
            "Hồ sơ nháp phải được lưu chính thức trước khi xử lý.",
          );
          if (next === "COMPLETED") {
            const p = policyFor(db);
            if (p.require_document_completion) {
              const docs = db
                .prepare("SELECT * FROM incident_documents WHERE incident_id=?")
                .all(id);
              const root = storageRoot(uploadDirectory);
              const evidenceExists = docs.some((d) => {
                try {
                  return (
                    /^[a-f0-9-]+\.(txt|pdf|png|jpg|jpeg)$/.test(d.storage_key) &&
                    lstatSync(join(root, d.storage_key)).isFile() &&
                    !lstatSync(join(root, d.storage_key)).isSymbolicLink()
                  );
                } catch {
                  return false;
                }
              });
              invalid(
                evidenceExists,
                "Cấu hình hiện tại yêu cầu tài liệu minh chứng trước khi hoàn thành.",
              );
            }
            row.completed_at = current;
          }
          row.processing_status = next;
        }
        row.updated_by = user.id;
        row.updated_at = current;
        row.version++;
        db.prepare(
          "UPDATE incidents SET deadline_at=?,processing_status=?,completed_at=?,updated_by=?,updated_at=?,version=? WHERE id=?",
        ).run(
          row.deadline_at,
          row.processing_status,
          row.completed_at,
          user.id,
          current,
          row.version,
          id,
        );
        history(db, user, previous, row, reason, notes, current);
        incidentAudit(
          db,
          user,
          suffix === "deadline"
            ? "M09.deadline.update"
            : row.processing_status === "COMPLETED"
              ? "M09.incident.complete"
              : "M09.status.update",
          id,
          previous,
          row,
          body,
          ip,
        );
        return row;
      },
    );
    send(200, { incident: dto(result) });
    return true;
  }
  if (suffix === "documents" && method === "POST") {
    requirePermission(user, "M09.edit");
    findIncident(db, user, id);
    assert(
      process.env.NODE_ENV !== "production",
      503,
      "UPLOAD_POLICY_UNAPPROVED",
      "Tải tệp production chưa được kích hoạt: cần phê duyệt Q12 và cơ chế quét malware.",
    );
    const upload = await readUpload(request, policy.max_upload_bytes);
    let createdPath = null;
    try {
      const doc = mutation({}, ["M09.edit"], () => {
        findIncident(db, user, id);
        const currentPolicy = policyFor(db);
        assert(
          upload.bytes.length <= currentPolicy.max_upload_bytes,
          413,
          "FILE_TOO_LARGE",
          "Tệp vượt dung lượng hiện được cấu hình.",
        );
        const detected = detectFile(upload.name, upload.bytes, currentPolicy),
          docId = randomUUID(),
          key = `${docId}.${detected.extension}`;
        const root = storageRoot(uploadDirectory);
        const filePath = join(root, key);
        const descriptor = openSync(filePath, "wx", 0o600);
        createdPath = filePath;
        try {
          writeFileSync(descriptor, upload.bytes);
          fsyncSync(descriptor);
        } finally {
          closeSync(descriptor);
        }
        const row = {
          id: docId,
          incident_id: id,
          original_name: upload.name,
          stored_name: key,
          file_type: detected.extension,
          mime_type: detected.mimeType,
          size_bytes: upload.bytes.length,
          storage_key: key,
          uploaded_by: user.id,
          uploaded_at: now(),
        };
        db.prepare(
          "INSERT INTO incident_documents(id,incident_id,original_name,stored_name,file_type,mime_type,size_bytes,storage_key,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        ).run(
          ...[
            "id",
            "incident_id",
            "original_name",
            "stored_name",
            "file_type",
            "mime_type",
            "size_bytes",
            "storage_key",
            "uploaded_by",
            "uploaded_at",
          ].map((k) => row[k]),
        );
        incidentAudit(
          db,
          user,
          "M09.document.upload",
          id,
          null,
          { document: documentDto(row) },
          {},
          ip,
        );
        return row;
      });
      send(201, { document: documentDto(doc) });
      return true;
    } catch (error) {
      if (createdPath) unlinkSync(createdPath);
      throw error;
    }
  }
  throw new ApiError(404, "NOT_FOUND", "API sự cố không tồn tại.");
}
