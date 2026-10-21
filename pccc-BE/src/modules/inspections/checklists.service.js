import { randomUUID } from "node:crypto";
import { assert } from "../../core/errors.js";
import { object } from "../../core/validation.js";
import { transaction } from "../../core/database.js";
import { requirePermission } from "../authorization/authorization.service.js";
import { writeAudit } from "../audit/audit.service.js";
import { trimmed } from "./inspections.helpers.js";

// ---------------------------------------------------------------------------
// Checklist author guard
// ---------------------------------------------------------------------------

// Same pattern as requireAdministrator: a configurable permission plus the roles allowed to use it.
export const CHECKLIST_AUTHOR_ROLES = ["A01", "A02"];

export function requireChecklistAuthor(user) {
  requirePermission(user, "M06.view");
  requirePermission(user, "M06.create");
  assert(
    CHECKLIST_AUTHOR_ROLES.includes(user.role),
    403,
    "FORBIDDEN",
    "Chỉ Chỉ huy hoặc Phó chỉ huy được tạo checklist kiểm tra.",
  );
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function checklistItems(db, checklistId) {
  return await db
    .prepare(
      `SELECT id,position,content,guidance,legal_reference,is_required
      FROM inspection_checklist_items WHERE checklist_id=? ORDER BY position`,
    )
    .all(checklistId);
}

// ---------------------------------------------------------------------------
// Public service functions — UC-INS-06
// ---------------------------------------------------------------------------

/** Active checklists; facilityType keeps general checklists plus that specific type. */
export async function listChecklists(db, user, url) {
  requirePermission(user, "M06.view");
  const facilityType = url.searchParams.get("facilityType");
  const params = [];
  let filter = "";
  if (facilityType) {
    trimmed(facilityType, "Loại cơ sở", 1, 100);
    filter = "AND (c.facility_type IS NULL OR c.facility_type=?)";
    params.push(facilityType.trim());
  }
  return {
    items: await db
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

export async function checklistDetail(db, user, id) {
  requirePermission(user, "M06.view");
  const checklist = await db
    .prepare(
      `SELECT c.id,c.name,c.facility_type,c.description,c.legal_document_id,c.is_active,
        d.title AS legal_document_title
      FROM inspection_checklists c LEFT JOIN legal_documents d ON d.id=c.legal_document_id
      WHERE c.id=?`,
    )
    .get(id);
  assert(checklist, 404, "NOT_FOUND", "Không tìm thấy checklist kiểm tra.");
  return { checklist, items: await checklistItems(db, id) };
}

/** UC-INS-06 — create a checklist with its ordered items (positions follow the array order). */
export async function createChecklist(db, user, payload, ip) {
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
      await db.prepare("SELECT 1 FROM legal_documents WHERE id=?").get(legalDocumentId),
      400,
      "INVALID_INPUT",
      "Tài liệu hướng dẫn không tồn tại trong kho văn bản.",
    );
  return await transaction(db, async () => {
    // SQLite lower() is ASCII-only, so compare Vietnamese names case-insensitively here.
    const key = name.toLocaleLowerCase("vi");
    assert(
      !(
        await db
          .prepare(
            `SELECT name FROM inspection_checklists WHERE is_active=1
          AND coalesce(facility_type,'')=coalesce(?,'')`,
          )
          .all(facilityType)
      ).some((row) => row.name.toLocaleLowerCase("vi") === key),
      409,
      "DUPLICATE_CHECKLIST",
      "Đã có checklist cùng tên cho loại cơ sở này.",
    );
    const id = randomUUID();
    await db
      .prepare(
        `INSERT INTO inspection_checklists(id,name,facility_type,description,legal_document_id,created_by,created_at)
      VALUES (?,?,?,?,?,?,?)`,
      )
      .run(id, name, facilityType, description, legalDocumentId, user.id, Date.now());
    const insertItem = db.prepare(
      `INSERT INTO inspection_checklist_items(id,checklist_id,position,content,guidance,legal_reference,is_required)
      VALUES (?,?,?,?,?,?,?)`,
    );
    for (const [index, item] of items.entries())
      await insertItem.run(
        randomUUID(),
        id,
        index + 1,
        item.content,
        item.guidance,
        item.legalReference,
        item.required,
      );
    const after = await checklistDetail(db, user, id);
    await writeAudit(db, {
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
