import { randomUUID } from "node:crypto";
import { assert } from "../../core/errors.js";
import { object, pagination, text } from "../../core/validation.js";
import { foldSearchText, transaction } from "../../core/database.js";
import { facilityScope, requirePermission } from "../authorization/authorization.service.js";
import { writeAudit } from "../audit/audit.service.js";

// M06 — SCRUM-22: checklist, record/evidence, results, conclusion, follow-up (UC-INS-06..09).
// Every lookup joins facilities on alias f and applies the caller's facility scope in SQL.

export const MAX_INSPECTION_FILE_BYTES = Number(
  process.env.INSPECTION_DOCUMENT_MAX_BYTES ?? 5 * 1024 * 1024,
);
if (
  !Number.isInteger(MAX_INSPECTION_FILE_BYTES) ||
  MAX_INSPECTION_FILE_BYTES < 1024 ||
  MAX_INSPECTION_FILE_BYTES > 10 * 1024 * 1024
)
  throw new Error("INSPECTION_DOCUMENT_MAX_BYTES must be an integer between 1024 and 10485760.");
export const INSPECTION_FILE_SIZE_MESSAGE = `File tối đa ${(
  MAX_INSPECTION_FILE_BYTES /
  (1024 * 1024)
).toFixed(1)} MB.`;

export const INSPECTION_KINDS = ["periodic", "unscheduled", "thematic"];
export const INSPECTION_STATUSES = ["planned", "in_progress", "evaluated", "completed"];
// 'evaluated' (Đã đánh giá) = checklist results locked; derived, see migration 007.
const STATUS_SQL = `CASE WHEN i.status='in_progress' AND i.results_submitted_at IS NOT NULL
  THEN 'evaluated' ELSE i.status END`;
