import { randomUUID } from "node:crypto";
import { assert } from "../../core/errors.js";
import { object } from "../../core/validation.js";
import { transaction } from "../../core/database.js";
import { writeAudit } from "../audit/audit.service.js";
import {
  trimmed,
  optionalText,
  date,
  requirePlanning,
  requireRole,
  parseFile,
} from "./planning.helpers.js";
import { scopedPeriodicInspection } from "./planning.queries.js";

const CASE_ROLES = ["A03", "A04"];

// ---------------------------------------------------------------------------
// UC-INS-03 — create or update the pre-inspection notice (thông báo)
// ---------------------------------------------------------------------------

export async function upsertNotice(db, user, id, payload, ip) {
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
  const inspection = await scopedPeriodicInspection(db, user, id);
  assert(
    inspection.status === "planned",
    409,
    "INVALID_STATE",
    "Chỉ hồ sơ đang chuẩn bị mới được lập thông báo.",
  );
  const before =
    (await db.prepare("SELECT * FROM inspection_notices WHERE inspection_id=?").get(id)) ?? null;
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
  return await transaction(db, async () => {
    if (before)
      await db
        .prepare(
          `UPDATE inspection_notices SET notice_number=?,recipient_name=?,recipient_contact=?,
      notice_text=?,sent_date=?,inspection_date=?,status=?,file_name=coalesce(?,file_name),
      content_type=coalesce(?,content_type),file_size=coalesce(?,file_size),file_data=coalesce(?,file_data),
      version=version+1,updated_by=?,updated_at=? WHERE id=? AND version=?`,
        )
        .run(
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
      await db
        .prepare(
          `INSERT INTO inspection_notices(
      id,inspection_id,notice_number,recipient_name,recipient_contact,notice_text,sent_date,
      inspection_date,status,file_name,content_type,file_size,file_data,created_by,updated_by,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
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
    const after = await db
      .prepare(
        `SELECT id,inspection_id,notice_number,recipient_name,recipient_contact,notice_text,
      sent_date,inspection_date,status,file_name,content_type,file_size,version,created_at,updated_at
      FROM inspection_notices WHERE id=?`,
      )
      .get(idValue);
    await writeAudit(db, {
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
