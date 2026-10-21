import { randomUUID } from "node:crypto";
import { assert } from "../../core/errors.js";
import { object, pagination } from "../../core/validation.js";
import { transaction } from "../../core/database.js";
import { facilityScope } from "../authorization/authorization.service.js";
import { writeAudit } from "../audit/audit.service.js";
import {
  date,
  optionalTime,
  requirePlanning,
  requireRole,
  parseFile,
  trimmed,
  optionalText,
} from "./planning.helpers.js";
import { scopedPeriodicInspection } from "./planning.queries.js";

const RESCHEDULE_ROLES = ["A01", "A03"];
const CASE_ROLES = ["A03", "A04"];

// ---------------------------------------------------------------------------
// UC-INS-04 — list all inspection schedules (across plans)
// ---------------------------------------------------------------------------

export async function listSchedules(db, user, url) {
  requirePlanning(user);
  const { page, pageSize } = pagination(url);
  const scope = facilityScope(user);
  const clauses = [scope.sql];
  const params = [...scope.params];
  for (const [key, operator] of [
    ["from", ">="],
    ["to", "<="],
  ]) {
    const value = url.searchParams.get(key);
    if (value) {
      clauses.push(`s.scheduled_date${operator}?`);
      params.push(date(value, key === "from" ? "Từ ngày" : "Đến ngày"));
    }
  }
  const kind = url.searchParams.get("kind");
  if (kind) {
    assert(
      ["periodic", "unscheduled", "thematic"].includes(kind),
      400,
      "INVALID_INPUT",
      "Loại kiểm tra không hợp lệ.",
    );
    clauses.push("i.kind=?");
    params.push(kind);
  }
  const where = clauses.join(" AND ");
  const base = `FROM inspection_schedules s JOIN inspections i ON i.id=s.inspection_id
    JOIN facilities f ON f.id=i.facility_id JOIN regions r ON r.id=f.region_id
    LEFT JOIN officer_directory o ON o.officer_id=i.lead_officer_id
    LEFT JOIN inspection_notices n ON n.inspection_id=i.id WHERE ${where}`;
  return {
    items: await db
      .prepare(
        `SELECT s.*,i.code AS inspection_code,i.status AS inspection_status,i.plan_id,
      f.id AS facility_id,f.name AS facility_name,r.name AS region_name,o.full_name AS lead_officer_name,
      CASE WHEN n.status='sent' THEN 'sent' WHEN n.id IS NOT NULL THEN 'draft' ELSE 'none' END AS notice_status
      ${base}
      ORDER BY s.scheduled_date,s.start_time LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize),
    total: (await db.prepare(`SELECT count(*) AS n ${base}`).get(...params)).n,
    page,
    pageSize,
  };
}

// ---------------------------------------------------------------------------
// UC-INS-03 — update schedule times/location (date change requires reschedule)
// ---------------------------------------------------------------------------

export async function updateSchedule(db, user, id, payload, ip) {
  requirePlanning(user, "edit");
  requireRole(user, CASE_ROLES, "Vai trò hiện tại không được cập nhật lịch kiểm tra.");
  object(payload, ["scheduled_date", "start_time", "end_time", "location", "version"]);
  const inspection = await scopedPeriodicInspection(db, user, id);
  assert(
    inspection.status === "planned",
    409,
    "INVALID_STATE",
    "Chỉ hồ sơ đang chuẩn bị mới được cập nhật lịch.",
  );
  assert(
    payload.version === inspection.schedule_version,
    409,
    "VERSION_CONFLICT",
    "Lịch kiểm tra đã thay đổi. Hãy tải lại.",
  );
  const scheduledDate = date(payload.scheduled_date, "Ngày kiểm tra");
  assert(
    scheduledDate === inspection.scheduled_date,
    400,
    "RESCHEDULE_REASON_REQUIRED",
    "Muốn đổi ngày kiểm tra, hãy dùng chức năng dời lịch và nhập lý do.",
  );
  const startTime = optionalTime(payload.start_time, "Giờ bắt đầu");
  const endTime = optionalTime(payload.end_time, "Giờ kết thúc");
  assert(
    !startTime || !endTime || startTime < endTime,
    400,
    "INVALID_INPUT",
    "Giờ kết thúc phải sau giờ bắt đầu.",
  );
  const before = {
    scheduled_date: inspection.scheduled_date,
    start_time: inspection.start_time,
    end_time: inspection.end_time,
    location: inspection.location,
  };
  const now = Date.now();
  return await transaction(db, async () => {
    await db
      .prepare(
        `UPDATE inspection_schedules SET scheduled_date=?,start_time=?,end_time=?,location=?,
      version=version+1,updated_by=?,updated_at=? WHERE inspection_id=? AND version=?`,
      )
      .run(
        scheduledDate,
        startTime,
        endTime,
        optionalText(payload.location, "Địa điểm", 500),
        user.id,
        now,
        id,
        inspection.schedule_version,
      );
    await db
      .prepare(
        "UPDATE inspections SET scheduled_date=?,version=version+1,updated_by=?,updated_at=? WHERE id=?",
      )
      .run(scheduledDate, user.id, now, id);
    const after = await scopedPeriodicInspection(db, user, id);
    await writeAudit(db, {
      actorId: user.id,
      feature: "M06.planning",
      objectType: "inspection_schedule",
      objectId: inspection.schedule_id,
      action: "inspection_schedule.updated",
      before,
      after: {
        scheduled_date: after.scheduled_date,
        start_time: after.start_time,
        end_time: after.end_time,
        location: after.location,
      },
      ip,
    });
    return after;
  });
}

// ---------------------------------------------------------------------------
// Read: reschedule history for an inspection
// ---------------------------------------------------------------------------

export async function listReschedules(db, user, id) {
  await scopedPeriodicInspection(db, user, id);
  return {
    items: await db
      .prepare(
        `SELECT r.id,r.inspection_id,r.schedule_id,r.old_date,r.new_date,r.old_start_time,
          r.new_start_time,r.old_end_time,r.new_end_time,r.reason,r.attachment_name,
          r.attachment_type,r.attachment_size,r.changed_by,r.changed_at,a.full_name AS changed_by_name
        FROM inspection_reschedules r JOIN accounts a ON a.id=r.changed_by
        WHERE r.inspection_id=? ORDER BY r.changed_at DESC`,
      )
      .all(id),
  };
}

// ---------------------------------------------------------------------------
// UC-INS-05 — reschedule: create a new date with mandatory reason and optional attachment
// ---------------------------------------------------------------------------

export async function rescheduleInspection(db, user, id, payload, ip) {
  requirePlanning(user, "edit");
  requireRole(user, RESCHEDULE_ROLES, "Chỉ Chỉ huy hoặc Cán bộ kiểm tra được dời lịch.");
  object(payload, ["new_date", "start_time", "end_time", "reason", "version", "attachment"]);
  const before = await scopedPeriodicInspection(db, user, id);
  assert(
    before.status === "planned",
    409,
    "INVALID_STATE",
    "Chỉ cuộc kiểm tra chưa thực hiện mới được dời lịch.",
  );
  assert(
    payload.version === before.schedule_version,
    409,
    "VERSION_CONFLICT",
    "Lịch kiểm tra đã thay đổi. Hãy tải lại.",
  );
  const newDate = date(payload.new_date, "Ngày mới");
  assert(
    newDate !== before.scheduled_date,
    400,
    "INVALID_INPUT",
    "Ngày mới phải khác ngày hiện tại.",
  );
  const reason = trimmed(payload.reason, "Lý do dời lịch", 1, 2000);
  const startTime = optionalTime(payload.start_time ?? before.start_time, "Giờ bắt đầu");
  const endTime = optionalTime(payload.end_time ?? before.end_time, "Giờ kết thúc");
  assert(
    !startTime || !endTime || startTime < endTime,
    400,
    "INVALID_INPUT",
    "Giờ kết thúc phải sau giờ bắt đầu.",
  );
  const attachment = parseFile(payload.attachment);
  const plan = await db.prepare("SELECT year FROM inspection_plans WHERE id=?").get(before.plan_id);
  const outsidePlanYear = plan ? Number(newDate.slice(0, 4)) !== plan.year : false;
  const rescheduleId = randomUUID();
  const now = Date.now();
  return await transaction(db, async () => {
    await db
      .prepare(
        `INSERT INTO inspection_reschedules(
      id,inspection_id,schedule_id,old_date,new_date,old_start_time,new_start_time,old_end_time,new_end_time,
      reason,attachment_name,attachment_type,attachment_size,attachment_data,changed_by,changed_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        rescheduleId,
        id,
        before.schedule_id,
        before.scheduled_date,
        newDate,
        before.start_time,
        startTime,
        before.end_time,
        endTime,
        reason,
        attachment?.name ?? null,
        attachment?.contentType ?? null,
        attachment?.data.length ?? null,
        attachment?.data ?? null,
        user.id,
        now,
      );
    await db
      .prepare(
        `UPDATE inspection_schedules SET scheduled_date=?,start_time=?,end_time=?,status='rescheduled',
      version=version+1,updated_by=?,updated_at=? WHERE id=? AND version=?`,
      )
      .run(newDate, startTime, endTime, user.id, now, before.schedule_id, before.schedule_version);
    await db
      .prepare(
        "UPDATE inspections SET scheduled_date=?,version=version+1,updated_by=?,updated_at=? WHERE id=?",
      )
      .run(newDate, user.id, now, id);
    const notice = await db
      .prepare("SELECT * FROM inspection_notices WHERE inspection_id=?")
      .get(id);
    if (notice)
      await db
        .prepare(
          "UPDATE inspection_notices SET inspection_date=?,status='draft',sent_date=NULL,version=version+1,updated_by=?,updated_at=? WHERE inspection_id=?",
        )
        .run(newDate, user.id, now, id);
    const history = await db
      .prepare(
        `SELECT id,inspection_id,schedule_id,old_date,new_date,old_start_time,
      new_start_time,old_end_time,new_end_time,reason,attachment_name,attachment_type,attachment_size,
      changed_by,changed_at FROM inspection_reschedules WHERE id=?`,
      )
      .get(rescheduleId);
    await writeAudit(db, {
      actorId: user.id,
      feature: "M06.planning",
      objectType: "inspection_schedule",
      objectId: before.schedule_id,
      action: "inspection_schedule.rescheduled",
      before: {
        date: before.scheduled_date,
        start_time: before.start_time,
        end_time: before.end_time,
      },
      after: {
        date: newDate,
        start_time: startTime,
        end_time: endTime,
        reason,
        outside_plan_year: outsidePlanYear,
      },
      ip,
    });
    return {
      reschedule: history,
      schedule: await scopedPeriodicInspection(db, user, id),
      warning: outsidePlanYear ? "Ngày mới nằm ngoài năm kế hoạch." : null,
    };
  });
}