const RESULT_STATUSES = ["pending", "pass", "fail", "not_applicable"];
const OUTCOMES = ["pass", "conditional", "fail"];
const FILE_TYPES = {
  "application/pdf": {
    extension: /\.pdf$/i,
    valid: (data) => data.subarray(0, 5).toString() === "%PDF-",
  },
  "image/jpeg": {
    extension: /\.jpe?g$/i,
    valid: (data) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
  },
  "image/png": {
    extension: /\.png$/i,
    valid: (data) =>
      data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
};

const inspectionColumns = `i.id,i.code,i.facility_id,f.name AS facility_name,f.address AS facility_address,
  r.name AS region_name,i.kind,i.topic,i.reason,i.scheduled_date,i.lead_officer_id,
  o.full_name AS lead_officer_name,${STATUS_SQL} AS status,i.checklist_id,c.name AS checklist_name,i.officer_note,
  i.results_submitted_at,rs.full_name AS results_submitted_by_name,
  i.outcome,i.conclusion,i.completed_at,i.completed_by,i.version,i.created_by,i.updated_by,
  i.created_at,i.updated_at`;
const inspectionJoins = `inspections i JOIN facilities f ON f.id=i.facility_id
  JOIN regions r ON r.id=f.region_id
  LEFT JOIN officer_directory o ON o.officer_id=i.lead_officer_id
  LEFT JOIN inspection_checklists c ON c.id=i.checklist_id
  LEFT JOIN accounts rs ON rs.id=i.results_submitted_by`;

export function requireInspectionAccess(user, action = "view") {
  requirePermission(user, "M06.view");
  if (action !== "view") requirePermission(user, `M06.${action}`);
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

function trimmed(value, label, min, max) {
  return text(typeof value === "string" ? value.trim() : value, label, min, max);
}

function expectVersion(inspection, version) {
  assert(
    Number.isInteger(version) && inspection.version === version,
    409,
    "VERSION_CONFLICT",
    "Cuộc kiểm tra đã được thay đổi. Hãy tải lại trước khi lưu.",
  );
}

function expectStatus(inspection, statuses, message) {
  assert(statuses.includes(inspection.status), 409, "INVALID_STATE", message);
}

/** Inspection row visible to the caller, or 404 (never reveals out-of-scope records). */
export function scopedInspection(db, user, id) {
  requireInspectionAccess(user);
  const scope = facilityScope(user);
  const row = db
    .prepare(`SELECT ${inspectionColumns} FROM ${inspectionJoins} WHERE ${scope.sql} AND i.id=?`)
    .get(...scope.params, id);
  assert(row, 404, "NOT_FOUND", "Không tìm thấy cuộc kiểm tra trong phạm vi được cấp.");
  return row;
}

export function listInspections(db, user, url) {
  requireInspectionAccess(user);
  const { page, pageSize } = pagination(url);
  const scope = facilityScope(user);
  const q = foldSearchText(trimmed(url.searchParams.get("q") ?? "", "Từ khóa", 0, 200));
  const clauses = [scope.sql, "(instr(fold(i.code),?)>0 OR instr(fold(f.name),?)>0)"];
  const params = [...scope.params, q, q];
  for (const [key, column, allowed] of [
    ["status", STATUS_SQL, INSPECTION_STATUSES],
    ["kind", "i.kind", INSPECTION_KINDS],
  ]) {
    const value = url.searchParams.get(key);
    if (!value) continue;
    assert(allowed.includes(value), 400, "INVALID_INPUT", `${key} không hợp lệ.`);
    clauses.push(`${column}=?`);
    params.push(value);
  }
  const where = clauses.join(" AND ");
  return {
    items: db
      .prepare(
        `SELECT ${inspectionColumns} FROM ${inspectionJoins} WHERE ${where}
        ORDER BY i.scheduled_date DESC,i.code DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize),
    total: db.prepare(`SELECT count(*) AS n FROM ${inspectionJoins} WHERE ${where}`).get(...params)
      .n,
    page,
    pageSize,
  };
}

function checklistItems(db, checklistId) {
  return db
    .prepare(
      `SELECT id,position,content,guidance,legal_reference,is_required
      FROM inspection_checklist_items WHERE checklist_id=? ORDER BY position`,
    )
    .all(checklistId);
}

/** UC-INS-06 — active checklists; facilityType keeps general checklists plus that type. */
export function listChecklists(db, user, url) {
  requireInspectionAccess(user);
  const facilityType = url.searchParams.get("facilityType");
  const params = [];
  let filter = "";
  if (facilityType) {
    trimmed(facilityType, "Loại cơ sở", 1, 100);
    filter = "AND (c.facility_type IS NULL OR c.facility_type=?)";
    params.push(facilityType.trim());
  }
  return {
    items: db
      .prepare(
        `SELECT c.id,c.name,c.facility_type,c.description,c.legal_document_id,
          d.title AS legal_document_title,
          (SELECT count(*) FROM inspection_checklist_items it WHERE it.checklist_id=c.id) AS item_count
        FROM inspection_checklists c LEFT JOIN legal_documents d ON d.id=c.legal_document_id
        WHERE c.is_active=1 ${filter} ORDER BY c.facility_type IS NOT NULL,c.name`,
      )
      .all(...params),
  };
}

export function checklistDetail(db, user, id) {
  requireInspectionAccess(user);
  const checklist = db
    .prepare(
      `SELECT c.id,c.name,c.facility_type,c.description,c.legal_document_id,c.is_active,
        d.title AS legal_document_title
      FROM inspection_checklists c LEFT JOIN legal_documents d ON d.id=c.legal_document_id
      WHERE c.id=?`,
    )
    .get(id);
  assert(checklist, 404, "NOT_FOUND", "Không tìm thấy checklist kiểm tra.");
  return { checklist, items: checklistItems(db, id) };
}

// Same pattern as requireAdministrator: a configurable permission plus the roles allowed to use it.
export const CHECKLIST_AUTHOR_ROLES = ["A01", "A02"];

export function requireChecklistAuthor(user) {
  requireInspectionAccess(user, "create");
  assert(
    CHECKLIST_AUTHOR_ROLES.includes(user.role),
    403,
    "FORBIDDEN",
    "Chỉ Chỉ huy hoặc Phó chỉ huy được tạo checklist kiểm tra.",
  );
}

/** UC-INS-06 — create a checklist with its ordered items (positions follow the array order). */
export function createChecklist(db, user, payload, ip) {
  requireChecklistAuthor(user);
  object(payload, ["name", "facility_type", "description", "legal_document_id", "items"]);
  const name = trimmed(payload.name, "Tên checklist", 1, 200);
  const facilityType =
    payload.facility_type == null || payload.facility_type === ""
      ? null
      : trimmed(payload.facility_type, "Loại cơ sở", 1, 100);
  const description = trimmed(payload.description ?? "", "Mô tả", 0, 2000);
  const legalDocumentId =
    payload.legal_document_id == null || payload.legal_document_id === ""
      ? null
      : trimmed(payload.legal_document_id, "Tài liệu hướng dẫn", 1, 100);
  assert(
    Array.isArray(payload.items) && payload.items.length >= 1 && payload.items.length <= 100,
    400,
    "INVALID_INPUT",
    "Checklist phải có từ 1 đến 100 nội dung kiểm tra.",
  );
  const items = payload.items.map((item) => {
    object(item, ["content", "guidance", "legal_reference", "is_required"]);
    assert(
      item.is_required == null || typeof item.is_required === "boolean",
      400,
      "INVALID_INPUT",
      "Trường bắt buộc phải là true/false.",
    );
    return {
      content: trimmed(item.content, "Nội dung kiểm tra", 1, 500),
      guidance: trimmed(item.guidance ?? "", "Hướng dẫn", 0, 2000),
      legalReference: trimmed(item.legal_reference ?? "", "Căn cứ", 0, 500),
      required: item.is_required === false ? 0 : 1,
    };
  });
  if (legalDocumentId)
    assert(
      db.prepare("SELECT 1 FROM legal_documents WHERE id=?").get(legalDocumentId),
      400,
      "INVALID_INPUT",
      "Tài liệu hướng dẫn không tồn tại trong kho văn bản.",
    );
  return transaction(db, () => {
    // SQLite lower() is ASCII-only, so compare Vietnamese names case-insensitively here.
    const key = name.toLocaleLowerCase("vi");
    assert(
      !db
        .prepare(
          `SELECT name FROM inspection_checklists WHERE is_active=1
          AND coalesce(facility_type,'')=coalesce(?,'')`,
        )
        .all(facilityType)
        .some((row) => row.name.toLocaleLowerCase("vi") === key),
      409,
      "DUPLICATE_CHECKLIST",
      "Đã có checklist cùng tên cho loại cơ sở này.",
    );
    const id = randomUUID();
    db.prepare(
      `INSERT INTO inspection_checklists(id,name,facility_type,description,legal_document_id,created_by,created_at)
      VALUES (?,?,?,?,?,?,?)`,
    ).run(id, name, facilityType, description, legalDocumentId, user.id, Date.now());
    const insertItem = db.prepare(
      `INSERT INTO inspection_checklist_items(id,checklist_id,position,content,guidance,legal_reference,is_required)
      VALUES (?,?,?,?,?,?,?)`,
    );
    items.forEach((item, index) =>
      insertItem.run(
        randomUUID(),
        id,
        index + 1,
        item.content,
        item.guidance,
        item.legalReference,
        item.required,
      ),
    );
    const after = checklistDetail(db, user, id);
    writeAudit(db, {
      actorId: user.id,
      feature: "M06",
      objectType: "inspection_checklist",
      objectId: id,
      action: "inspection_checklist.created",
      after,
      ip,
    });
    return after;
  });
}

export function inspectionDetail(db, user, id) {
  const inspection = scopedInspection(db, user, id);
  const items = inspection.checklist_id
    ? db
        .prepare(
          `SELECT it.id,it.position,it.content,it.guidance,it.legal_reference,it.is_required,
            coalesce(res.status,'pending') AS status,coalesce(res.note,'') AS note,res.updated_at
          FROM inspection_checklist_items it
          LEFT JOIN inspection_results res ON res.item_id=it.id AND res.inspection_id=?
          WHERE it.checklist_id=? ORDER BY it.position`,
        )
        .all(id, inspection.checklist_id)
    : [];
  const documents = db
    .prepare(
      `SELECT d.id,d.kind,d.follow_up_id,d.record_number,d.description,d.file_name,d.content_type,
        d.file_size,d.uploaded_by,a.full_name AS uploaded_by_name,d.uploaded_at
      FROM inspection_documents d LEFT JOIN accounts a ON a.id=d.uploaded_by
      WHERE d.inspection_id=? ORDER BY d.uploaded_at,d.id`,
    )
    .all(id);
  const followUps = db
    .prepare(
      `SELECT fu.id,fu.requirement,fu.due_date,fu.status,fu.outcome,fu.result_note,fu.created_by,
        fu.created_at,fu.completed_by,a.full_name AS completed_by_name,fu.completed_at
      FROM follow_up_inspections fu LEFT JOIN accounts a ON a.id=fu.completed_by
      WHERE fu.inspection_id=? ORDER BY fu.created_at,fu.id`,
    )
    .all(id);
  return { inspection, items, documents, followUps };
}

function audit(db, user, ip, id, action, before, after) {
  writeAudit(db, {
    actorId: user.id,
    feature: "M06",
    objectType: "inspection",
    objectId: id,
    action,
    before,
    after,
    ip,
  });
}

function nextCode(db, now) {
  const year = new Date(now).getFullYear();
  const prefix = `KT-${year}-`;
  const last = db
    .prepare("SELECT code FROM inspections WHERE code LIKE ? ORDER BY code DESC LIMIT 1")
    .get(`${prefix}%`);
  const sequence = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

function activeChecklist(db, id) {
  trimmed(id, "Checklist", 1, 100);
  assert(
    db.prepare("SELECT 1 FROM inspection_checklists WHERE id=? AND is_active=1").get(id),
    400,
    "INVALID_INPUT",
    "Checklist không tồn tại hoặc đã ngưng sử dụng.",
  );
  return id;
}

/** UC-INS-09 — unscheduled/thematic inspections; periodic ones come from the plan (UC-INS-03). */
export function createInspection(db, user, payload, ip) {
  requireInspectionAccess(user, "create");
  object(payload, [
    "facility_id",
    "kind",
    "topic",
    "reason",
    "scheduled_date",
    "lead_officer_id",
    "checklist_id",
  ]);
  assert(
    ["unscheduled", "thematic"].includes(payload.kind),
    400,
    "INVALID_INPUT",
    "Loại kiểm tra phải là đột xuất hoặc chuyên đề.",
  );
  const facilityId = trimmed(payload.facility_id, "Cơ sở", 1, 100);
  const topic = payload.kind === "thematic" ? trimmed(payload.topic, "Chuyên đề", 1, 200) : null;
  assert(
    payload.kind === "thematic" || payload.topic == null || payload.topic === "",
    400,
    "INVALID_INPUT",
    "Chỉ kiểm tra chuyên đề mới có chuyên đề.",
  );
  const reason = trimmed(payload.reason, "Lý do / căn cứ kiểm tra", 1, 2000);
  const scheduledDate = date(payload.scheduled_date, "Ngày kiểm tra");
  const leadOfficerId =
    payload.lead_officer_id == null || payload.lead_officer_id === ""
      ? user.officerId
      : trimmed(payload.lead_officer_id, "Trưởng đoàn", 1, 100);
  assert(
    db.prepare("SELECT 1 FROM officer_directory WHERE officer_id=?").get(leadOfficerId),
    400,
    "INVALID_INPUT",
    "Cán bộ trưởng đoàn không tồn tại.",
  );
  const checklistId =
    payload.checklist_id == null || payload.checklist_id === ""
      ? null
      : activeChecklist(db, payload.checklist_id);
  const scope = facilityScope(user);
  assert(
    db
      .prepare(`SELECT 1 FROM facilities f WHERE ${scope.sql} AND f.id=?`)
      .get(...scope.params, facilityId),
    404,
    "NOT_FOUND",
    "Không tìm thấy cơ sở trong phạm vi được cấp.",
  );
  return transaction(db, () => {
    const now = Date.now();
    const id = randomUUID();
    db.prepare(
      `INSERT INTO inspections(id,code,facility_id,kind,topic,reason,scheduled_date,lead_officer_id,
        checklist_id,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      nextCode(db, now),
      facilityId,
      payload.kind,
      topic,
      reason,
      scheduledDate,
      leadOfficerId,
      checklistId,
      user.id,
      user.id,
      now,
      now,
    );
    const after = scopedInspection(db, user, id);
    audit(db, user, ip, id, "inspection.created", null, after);
    return after;
  });
}

/** UC-INS-07/08 — choose checklist, tick each item, save the officer's notes. */
export function saveResults(db, user, id, payload, ip) {
  requireInspectionAccess(user, "edit");
  object(payload, ["version", "checklist_id", "officer_note", "items", "submit"]);
  assert(
    payload.submit == null || typeof payload.submit === "boolean",
    400,
    "INVALID_INPUT",
    "Trường chốt kết quả phải là true/false.",
  );
  const officerNote =
    payload.officer_note == null ? null : trimmed(payload.officer_note, "Ghi chú", 0, 4000);
  const items = payload.items ?? [];
  assert(
    Array.isArray(items) && items.length <= 500,
    400,
    "INVALID_INPUT",
    "Danh sách kết quả không hợp lệ.",
  );
  for (const item of items) {
    object(item, ["item_id", "status", "note"]);
    trimmed(item.item_id, "Nội dung kiểm tra", 1, 100);
    assert(
      RESULT_STATUSES.includes(item.status),
      400,
      "INVALID_INPUT",
      "Trạng thái nội dung kiểm tra không hợp lệ.",
    );
    trimmed(item.note ?? "", "Ghi chú nội dung", 0, 1000);
  }
  assert(
    new Set(items.map((item) => item.item_id)).size === items.length,
    400,
    "INVALID_INPUT",
    "Nội dung kiểm tra bị lặp.",
  );
  return transaction(db, () => {
    const before = inspectionDetail(db, user, id);
    const inspection = before.inspection;
    expectVersion(inspection, payload.version);
    expectStatus(
      inspection,
      ["planned", "in_progress"],
      "Kết quả checklist đã được chốt, không thể sửa.",
    );
    let checklistId = inspection.checklist_id;
    if (payload.checklist_id != null && payload.checklist_id !== checklistId) {
      const hasResults = db
        .prepare("SELECT 1 FROM inspection_results WHERE inspection_id=?")
        .get(id);
      assert(
        !hasResults,
        409,
        "INVALID_STATE",
        "Đã có kết quả theo checklist hiện tại, không thể đổi checklist.",
      );
      checklistId = activeChecklist(db, payload.checklist_id);
    }
    assert(checklistId, 400, "INVALID_INPUT", "Vui lòng chọn checklist kiểm tra.");
    const belongs = db.prepare(
      "SELECT 1 FROM inspection_checklist_items WHERE id=? AND checklist_id=?",
    );
    const upsert = db.prepare(
      `INSERT INTO inspection_results(inspection_id,item_id,status,note,updated_by,updated_at)
      VALUES (?,?,?,?,?,?) ON CONFLICT(inspection_id,item_id)
      DO UPDATE SET status=excluded.status,note=excluded.note,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
    );
    const now = Date.now();
    for (const item of items) {
      assert(
        belongs.get(item.item_id, checklistId),
        400,
        "INVALID_INPUT",
        "Nội dung kiểm tra không thuộc checklist đã chọn.",
      );
      upsert.run(id, item.item_id, item.status, (item.note ?? "").trim(), user.id, now);
    }
    if (payload.submit) {
      // Lock only when every required item of the chosen checklist has been evaluated.
      const missing = db
        .prepare(
          `SELECT count(*) AS n FROM inspection_checklist_items it
          LEFT JOIN inspection_results res ON res.item_id=it.id AND res.inspection_id=?
          WHERE it.checklist_id=? AND it.is_required=1 AND coalesce(res.status,'pending')='pending'`,
        )
        .get(id, checklistId).n;
      assert(
        missing === 0,
        409,
        "INCOMPLETE_CHECKLIST",
        `Còn ${missing} nội dung bắt buộc chưa được đánh giá, chưa thể chốt kết quả.`,
      );
    }
    db.prepare(
      `UPDATE inspections SET checklist_id=?,officer_note=coalesce(?,officer_note),status='in_progress',
        results_submitted_at=?,results_submitted_by=?,version=version+1,updated_by=?,updated_at=?
      WHERE id=?`,
    ).run(
      checklistId,
      officerNote,
      payload.submit ? now : null,
      payload.submit ? user.id : null,
      user.id,
      now,
      id,
    );
    const after = inspectionDetail(db, user, id);
    audit(
      db,
      user,
      ip,
      id,
      payload.submit ? "inspection.results_submitted" : "inspection.results_saved",
      {
        ...inspection,
        items: before.items.map(({ id: itemId, status, note }) => ({ itemId, status, note })),
      },
      {
        ...after.inspection,
        items: after.items.map(({ id: itemId, status, note }) => ({ itemId, status, note })),
      },
    );
    return after;
  });
}

export function validateInspectionFile(name, contentType, data) {
  text(name, "Tên file", 1, 180);
  const type = FILE_TYPES[contentType];
  assert(type, 415, "UNSUPPORTED_MEDIA_TYPE", "Chỉ nhận file PDF, JPEG hoặc PNG.");
  assert(
    !/[\\/\x00-\x1f\x7f]/.test(name) && type.extension.test(name),
    400,
    "INVALID_FILE",
    "Tên file không hợp lệ hoặc không khớp định dạng.",
  );
  assert(
    data.length > 0 && data.length <= MAX_INSPECTION_FILE_BYTES,
    413,
    "FILE_TOO_LARGE",
    INSPECTION_FILE_SIZE_MESSAGE,
  );
  assert(type.valid(data), 400, "INVALID_FILE", "Nội dung file không khớp định dạng.");
}

/**
 * UC-INS-07 — record (biên bản) or evidence. While in progress any kind is accepted; after
 * completion only evidence for the open follow-up (hậu kiểm) may be added.
 */
export function uploadDocument(db, user, id, upload, ip) {
  requireInspectionAccess(user, "edit");
  const { kind, fileName, contentType, data } = upload;
  assert(
    ["record", "evidence"].includes(kind),
    400,
    "INVALID_INPUT",
    "Loại tài liệu không hợp lệ.",
  );
  const recordNumber =
    kind === "record" ? trimmed(upload.recordNumber, "Số biên bản", 1, 100) : null;
  const description = trimmed(upload.description ?? "", "Mô tả", 0, 500);
  validateInspectionFile(fileName, contentType, data);
  return transaction(db, () => {
    const inspection = scopedInspection(db, user, id);
    let followUpId = null;
    if (inspection.status === "completed") {
      assert(
        kind === "evidence",
        409,
        "INVALID_STATE",
        "Cuộc kiểm tra đã hoàn thành, không thể thay biên bản.",
      );
      followUpId = db
        .prepare("SELECT id FROM follow_up_inspections WHERE inspection_id=? AND status='open'")
        .get(id)?.id;
      assert(
        followUpId,
        409,
        "INVALID_STATE",
        "Chỉ bổ sung bằng chứng khi có yêu cầu hậu kiểm đang mở.",
      );
    } else
      expectStatus(
        inspection,
        ["in_progress", "evaluated"],
        "Hãy bắt đầu thực hiện checklist trước khi tải biên bản/tài liệu.",
      );
    const documentId = randomUUID();
    const now = Date.now();
    db.prepare(
      `INSERT INTO inspection_documents(id,inspection_id,follow_up_id,kind,record_number,description,
        file_name,content_type,file_size,file_data,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      documentId,
      id,
      followUpId,
      kind,
      recordNumber,
      description,
      fileName,
      contentType,
      data.length,
      data,
      user.id,
      now,
    );
    const document = {
      id: documentId,
      kind,
      follow_up_id: followUpId,
      record_number: recordNumber,
      description,
      file_name: fileName,
      content_type: contentType,
      file_size: data.length,
      uploaded_by: user.id,
      uploaded_at: now,
    };
    audit(db, user, ip, id, "inspection.document_uploaded", null, document);
    return document;
  });
}

export function documentFile(db, user, id, documentId) {
  scopedInspection(db, user, id);
  const file = db
    .prepare(
      "SELECT file_name,content_type,file_data FROM inspection_documents WHERE id=? AND inspection_id=?",
    )
    .get(documentId, id);
  assert(file, 404, "NOT_FOUND", "Không tìm thấy tài liệu.");
  return file;
}

/** UC-INS-08 — overall outcome and conclusion of the inspection. */
export function saveConclusion(db, user, id, payload, ip) {
  requireInspectionAccess(user, "edit");
  object(payload, ["version", "outcome", "conclusion"]);
  assert(
    OUTCOMES.includes(payload.outcome),
    400,
    "INVALID_INPUT",
    "Kết quả kiểm tra không hợp lệ.",
  );
  const conclusion = trimmed(payload.conclusion, "Kết luận", 1, 4000);
  return transaction(db, () => {
    const before = scopedInspection(db, user, id);
    expectVersion(before, payload.version);
    expectStatus(
      before,
      ["in_progress", "evaluated"],
      "Chỉ cập nhật kết luận khi cuộc kiểm tra đang thực hiện.",
    );
    db.prepare(
      "UPDATE inspections SET outcome=?,conclusion=?,version=version+1,updated_by=?,updated_at=? WHERE id=?",
    ).run(payload.outcome, conclusion, user.id, Date.now(), id);
    const after = scopedInspection(db, user, id);
    audit(db, user, ip, id, "inspection.conclusion_updated", before, after);
    return after;
  });
}

/** Completion requires locked checklist results, a conclusion and an uploaded record (BR-02). */
export function completeInspection(db, user, id, payload, ip) {
  requireInspectionAccess(user, "edit");
  object(payload, ["version"]);
  return transaction(db, () => {
    const { inspection: before, items } = inspectionDetail(db, user, id);
    expectVersion(before, payload.version);
    expectStatus(
      before,
      ["in_progress", "evaluated"],
      "Chỉ hoàn thành cuộc kiểm tra đang thực hiện.",
    );
    const missing = items.filter((item) => item.is_required && item.status === "pending").length;
    assert(
      before.checklist_id && items.length > 0 && missing === 0,
      409,
      "INCOMPLETE_CHECKLIST",
      `Còn ${missing} nội dung bắt buộc chưa được đánh giá.`,
    );
    assert(
      before.status === "evaluated",
      409,
      "RESULTS_NOT_SUBMITTED",
      "Vui lòng chốt kết quả checklist trước khi hoàn thành.",
    );
    assert(
      before.outcome && before.conclusion,
      409,
      "MISSING_CONCLUSION",
      "Vui lòng cập nhật kết quả và kết luận trước khi hoàn thành.",
    );
    assert(
      db
        .prepare("SELECT 1 FROM inspection_documents WHERE inspection_id=? AND kind='record'")
        .get(id),
      409,
      "MISSING_RECORD",
      "Vui lòng tải lên biên bản kiểm tra trước khi hoàn thành.",
    );
    const now = Date.now();
    db.prepare(
      `UPDATE inspections SET status='completed',completed_at=?,completed_by=?,version=version+1,
        updated_by=?,updated_at=? WHERE id=?`,
    ).run(now, user.id, user.id, now, id);
    const after = scopedInspection(db, user, id);
    audit(db, user, ip, id, "inspection.completed", before, after);
    return after;
  });
}

/** UC-INS-08 — request a follow-up inspection (hậu kiểm); one open request at a time. */
export function createFollowUp(db, user, id, payload, ip) {
  requireInspectionAccess(user, "edit");
  object(payload, ["requirement", "due_date"]);
  const requirement = trimmed(payload.requirement, "Nội dung yêu cầu khắc phục", 1, 2000);
  const dueDate = date(payload.due_date, "Hạn hậu kiểm");
  return transaction(db, () => {
    const inspection = scopedInspection(db, user, id);
    expectStatus(
      inspection,
      ["completed"],
      "Chỉ tạo yêu cầu hậu kiểm sau khi cuộc kiểm tra hoàn thành.",
    );
    assert(
      dueDate >= inspection.scheduled_date,
      400,
      "INVALID_INPUT",
      "Hạn hậu kiểm không được trước ngày kiểm tra.",
    );
    assert(
      !db
        .prepare("SELECT 1 FROM follow_up_inspections WHERE inspection_id=? AND status='open'")
        .get(id),
      409,
      "DUPLICATE_FOLLOW_UP",
      "Đã có yêu cầu hậu kiểm đang mở cho cuộc kiểm tra này.",
    );
    const followUp = {
      id: randomUUID(),
      inspection_id: id,
      requirement,
      due_date: dueDate,
      status: "open",
      created_by: user.id,
      created_at: Date.now(),
    };
    db.prepare(
      `INSERT INTO follow_up_inspections(id,inspection_id,requirement,due_date,created_by,created_at)
      VALUES (?,?,?,?,?,?)`,
    ).run(followUp.id, id, requirement, dueDate, user.id, followUp.created_at);
    audit(db, user, ip, id, "inspection.follow_up_created", null, followUp);
    return followUp;
  });
}

export function completeFollowUp(db, user, id, followUpId, payload, ip) {
  requireInspectionAccess(user, "edit");
  object(payload, ["outcome", "result_note"]);
  assert(
    ["resolved", "unresolved"].includes(payload.outcome),
    400,
    "INVALID_INPUT",
    "Kết quả hậu kiểm không hợp lệ.",
  );
  const resultNote = trimmed(payload.result_note, "Kết quả hậu kiểm", 1, 2000);
  return transaction(db, () => {
    scopedInspection(db, user, id);
    const select = db.prepare("SELECT * FROM follow_up_inspections WHERE id=? AND inspection_id=?");
    const before = select.get(followUpId, id);
    assert(before, 404, "NOT_FOUND", "Không tìm thấy yêu cầu hậu kiểm.");
    assert(
      before.status === "open",
      409,
      "INVALID_STATE",
      "Yêu cầu hậu kiểm đã được cập nhật kết quả.",
    );
    db.prepare(
      `UPDATE follow_up_inspections SET status='completed',outcome=?,result_note=?,completed_by=?,
        completed_at=? WHERE id=?`,
    ).run(payload.outcome, resultNote, user.id, Date.now(), followUpId);
    const after = select.get(followUpId, id);
    audit(db, user, ip, id, "inspection.follow_up_completed", before, after);
    return after;
  });
}
