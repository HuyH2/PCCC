import { randomUUID } from "node:crypto";
import { assert } from "../../core/errors.js";
import { text } from "../../core/validation.js";
import { transaction } from "../../core/database.js";
import {
  FILE_TYPES,
  MAX_INSPECTION_FILE_BYTES,
  INSPECTION_FILE_SIZE_MESSAGE,
} from "./inspections.constants.js";
import {
  requireInspectionAccess,
  trimmed,
  expectStatus,
  writeInspectionAudit,
} from "./inspections.helpers.js";
import { scopedInspection } from "./inspections.queries.js";

// ---------------------------------------------------------------------------
// File validation (also used by routes for the streaming upload guard)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// UC-INS-07 — upload a record (biên bản) or evidence file
// ---------------------------------------------------------------------------

/**
 * While in progress any document kind is accepted; after completion only evidence
 * for the open follow-up (hậu kiểm) may be added.
 */
export async function uploadDocument(db, user, id, upload, ip) {
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
  return await transaction(db, async () => {
    const inspection = await scopedInspection(db, user, id);
    let followUpId = null;
    if (inspection.status === "completed") {
      assert(
        kind === "evidence",
        409,
        "INVALID_STATE",
        "Cuộc kiểm tra đã hoàn thành, không thể thay biên bản.",
      );
      followUpId = (
        await db
          .prepare("SELECT id FROM follow_up_inspections WHERE inspection_id=? AND status='open'")
          .get(id)
      )?.id;
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
    await db
      .prepare(
        `INSERT INTO inspection_documents(id,inspection_id,follow_up_id,kind,record_number,description,
        file_name,content_type,file_size,file_data,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
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
    await writeInspectionAudit(db, user, ip, id, "inspection.document_uploaded", null, document);
    return document;
  });
}

// ---------------------------------------------------------------------------
// UC-INS-07 — serve the binary file of an uploaded document
// ---------------------------------------------------------------------------

export async function documentFile(db, user, id, documentId) {
  await scopedInspection(db, user, id);
  const file = await db
    .prepare(
      "SELECT file_name,content_type,file_data FROM inspection_documents WHERE id=? AND inspection_id=?",
    )
    .get(documentId, id);
  assert(file, 404, "NOT_FOUND", "Không tìm thấy tài liệu.");
  return file;
}
