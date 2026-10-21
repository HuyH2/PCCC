import { randomUUID } from "node:crypto";
import { assert } from "../../core/errors.js";
import { object, pagination } from "../../core/validation.js";
import { foldSearchText, transaction } from "../../core/database.js";
import { facilityScope } from "../authorization/authorization.service.js";
import {
  requireInspectionAccess,
  trimmed,
  date,
  expectVersion,
  expectStatus,
  nextCode,
  activeChecklist,
  writeInspectionAudit,
} from "./inspections.helpers.js";
import { scopedInspection, inspectionDetail } from "./inspections.queries.js";
import {
  INSPECTION_KINDS,
  INSPECTION_STATUSES,
  RESULT_STATUSES,
  OUTCOMES,
  STATUS_SQL,
  inspectionColumns,
  inspectionJoins,
} from "./inspections.constants.js";

// M06 — SCRUM-22: checklist, record/evidence, results, conclusion, follow-up (UC-INS-06..09).
// Every lookup joins facilities on alias f and applies the caller's facility scope in SQL.

// Re-export identifiers that routes and external callers still need directly.
export { requireInspectionAccess, scopedInspection, inspectionDetail };

// ---------------------------------------------------------------------------
// UC-INS-06 — list inspections
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// UC-INS-09 — create an unscheduled or thematic inspection
// (periodic inspections come from the plan via inspection-planning module)
// ---------------------------------------------------------------------------

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
    writeInspectionAudit(db, user, ip, id, "inspection.created", null, after);
    return after;
  });
}

// ---------------------------------------------------------------------------
// UC-INS-07/08 — save checklist results and optionally lock them
// ---------------------------------------------------------------------------

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
    writeInspectionAudit(
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

// ---------------------------------------------------------------------------
// UC-INS-08 — overall outcome and conclusion
// ---------------------------------------------------------------------------

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
    writeInspectionAudit(db, user, ip, id, "inspection.conclusion_updated", before, after);
    return after;
  });
}

// ---------------------------------------------------------------------------
// Completion — requires locked checklist, conclusion, and an uploaded record (BR-02)
// ---------------------------------------------------------------------------

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
    writeInspectionAudit(db, user, ip, id, "inspection.completed", before, after);
    return after;
  });
}
