import { randomUUID } from "node:crypto";
import { assert } from "../../core/errors.js";
import { object } from "../../core/validation.js";
import { transaction } from "../../core/database.js";
import {
  requireInspectionAccess,
  date,
  trimmed,
  writeInspectionAudit,
} from "./inspections.helpers.js";
import { scopedInspection } from "./inspections.queries.js";

// ---------------------------------------------------------------------------
// UC-INS-08 — create a follow-up inspection request (hậu kiểm)
// One open request at a time per inspection.
// ---------------------------------------------------------------------------

export async function createFollowUp(db, user, id, payload, ip) {
  requireInspectionAccess(user, "edit");
  object(payload, ["requirement", "due_date"]);
  const requirement = trimmed(payload.requirement, "Nội dung yêu cầu khắc phục", 1, 2000);
  const dueDate = date(payload.due_date, "Hạn hậu kiểm");
  return await transaction(db, async () => {
    const inspection = await scopedInspection(db, user, id);
    assert(
      inspection.status === "completed",
      409,
      "INVALID_STATE",
      "Chỉ tạo yêu cầu hậu kiểm sau khi cuộc kiểm tra hoàn thành.",
    );
    assert(
      dueDate >= inspection.scheduled_date,
      400,
      "INVALID_INPUT",
      "Hạn hậu kiểm không được trước ngày kiểm tra.",
    );
    assert(
      !(await db
        .prepare("SELECT 1 FROM follow_up_inspections WHERE inspection_id=? AND status='open'")
        .get(id)),
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
    await db
      .prepare(
        `INSERT INTO follow_up_inspections(id,inspection_id,requirement,due_date,created_by,created_at)
      VALUES (?,?,?,?,?,?)`,
      )
      .run(followUp.id, id, requirement, dueDate, user.id, followUp.created_at);
    await writeInspectionAudit(db, user, ip, id, "inspection.follow_up_created", null, followUp);
    return followUp;
  });
}

// ---------------------------------------------------------------------------
// UC-INS-08 — record the outcome of a follow-up inspection
// ---------------------------------------------------------------------------

export async function completeFollowUp(db, user, id, followUpId, payload, ip) {
  requireInspectionAccess(user, "edit");
  object(payload, ["outcome", "result_note"]);
  assert(
    ["resolved", "unresolved"].includes(payload.outcome),
    400,
    "INVALID_INPUT",
    "Kết quả hậu kiểm không hợp lệ.",
  );
  const resultNote = trimmed(payload.result_note, "Kết quả hậu kiểm", 1, 2000);
  return await transaction(db, async () => {
    await scopedInspection(db, user, id);
    const select = db.prepare("SELECT * FROM follow_up_inspections WHERE id=? AND inspection_id=?");
    const before = await select.get(followUpId, id);
    assert(before, 404, "NOT_FOUND", "Không tìm thấy yêu cầu hậu kiểm.");
    assert(
      before.status === "open",
      409,
      "INVALID_STATE",
      "Yêu cầu hậu kiểm đã được cập nhật kết quả.",
    );
    await db
      .prepare(
        `UPDATE follow_up_inspections SET status='completed',outcome=?,result_note=?,completed_by=?,
        completed_at=? WHERE id=?`,
      )
      .run(payload.outcome, resultNote, user.id, Date.now(), followUpId);
    const after = await select.get(followUpId, id);
    await writeInspectionAudit(db, user, ip, id, "inspection.follow_up_completed", before, after);
    return after;
  });
}
