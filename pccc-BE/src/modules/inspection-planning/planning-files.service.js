import { assert } from "../../core/errors.js";
import { scopedPeriodicInspection } from "./planning.queries.js";

// ---------------------------------------------------------------------------
// Serve binary planning files: notice PDF, planning documents, reschedule attachments
// ---------------------------------------------------------------------------

export async function planningFile(db, user, inspectionId, kind, objectId = null) {
  await scopedPeriodicInspection(db, user, inspectionId);
  let row;
  if (kind === "notice") {
    row = await db
      .prepare(
        `SELECT file_name,content_type,file_size,file_data FROM inspection_notices
        WHERE inspection_id=? AND file_data IS NOT NULL`,
      )
      .get(inspectionId);
  } else if (kind === "document") {
    row = await db
      .prepare(
        `SELECT file_name,content_type,file_size,file_data FROM inspection_planning_documents
        WHERE id=? AND inspection_id=?`,
      )
      .get(objectId, inspectionId);
  } else if (kind === "reschedule") {
    row = await db
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
