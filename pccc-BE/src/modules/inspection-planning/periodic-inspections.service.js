import { randomUUID } from "node:crypto";
import { assert } from "../../core/errors.js";
import { object } from "../../core/validation.js";
import { transaction } from "../../core/database.js";
import { writeAudit } from "../audit/audit.service.js";
import {
  trimmed,
  optionalText,
  date,
  optionalTime,
  requirePlanning,
  requireRole,
  unitWithin,
  parseFile,
} from "./planning.helpers.js";
import {
  scopedPlan,
  scopedFacility,
  scopedPeriodicInspection,
  ensureOfficer,
} from "./planning.queries.js";

const CASE_ROLES = ["A03", "A04"];

// ---------------------------------------------------------------------------
// UC-INS-03 — create a periodic inspection under a published plan
// ---------------------------------------------------------------------------

export async function createPeriodicInspection(db, user, planId, payload, ip) {
  requirePlanning(user, "create");
  requireRole(
    user,
    CASE_ROLES,
    "Chỉ Cán bộ kiểm tra hoặc Cán bộ tổng hợp được tạo hồ sơ kiểm tra định kỳ.",
  );
  object(payload, [
    "facility_id",
    "target_id",
    "lead_officer_id",
    "scheduled_date",
    "start_time",
    "end_time",
    "location",
    "checklist_id",
    "reason",
    "team_decision",
  ]);
  const plan = await scopedPlan(db, user, planId);
  assert(
    plan.status === "published",
    409,
    "INVALID_STATE",
    "Kế hoạch phải được công bố trước khi tạo cuộc kiểm tra.",
  );
  const facility = await scopedFacility(db, user, trimmed(payload.facility_id, "Cơ sở", 1, 100));
  assert(
    await unitWithin(db, facility.unit_id, plan.unit_id),
    400,
    "INVALID_INPUT",
    "Cơ sở không thuộc đơn vị của kế hoạch.",
  );
  const officer = await ensureOfficer(
    db,
    trimmed(payload.lead_officer_id, "Cán bộ phụ trách", 1, 100),
    facility.unit_id,
  );
  const scheduledDate = date(payload.scheduled_date, "Ngày kiểm tra");
  assert(
    Number(scheduledDate.slice(0, 4)) === plan.year,
    400,
    "INVALID_INPUT",
    "Ngày kiểm tra phải thuộc năm của kế hoạch.",
  );
  const startTime = optionalTime(payload.start_time, "Giờ bắt đầu");
  const endTime = optionalTime(payload.end_time, "Giờ kết thúc");
  assert(
    !startTime || !endTime || startTime < endTime,
    400,
    "INVALID_INPUT",
    "Giờ kết thúc phải sau giờ bắt đầu.",
  );
  let targetId = payload.target_id ?? null;
  if (targetId) {
    const target = await db
      .prepare("SELECT * FROM inspection_targets WHERE id=? AND plan_id=?")
      .get(targetId, planId);
    assert(target, 400, "INVALID_INPUT", "Chỉ tiêu được chọn không thuộc kế hoạch.");
    assert(
      !target.officer_id || target.officer_id === officer.id,
      400,
      "INVALID_INPUT",
      "Cán bộ không khớp chỉ tiêu được giao.",
    );
    assert(
      !target.region_id || target.region_id === facility.region_id,
      400,
      "INVALID_INPUT",
      "Cơ sở không thuộc địa bàn của chỉ tiêu được chọn.",
    );
    assert(
      target.month == null || target.month === Number(scheduledDate.slice(5, 7)),
      400,
      "INVALID_INPUT",
      "Ngày kiểm tra không thuộc tháng của chỉ tiêu được chọn.",
    );
  }
  const checklistId = payload.checklist_id || null;
  if (checklistId)
    assert(
      await db
        .prepare("SELECT 1 FROM inspection_checklists WHERE id=? AND is_active=1")
        .get(checklistId),
      400,
      "INVALID_INPUT",
      "Checklist không hợp lệ.",
    );
  const decision = parseFile(payload.team_decision, "Quyết định đoàn kiểm tra");
  const id = randomUUID();
  const scheduleId = randomUUID();
  const code = `KT-${plan.year}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const now = Date.now();
  return await transaction(db, async () => {
    await db
      .prepare(
        `INSERT INTO inspections(
      id,code,facility_id,kind,reason,scheduled_date,lead_officer_id,status,checklist_id,
      created_by,updated_by,created_at,updated_at,plan_id,target_id
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        code,
        facility.id,
        "periodic",
        optionalText(payload.reason, "Ghi chú", 2000),
        scheduledDate,
        officer.id,
        "planned",
        checklistId,
        user.id,
        user.id,
        now,
        now,
        planId,
        targetId,
      );
    await db
      .prepare(
        `INSERT INTO inspection_schedules(
      id,inspection_id,scheduled_date,start_time,end_time,location,created_by,updated_by,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        scheduleId,
        id,
        scheduledDate,
        startTime,
        endTime,
        optionalText(payload.location, "Địa điểm", 500) || facility.address,
        user.id,
        user.id,
        now,
        now,
      );
    if (decision)
      await db
        .prepare(
          `INSERT INTO inspection_planning_documents(
      id,inspection_id,kind,file_name,content_type,file_size,file_data,uploaded_by,uploaded_at
    ) VALUES (?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          randomUUID(),
          id,
          "team_decision",
          decision.name,
          decision.contentType,
          decision.data.length,
          decision.data,
          user.id,
          now,
        );
    const created = await scopedPeriodicInspection(db, user, id);
    await writeAudit(db, {
      actorId: user.id,
      feature: "M06.planning",
      objectType: "inspection",
      objectId: id,
      action: "periodic_inspection.created",
      after: created,
      ip,
    });
    return created;
  });
}

