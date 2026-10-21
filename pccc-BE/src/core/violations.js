import { randomUUID } from "node:crypto";
import { assert } from "./errors.js";
import { audit } from "../modules/audit/audit.service.js";
import {
  facilityScope,
  requirePermission,
} from "../modules/authorization/authorization.service.js";
import { transaction } from "./database.js";

const severities = ["Nhẹ", "Trung bình", "Nghiêm trọng"];
const conditions = ["violation", "unlicensed", "insufficient"];
export const evidenceMaxBytes = Number(process.env.VIOLATION_EVIDENCE_MAX_BYTES || 5 * 1024 * 1024);
assert(
  Number.isInteger(evidenceMaxBytes) &&
    evidenceMaxBytes >= 1024 &&
    evidenceMaxBytes <= 20 * 1024 * 1024,
  500,
  "CONFIGURATION",
  "VIOLATION_EVIDENCE_MAX_BYTES phải từ 1 KB đến 20 MB.",
);
export const evidenceBodyMaxBytes = Math.ceil((evidenceMaxBytes * 4) / 3) + 20_000;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const todayTime = (date) =>
  datePattern.test(date) &&
  !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) &&
  new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;

function requiredText(value, label, min = 1, max = 2000) {
  assert(typeof value === "string", 400, "INVALID_INPUT", `${label} không hợp lệ.`);
  const result = value.trim();
  assert(
    result.length >= min && result.length <= max,
    400,
    "INVALID_INPUT",
    `${label} phải có từ ${min} đến ${max} ký tự.`,
  );
  return result;
}

function parseViolation(payload, creating) {
  assert(
    payload && typeof payload === "object" && !Array.isArray(payload),
    400,
    "INVALID_INPUT",
    "Dữ liệu phải là đối tượng JSON.",
  );
  const allowed = [
    "facilityId",
    "type",
    "severity",
    "detectedOn",
    "description",
    "facilityCondition",
    "remediationDeadline",
    "trackedOfficerId",
  ];
  assert(
    Object.keys(payload).every((key) => allowed.includes(key)),
    400,
    "INVALID_INPUT",
    "Dữ liệu có trường không hợp lệ.",
  );
  const value = {};
  if (creating || Object.hasOwn(payload, "facilityId"))
    value.facilityId = requiredText(payload.facilityId, "Cơ sở", 1, 128);
  if (creating || Object.hasOwn(payload, "type"))
    value.type = requiredText(payload.type, "Loại vi phạm", 1, 128);
  if (creating || Object.hasOwn(payload, "severity")) {
    assert(
      severities.includes(payload.severity),
      400,
      "INVALID_INPUT",
      "Mức độ vi phạm không hợp lệ.",
    );
    value.severity = payload.severity;
  }
  if (creating || Object.hasOwn(payload, "detectedOn")) {
    assert(todayTime(payload.detectedOn), 400, "INVALID_INPUT", "Ngày phát hiện không hợp lệ.");
    value.detectedOn = payload.detectedOn;
  }
  if (creating || Object.hasOwn(payload, "description"))
    value.description = requiredText(payload.description, "Nội dung vi phạm", 10, 2000);
  if (creating || Object.hasOwn(payload, "facilityCondition")) {
    const condition = payload.facilityCondition ?? "violation";
    assert(conditions.includes(condition), 400, "INVALID_INPUT", "Tình trạng cơ sở không hợp lệ.");
    value.facilityCondition = condition;
  }
  if (creating || Object.hasOwn(payload, "remediationDeadline")) {
    const deadline = payload.remediationDeadline || null;
    assert(
      deadline === null || todayTime(deadline),
      400,
      "INVALID_INPUT",
      "Hạn khắc phục không hợp lệ.",
    );
    if (deadline && value.detectedOn)
      assert(
        deadline >= value.detectedOn,
        400,
        "INVALID_INPUT",
        "Hạn khắc phục phải sau ngày phát hiện.",
      );
    value.remediationDeadline = deadline;
  }
  if (creating || Object.hasOwn(payload, "trackedOfficerId"))
    value.trackedOfficerId = requiredText(payload.trackedOfficerId, "Cán bộ theo dõi", 1, 128);
  return value;
}

function inScope(db, principal, facilityId) {
  const scope = facilityScope(principal);
  const facility = db
    .prepare(`SELECT f.* FROM facilities f WHERE ${scope.sql} AND f.id=?`)
    .get(...scope.params, facilityId);
  assert(facility, 404, "NOT_FOUND", "Không tìm thấy cơ sở trong phạm vi được cấp.");
  return facility;
}

