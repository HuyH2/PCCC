import { assert } from "../../core/errors.js";
import { facilityScope } from "../authorization/authorization.service.js";
import { inspectionColumns, inspectionJoins } from "./inspections.constants.js";
import { requireInspectionAccess } from "./inspections.helpers.js";

// ---------------------------------------------------------------------------
// Scoped row fetchers
// ---------------------------------------------------------------------------

/**
 * Returns the inspection row visible to the caller, or 404.
 * Never reveals records outside the caller's facility scope.
 */
export async function scopedInspection(db, user, id) {
  requireInspectionAccess(user);
  const scope = facilityScope(user);
  const row = await db
    .prepare(`SELECT ${inspectionColumns} FROM ${inspectionJoins} WHERE ${scope.sql} AND i.id=?`)
    .get(...scope.params, id);
  assert(row, 404, "NOT_FOUND", "Không tìm thấy cuộc kiểm tra trong phạm vi được cấp.");
  return row;
}

// ---------------------------------------------------------------------------
// Detail query (inspection + items + documents + follow-ups)
// ---------------------------------------------------------------------------

export async function inspectionDetail(db, user, id) {
  const inspection = await scopedInspection(db, user, id);
  const items = inspection.checklist_id
    ? await db
        .prepare(
          `SELECT it.id,it.position,it.content,it.guidance,it.legal_reference,it.is_required,
            coalesce(res.status,'pending') AS status,coalesce(res.note,'') AS note,res.updated_at
          FROM inspection_checklist_items it
          LEFT JOIN inspection_results res ON res.item_id=it.id AND res.inspection_id=?
          WHERE it.checklist_id=? ORDER BY it.position`,
        )
        .all(id, inspection.checklist_id)
    : [];
  const documents = await db
    .prepare(
      `SELECT d.id,d.kind,d.follow_up_id,d.record_number,d.description,d.file_name,d.content_type,
        d.file_size,d.uploaded_by,a.full_name AS uploaded_by_name,d.uploaded_at
      FROM inspection_documents d LEFT JOIN accounts a ON a.id=d.uploaded_by
      WHERE d.inspection_id=? ORDER BY d.uploaded_at,d.id`,
    )
    .all(id);
  const followUps = await db
    .prepare(
      `SELECT fu.id,fu.requirement,fu.due_date,fu.status,fu.outcome,fu.result_note,fu.created_by,
        fu.created_at,fu.completed_by,a.full_name AS completed_by_name,fu.completed_at
      FROM follow_up_inspections fu LEFT JOIN accounts a ON a.id=fu.completed_by
      WHERE fu.inspection_id=? ORDER BY fu.created_at,fu.id`,
    )
    .all(id);
  return { inspection, items, documents, followUps };
}