// ---------------------------------------------------------------------------
// Read: full planning detail for a periodic inspection
// ---------------------------------------------------------------------------

export async function planningInspectionDetail(db, user, id) {
  const inspection = await scopedPeriodicInspection(db, user, id);
  const notice =
    (await db
      .prepare(
        `SELECT id,inspection_id,notice_number,recipient_name,recipient_contact,
    notice_text,sent_date,inspection_date,status,file_name,content_type,file_size,version,created_at,updated_at
    FROM inspection_notices WHERE inspection_id=?`,
      )
      .get(id)) ?? null;
  const history = await db
    .prepare(
      `SELECT r.*,a.full_name AS changed_by_name FROM inspection_reschedules r
    JOIN accounts a ON a.id=r.changed_by WHERE r.inspection_id=? ORDER BY r.changed_at DESC`,
    )
    .all(id);
  const documents = await db
    .prepare(
      `SELECT id,kind,description,file_name,content_type,file_size,uploaded_at
    FROM inspection_planning_documents WHERE inspection_id=? ORDER BY uploaded_at`,
    )
    .all(id);
  return { inspection, notice, reschedules: history, documents };
}

// ---------------------------------------------------------------------------
// UC-INS-03 — reassign the lead officer (pre-execution only)
// ---------------------------------------------------------------------------

export async function assignLeadOfficer(db, user, id, payload, ip) {
  requirePlanning(user, "edit");
  requireRole(user, CASE_ROLES, "Vai trò hiện tại không được gán cán bộ cho cuộc kiểm tra.");
  object(payload, ["lead_officer_id", "version"]);
  const before = await scopedPeriodicInspection(db, user, id);
  assert(
    before.status === "planned",
    409,
    "INVALID_STATE",
    "Chỉ hồ sơ đang chuẩn bị mới được đổi cán bộ.",
  );
  assert(
    payload.version === before.version,
    409,
    "VERSION_CONFLICT",
    "Cuộc kiểm tra đã thay đổi. Hãy tải lại.",
  );
  const officer = await ensureOfficer(
    db,
    trimmed(payload.lead_officer_id, "Cán bộ phụ trách", 1, 100),
    before.unit_id,
  );
  const now = Date.now();
  return await transaction(db, async () => {
    await db
      .prepare(
        "UPDATE inspections SET lead_officer_id=?,version=version+1,updated_by=?,updated_at=? WHERE id=? AND version=?",
      )
      .run(officer.id, user.id, now, id, before.version);
    const after = await scopedPeriodicInspection(db, user, id);
    await writeAudit(db, {
      actorId: user.id,
      feature: "M06.planning",
      objectType: "inspection",
      objectId: id,
      action: "inspection.lead_officer_assigned",
      before,
      after,
      ip,
    });
    return after;
  });
}