function violationRow(db, principal, id) {
  const scope = facilityScope(principal);
  const row = db
    .prepare(
      `SELECT v.*, f.name AS facility_name, f.address AS facility_address,
    (SELECT id FROM suspensions s WHERE s.violation_id=v.id) AS suspension_id,
    (SELECT decision_number FROM suspensions s WHERE s.violation_id=v.id) AS decision_number,
    (SELECT count(*) FROM violation_evidences e WHERE e.violation_id=v.id) AS evidence_count,
    (SELECT progress FROM remediation_records r WHERE r.violation_id=v.id ORDER BY created_at DESC LIMIT 1) AS progress
    FROM violations v JOIN facilities f ON f.id=v.facility_id WHERE ${scope.sql} AND v.id=?`,
    )
    .get(...scope.params, id);
  assert(row, 404, "NOT_FOUND", "Không tìm thấy hồ sơ vi phạm trong phạm vi được cấp.");
  return row;
}

function history(db, id, fromStatus, toStatus, reason, actor, now) {
  db.prepare(
    "INSERT INTO violation_status_history(violation_id,from_status,to_status,reason,actor_id,occurred_at) VALUES (?,?,?,?,?,?)",
  ).run(id, fromStatus, toStatus, reason, actor.id, now);
}

function publicViolation(row) {
  return {
    id: row.id,
    facilityId: row.facility_id,
    facilityName: row.facility_name,
    facilityAddress: row.facility_address,
    type: row.violation_type,
    severity: row.severity,
    detectedOn: row.detected_on,
    description: row.description,
    facilityCondition: row.facility_condition,
    remediationDeadline: row.remediation_deadline,
    trackedOfficerId: row.tracked_officer_id,
    status: row.status,
    suspended: Boolean(row.suspension_id),
    decisionNumber: row.decision_number ?? null,
    progress: row.progress ?? 0,
    evidenceCount: row.evidence_count,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listViolations(db, principal, url) {
  requirePermission(principal, "M04.view");
  const scope = facilityScope(principal);
  const pageRaw = url.searchParams.get("page") ?? "1";
  const sizeRaw = url.searchParams.get("pageSize") ?? "20";
  assert(
    /^[1-9]\d{0,5}$/.test(pageRaw) && Number(pageRaw) <= 100000,
    400,
    "INVALID_INPUT",
    "page không hợp lệ.",
  );
  assert(
    /^[1-9]\d{0,2}$/.test(sizeRaw) && Number(sizeRaw) <= 100,
    400,
    "INVALID_INPUT",
    "pageSize không hợp lệ.",
  );
  const page = Number(pageRaw),
    pageSize = Number(sizeRaw);
  const clauses = [scope.sql],
    params = [...scope.params];
  const filters = [
    ["facilityId", "v.facility_id", 128],
    ["type", "v.violation_type", 128],
    ["status", "v.status", 32],
  ];
  for (const [key, column, max] of filters) {
    const value = url.searchParams.get(key);
    if (value) {
      assert(value.length <= max, 400, "INVALID_INPUT", `${key} không hợp lệ.`);
      clauses.push(`${column}=?`);
      params.push(value);
    }
  }
  const search = url.searchParams.get("search") ?? "";
  assert(search.length <= 100, 400, "INVALID_INPUT", "Từ khóa tìm kiếm quá dài.");
  if (search) {
    clauses.push(
      "(instr(lower(v.id),lower(?))>0 OR instr(lower(f.name),lower(?))>0 OR instr(lower(f.address),lower(?))>0 OR instr(lower(v.violation_type),lower(?))>0 OR instr(lower(coalesce((SELECT decision_number FROM suspensions sx WHERE sx.violation_id=v.id),'')),lower(?))>0)",
    );
    params.push(search, search, search, search, search);
  }
  const where = clauses.join(" AND ");
  const rows = db
    .prepare(
      `SELECT v.*,f.name AS facility_name,f.address AS facility_address,
    (SELECT id FROM suspensions s WHERE s.violation_id=v.id) AS suspension_id,
    (SELECT decision_number FROM suspensions s WHERE s.violation_id=v.id) AS decision_number,
    (SELECT count(*) FROM violation_evidences e WHERE e.violation_id=v.id) AS evidence_count,
    (SELECT progress FROM remediation_records r WHERE r.violation_id=v.id ORDER BY created_at DESC LIMIT 1) AS progress
    FROM violations v JOIN facilities f ON f.id=v.facility_id WHERE ${where}
    ORDER BY v.detected_on DESC,v.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize);
  const total = db
    .prepare(
      `SELECT count(*) AS total FROM violations v JOIN facilities f ON f.id=v.facility_id WHERE ${where}`,
    )
    .get(...params).total;
  const stats = db
    .prepare(
      `SELECT count(*) AS total,
    sum(CASE WHEN EXISTS(SELECT 1 FROM suspensions s WHERE s.violation_id=v.id) AND v.status<>'completed' THEN 1 ELSE 0 END) AS suspended,
    sum(CASE WHEN v.remediation_deadline IS NOT NULL AND v.remediation_deadline<date('now') AND v.status<>'completed' THEN 1 ELSE 0 END) AS overdue,
    sum(CASE WHEN v.status='pending_approval' THEN 1 ELSE 0 END) AS pending
    FROM violations v JOIN facilities f ON f.id=v.facility_id WHERE ${scope.sql}`,
    )
    .get(...scope.params);
  stats.suspended ??= 0;
  stats.overdue ??= 0;
  stats.pending ??= 0;
  return { items: rows.map(publicViolation), total, stats, page, pageSize };
}

export function listViolationFacilities(db, principal, url) {
  requirePermission(principal, "M04.view");
  const scope = facilityScope(principal);
  const pageRaw = url.searchParams.get("page") ?? "1";
  const sizeRaw = url.searchParams.get("pageSize") ?? "100";
  assert(
    /^[1-9]\d{0,5}$/.test(pageRaw) && Number(pageRaw) <= 100000,
    400,
    "INVALID_INPUT",
    "page không hợp lệ.",
  );
  assert(
    /^[1-9]\d{0,2}$/.test(sizeRaw) && Number(sizeRaw) <= 100,
    400,
    "INVALID_INPUT",
    "pageSize không hợp lệ.",
  );
  const search = url.searchParams.get("search") ?? "";
  assert(search.length <= 100, 400, "INVALID_INPUT", "Từ khóa tìm kiếm quá dài.");
  const where = `${scope.sql} AND (instr(lower(f.name),lower(?))>0 OR instr(lower(f.address),lower(?))>0)`;
  const params = [...scope.params, search, search];
  const page = Number(pageRaw),
    pageSize = Number(sizeRaw);
  return {
    items: db
      .prepare(
        `SELECT f.id,f.name,f.address,f.officer_id FROM facilities f WHERE ${where} ORDER BY f.name LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize),
    total: db.prepare(`SELECT count(*) AS total FROM facilities f WHERE ${where}`).get(...params)
      .total,
    page,
    pageSize,
  };
}

export function createViolation(db, principal, payload, ip) {
  requirePermission(principal, "M04.create");
  const value = parseViolation(payload, true);
  inScope(db, principal, value.facilityId);
  const now = Date.now(),
    id = `VP-${randomUUID()}`;
  transaction(db, () => {
    db.prepare(
      `INSERT INTO violations(id,facility_id,violation_type,severity,detected_on,description,facility_condition,remediation_deadline,tracked_officer_id,status,created_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,'recorded',?,?,?)`,
    ).run(
      id,
      value.facilityId,
      value.type,
      value.severity,
      value.detectedOn,
      value.description,
      value.facilityCondition,
      value.remediationDeadline,
      value.trackedOfficerId,
      principal.id,
      now,
      now,
    );
    history(db, id, null, "recorded", "Ghi nhận vi phạm", principal, now);
    audit(db, principal.id, "violation.created", id, null, value, ip);
  });
  return publicViolation(violationRow(db, principal, id));
}

export function updateViolation(db, principal, id, payload, ip) {
  requirePermission(principal, "M04.edit");
  const row = violationRow(db, principal, id);
  assert(
    ["recorded", "remediation", "returned"].includes(row.status),
    409,
    "INVALID_STATE",
    "Hồ sơ không còn cho phép chỉnh sửa thông tin vi phạm.",
  );
  const value = parseViolation(payload, false);
  if (value.facilityId) inScope(db, principal, value.facilityId);
  assert(
    !value.facilityId ||
      value.facilityId === row.facility_id ||
      !db.prepare("SELECT 1 FROM suspensions WHERE violation_id=?").get(id),
    409,
    "SUSPENSION_LOCKS_FACILITY",
    "Không thể chuyển cơ sở sau khi đã lập hồ sơ đình chỉ.",
  );
  const next = {
    facilityId: value.facilityId ?? row.facility_id,
    type: value.type ?? row.violation_type,
    severity: value.severity ?? row.severity,
    detectedOn: value.detectedOn ?? row.detected_on,
    description: value.description ?? row.description,
    facilityCondition: value.facilityCondition ?? row.facility_condition,
    remediationDeadline: Object.hasOwn(value, "remediationDeadline")
      ? value.remediationDeadline
      : row.remediation_deadline,
    trackedOfficerId: value.trackedOfficerId ?? row.tracked_officer_id,
  };
  assert(
    !next.remediationDeadline || next.remediationDeadline >= next.detectedOn,
    400,
    "INVALID_INPUT",
    "Hạn khắc phục phải sau ngày phát hiện.",
  );
  transaction(db, () => {
    db.prepare(
      `UPDATE violations SET facility_id=?,violation_type=?,severity=?,detected_on=?,description=?,facility_condition=?,remediation_deadline=?,tracked_officer_id=?,updated_at=? WHERE id=?`,
    ).run(
      next.facilityId,
      next.type,
      next.severity,
      next.detectedOn,
      next.description,
      next.facilityCondition,
      next.remediationDeadline,
      next.trackedOfficerId,
      Date.now(),
      id,
    );
    audit(
      db,
      principal.id,
      "violation.updated",
      id,
      {
        facilityId: row.facility_id,
        type: row.violation_type,
        severity: row.severity,
        detectedOn: row.detected_on,
        description: row.description,
        facilityCondition: row.facility_condition,
        remediationDeadline: row.remediation_deadline,
        trackedOfficerId: row.tracked_officer_id,
      },
      next,
      ip,
    );
  });
  return publicViolation(violationRow(db, principal, id));
}

export function violationDetail(db, principal, id) {
  requirePermission(principal, "M04.view");
  const row = violationRow(db, principal, id);
  const suspension =
    db
      .prepare(
        "SELECT id,decision_number,reason,issued_on,effective_until,created_by,created_at FROM suspensions WHERE violation_id=?",
      )
      .get(id) ?? null;
  const remediation = db
    .prepare(
      "SELECT id,note,progress,created_by,created_at FROM remediation_records WHERE violation_id=? ORDER BY created_at,id",
    )
    .all(id);
  const evidences = db
    .prepare(
      "SELECT id,file_name,media_type,file_size,uploaded_by,uploaded_at FROM violation_evidences WHERE violation_id=? ORDER BY uploaded_at",
    )
    .all(id);
  const statusHistory = db
    .prepare(
      `SELECT h.from_status,h.to_status,h.reason,h.occurred_at,a.full_name AS actor_name FROM violation_status_history h JOIN accounts a ON a.id=h.actor_id WHERE h.violation_id=? ORDER BY h.occurred_at,h.id`,
    )
    .all(id);
  return {
    violation: publicViolation(row),
    suspension,
    remediation,
    evidences: evidences.map((e) => ({
      ...e,
      downloadUrl: `/api/violations/${encodeURIComponent(id)}/evidences/${encodeURIComponent(e.id)}`,
    })),
    history: statusHistory,
  };
}

export function createSuspension(db, principal, id, payload, ip) {
  requirePermission(principal, "M04.edit");
  const row = violationRow(db, principal, id);
  assert(row.status !== "completed", 409, "INVALID_STATE", "Hồ sơ đã hoàn thành.");
  assert(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      Object.keys(payload).every((k) =>
        ["decisionNumber", "reason", "issuedOn", "effectiveUntil"].includes(k),
      ),
    400,
    "INVALID_INPUT",
    "Dữ liệu đình chỉ không hợp lệ.",
  );
  const number = requiredText(payload.decisionNumber, "Số quyết định", 1, 100);
  const reason = requiredText(payload.reason, "Lý do đình chỉ", 10, 2000);
  assert(todayTime(payload.issuedOn), 400, "INVALID_INPUT", "Ngày quyết định không hợp lệ.");
  const until = payload.effectiveUntil || null;
  assert(
    until === null || todayTime(until),
    400,
    "INVALID_INPUT",
    "Ngày hết hiệu lực không hợp lệ.",
  );
  assert(
    !until || until >= payload.issuedOn,
    400,
    "INVALID_INPUT",
    "Ngày hết hiệu lực phải sau ngày quyết định.",
  );
  assert(
    !db.prepare("SELECT 1 FROM suspensions WHERE violation_id=?").get(id),
    409,
    "DUPLICATE_SUSPENSION",
    "Hồ sơ đã có quyết định đình chỉ.",
  );
  const now = Date.now(),
    suspensionId = randomUUID();
  transaction(db, () => {
    const earliest = db
      .prepare(
        `SELECT s.previous_facility_status
      FROM suspensions s JOIN violations v ON v.id=s.violation_id
      WHERE v.facility_id=? ORDER BY s.created_at,s.id LIMIT 1`,
      )
      .get(row.facility_id);
    const facility = db.prepare("SELECT status FROM facilities WHERE id=?").get(row.facility_id);
    const previousStatus = earliest?.previous_facility_status ?? facility.status;
    db.prepare(
      "INSERT INTO suspensions(id,violation_id,decision_number,reason,issued_on,effective_until,previous_facility_status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ).run(
      suspensionId,
      id,
      number,
      reason,
      payload.issuedOn,
      until,
      previousStatus === "suspended" ? "active" : previousStatus,
      principal.id,
      now,
      now,
    );
    db.prepare("UPDATE facilities SET status='suspended' WHERE id=?").run(row.facility_id);
    audit(
      db,
      principal.id,
      "violation.suspension_created",
      id,
      null,
      { decisionNumber: number, reason, issuedOn: payload.issuedOn, effectiveUntil: until },
      ip,
    );
  });
  return {
    id: suspensionId,
    decisionNumber: number,
    reason,
    issuedOn: payload.issuedOn,
    effectiveUntil: until,
  };
}

export function updateSuspension(db, principal, id, payload, ip) {
  requirePermission(principal, "M04.edit");
  violationRow(db, principal, id);
  assert(
    payload &&
      typeof payload === "object" &&
      Object.keys(payload).every((k) =>
        ["decisionNumber", "reason", "issuedOn", "effectiveUntil"].includes(k),
      ),
    400,
    "INVALID_INPUT",
    "Dữ liệu đình chỉ không hợp lệ.",
  );
  const current = db.prepare("SELECT * FROM suspensions WHERE violation_id=?").get(id);
  assert(current, 404, "NOT_FOUND", "Không tìm thấy hồ sơ đình chỉ.");
  const next = {
    decisionNumber: Object.hasOwn(payload, "decisionNumber")
      ? requiredText(payload.decisionNumber, "Số quyết định", 1, 100)
      : current.decision_number,
    reason: Object.hasOwn(payload, "reason")
      ? requiredText(payload.reason, "Lý do đình chỉ", 10, 2000)
      : current.reason,
    issuedOn: Object.hasOwn(payload, "issuedOn") ? payload.issuedOn : current.issued_on,
    effectiveUntil: Object.hasOwn(payload, "effectiveUntil")
      ? payload.effectiveUntil || null
      : current.effective_until,
  };
  assert(
    todayTime(next.issuedOn) && (!next.effectiveUntil || todayTime(next.effectiveUntil)),
    400,
    "INVALID_INPUT",
    "Ngày đình chỉ không hợp lệ.",
  );
  assert(
    !next.effectiveUntil || next.effectiveUntil >= next.issuedOn,
    400,
    "INVALID_INPUT",
    "Ngày hết hiệu lực phải sau ngày quyết định.",
  );
  transaction(db, () => {
    db.prepare(
      "UPDATE suspensions SET decision_number=?,reason=?,issued_on=?,effective_until=?,updated_at=? WHERE id=?",
    ).run(
      next.decisionNumber,
      next.reason,
      next.issuedOn,
      next.effectiveUntil,
      Date.now(),
      current.id,
    );
    audit(db, principal.id, "violation.suspension_updated", id, current, next, ip);
  });
  return next;
}

export function addRemediation(db, principal, id, payload, ip) {
  requirePermission(principal, "M04.edit");
  const row = violationRow(db, principal, id);
  assert(
    ["recorded", "remediation", "returned"].includes(row.status),
    409,
    "INVALID_STATE",
    "Không thể cập nhật khắc phục ở trạng thái hiện tại.",
  );
  assert(
    payload &&
      typeof payload === "object" &&
      Object.keys(payload).every((k) => ["note", "progress"].includes(k)),
    400,
    "INVALID_INPUT",
    "Dữ liệu khắc phục không hợp lệ.",
  );
  const note = requiredText(payload.note, "Nội dung khắc phục", 3, 2000);
  assert(
    Number.isInteger(payload.progress) && payload.progress >= 0 && payload.progress <= 100,
    400,
    "INVALID_INPUT",
    "Tiến độ phải là số nguyên từ 0 đến 100.",
  );
  const now = Date.now(),
    recordId = randomUUID();
  transaction(db, () => {
    db.prepare(
      "INSERT INTO remediation_records(id,violation_id,note,progress,created_by,created_at) VALUES (?,?,?,?,?,?)",
    ).run(recordId, id, note, payload.progress, principal.id, now);
    if (row.status !== "remediation") {
      db.prepare("UPDATE violations SET status='remediation',updated_at=? WHERE id=?").run(now, id);
      history(db, id, row.status, "remediation", "Cập nhật hồ sơ khắc phục", principal, now);
    }
    audit(
      db,
      principal.id,
      "violation.remediation_added",
      id,
      null,
      { note, progress: payload.progress },
      ip,
    );
  });
  return {
    id: recordId,
    note,
    progress: payload.progress,
    createdBy: principal.id,
    createdAt: now,
  };
}

export function addEvidence(db, principal, id, payload, ip) {
  requirePermission(principal, "M04.edit");
  const row = violationRow(db, principal, id);
  assert(
    row.status !== "completed",
    409,
    "INVALID_STATE",
    "Hồ sơ đã hoàn thành, không thể thêm bằng chứng.",
  );
  assert(
    payload &&
      typeof payload === "object" &&
      Object.keys(payload).every((k) => ["fileName", "mediaType", "contentBase64"].includes(k)),
    400,
    "INVALID_INPUT",
    "Thông tin tệp không hợp lệ.",
  );
  const fileName = requiredText(payload.fileName, "Tên tệp", 1, 180).replace(/[\\/\0]/g, "_");
  const mediaType = payload.mediaType;
  assert(
    ["application/pdf", "image/jpeg", "image/png"].includes(mediaType),
    400,
    "INVALID_FILE_TYPE",
    "Chỉ nhận PDF, JPEG hoặc PNG (chính sách tải lên mẫu). ",
  );
  const extension = fileName.toLowerCase().split(".").pop();
  assert(
    (mediaType === "application/pdf" && extension === "pdf") ||
      (mediaType === "image/jpeg" && ["jpg", "jpeg"].includes(extension)) ||
      (mediaType === "image/png" && extension === "png"),
    400,
    "INVALID_FILE_TYPE",
    "Phần mở rộng tệp không khớp định dạng.",
  );
  assert(
    typeof payload.contentBase64 === "string" &&
      payload.contentBase64.length <= evidenceBodyMaxBytes &&
      /^[A-Za-z0-9+/]*={0,2}$/.test(payload.contentBase64),
    413,
    "FILE_TOO_LARGE",
    "Tệp rỗng, không hợp lệ hoặc vượt giới hạn tải lên.",
  );
  const content = Buffer.from(payload.contentBase64, "base64");
  assert(
    content.length > 0 && content.length <= evidenceMaxBytes,
    413,
    "FILE_TOO_LARGE",
    `Tệp phải có dung lượng từ 1 byte đến ${Math.floor(evidenceMaxBytes / 1024 / 1024)} MB.`,
  );
  const signatures = {
    "application/pdf": content.subarray(0, 5).toString() === "%PDF-",
    "image/jpeg": content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff,
    "image/png": content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  };
  assert(
    signatures[mediaType],
    400,
    "INVALID_FILE_CONTENT",
    "Nội dung tệp không khớp định dạng đã chọn.",
  );
  const evidenceId = randomUUID(),
    now = Date.now();
  transaction(db, () => {
    db.prepare(
      "INSERT INTO violation_evidences(id,violation_id,file_name,media_type,file_size,content,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?)",
    ).run(evidenceId, id, fileName, mediaType, content.length, content, principal.id, now);
    audit(
      db,
      principal.id,
      "violation.evidence_added",
      id,
      null,
      { evidenceId, fileName, mediaType, size: content.length },
      ip,
    );
  });
  return {
    id: evidenceId,
    fileName,
    mediaType,
    fileSize: content.length,
    uploadedBy: principal.id,
    uploadedAt: now,
  };
}

export function readEvidence(db, principal, id, evidenceId) {
  requirePermission(principal, "M04.view");
  violationRow(db, principal, id);
  const evidence = db
    .prepare(
      "SELECT file_name,media_type,file_size,content FROM violation_evidences WHERE id=? AND violation_id=?",
    )
    .get(evidenceId, id);
  assert(evidence, 404, "NOT_FOUND", "Không tìm thấy tệp bằng chứng.");
  return evidence;
}

export function submitApproval(db, principal, id, ip) {
  requirePermission(principal, "M04.edit");
  const row = violationRow(db, principal, id);
  assert(
    ["remediation", "returned"].includes(row.status),
    409,
    "INVALID_STATE",
    "Chỉ hồ sơ đang khắc phục hoặc được trả lại mới được gửi duyệt.",
  );
  assert(
    db.prepare("SELECT 1 FROM remediation_records WHERE violation_id=?").get(id),
    409,
    "MISSING_REMEDIATION",
    "Cần ghi nhận nội dung khắc phục trước khi gửi duyệt.",
  );
  assert(
    db.prepare("SELECT 1 FROM violation_evidences WHERE violation_id=?").get(id),
    409,
    "MISSING_EVIDENCE",
    "Cần có ít nhất một bằng chứng khắc phục trước khi gửi duyệt.",
  );
  const now = Date.now();
  transaction(db, () => {
    db.prepare("UPDATE violations SET status='pending_approval',updated_at=? WHERE id=?").run(
      now,
      id,
    );
    history(db, id, row.status, "pending_approval", "Gửi yêu cầu phê duyệt", principal, now);
    audit(
      db,
      principal.id,
      "violation.approval_submitted",
      id,
      { status: row.status },
      { status: "pending_approval" },
      ip,
    );
  });
  return publicViolation(violationRow(db, principal, id));
}

export function decideApproval(db, principal, id, payload, approved, ip) {
  requirePermission(principal, "M04.approve");
  const row = violationRow(db, principal, id);
  assert(
    row.status === "pending_approval",
    409,
    "INVALID_STATE",
    "Hồ sơ chưa ở trạng thái chờ duyệt.",
  );
  if (approved) {
    assert(
      db.prepare("SELECT 1 FROM remediation_records WHERE violation_id=?").get(id),
      409,
      "MISSING_REMEDIATION",
      "Hồ sơ chưa có nội dung khắc phục.",
    );
    assert(
      db.prepare("SELECT 1 FROM violation_evidences WHERE violation_id=?").get(id),
      409,
      "MISSING_EVIDENCE",
      "Hồ sơ chưa có bằng chứng khắc phục.",
    );
  }
  assert(
    payload && typeof payload === "object" && Object.keys(payload).every((k) => k === "reason"),
    400,
    "INVALID_INPUT",
    "Dữ liệu phê duyệt không hợp lệ.",
  );
  const reason = approved
    ? payload.reason
      ? requiredText(payload.reason, "Ý kiến duyệt", 1, 1000)
      : null
    : requiredText(payload.reason, "Lý do từ chối", 5, 1000);
  const to = approved ? "completed" : "returned",
    now = Date.now();
  transaction(db, () => {
    db.prepare("UPDATE violations SET status=?,updated_at=? WHERE id=?").run(to, now, id);
    const suspension = approved
      ? db.prepare("SELECT previous_facility_status FROM suspensions WHERE violation_id=?").get(id)
      : null;
    const otherOpenSuspension =
      approved &&
      db
        .prepare(
          `SELECT 1 FROM suspensions s
      JOIN violations v ON v.id=s.violation_id
      WHERE v.facility_id=? AND v.id<>? AND v.status<>'completed' LIMIT 1`,
        )
        .get(row.facility_id, id);
    if (suspension && !otherOpenSuspension)
      db.prepare("UPDATE facilities SET status=? WHERE id=? AND status='suspended'").run(
        suspension.previous_facility_status === "suspended"
          ? "active"
          : suspension.previous_facility_status,
        row.facility_id,
      );
    history(db, id, row.status, to, reason, principal, now);
    audit(
      db,
      principal.id,
      approved ? "violation.approved" : "violation.rejected",
      id,
      { status: row.status },
      { status: to, reason },
      ip,
    );
  });
  return publicViolation(violationRow(db, principal, id));
}
