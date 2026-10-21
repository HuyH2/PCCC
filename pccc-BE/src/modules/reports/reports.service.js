import { randomUUID } from "node:crypto";
import { assert } from "../../core/errors.js";
import { foldSearchText, transaction } from "../../core/database.js";
import { businessDate } from "../../core/time.js";
import { object, pagination, text } from "../../core/validation.js";
import { accountScope, requirePermission } from "../authorization/authorization.service.js";
import { writeAudit } from "../audit/audit.service.js";
import { notifyUser } from "../notifications/notifications.service.js";

const cycles = ["once", "weekly", "monthly", "quarterly", "yearly"];
const fileTypes = {
  "application/pdf": { ext: /\.pdf$/i, magic: (b) => b.subarray(0, 5).toString() === "%PDF-" },
  "image/png": {
    ext: /\.png$/i,
    magic: (b) => b.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")),
  },
  "image/jpeg": { ext: /\.jpe?g$/i, magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    ext: /\.docx$/i,
    magic: (b) => b[0] === 0x50 && b[1] === 0x4b,
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    ext: /\.xlsx$/i,
    magic: (b) => b[0] === 0x50 && b[1] === 0x4b,
  },
};
export const MAX_REPORT_FILE_BYTES = 10 * 1024 * 1024;

function access(user, action = "view") {
  requirePermission(user, `M08.${action}`);
  assert(user.scopes.length > 0, 403, "FORBIDDEN", "Tài khoản chưa có phạm vi quản lý.");
}
function manager(user, action) {
  access(user, action);
  assert(
    ["A01", "A02", "A04", "A05"].includes(user.role),
    403,
    "FORBIDDEN",
    "Bạn không có quyền quản lý báo cáo.",
  );
}
function date(value, field) {
  assert(
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value),
    400,
    "INVALID_INPUT",
    `${field} không hợp lệ.`,
  );
  const time = Date.parse(`${value}T00:00:00+07:00`);
  assert(
    Number.isFinite(time) && new Date(time + 7 * 3600000).toISOString().slice(0, 10) === value,
    400,
    "INVALID_INPUT",
    `${field} không hợp lệ.`,
  );
  return value;
}
function warningDays(value) {
  assert(
    Number.isInteger(value) && value >= 0 && value <= 90,
    400,
    "INVALID_INPUT",
    "Số ngày cảnh báo phải từ 0 đến 90.",
  );
  return value;
}
function visibleWhere(user) {
  const scope = accountScope(user);
  return { sql: scope.sql, params: scope.params };
}
function row(db, user, id) {
  access(user);
  const visible = visibleWhere(user);
  const found = db
    .prepare(
      `SELECT r.*,t.name AS type_name,t.cycle,
    requester.full_name AS requester_name, a.full_name AS assignee_name
    FROM report_requests r JOIN report_types t ON t.id=r.report_type_id
    JOIN accounts a ON a.id=r.assignee_id JOIN accounts requester ON requester.id=r.requester_id
    WHERE r.id=? AND ${visible.sql}`,
    )
    .get(id, ...visible.params);
  assert(found, 404, "NOT_FOUND", "Không tìm thấy yêu cầu báo cáo trong phạm vi.");
  return found;
}
function withDerived(r, today = businessDate()) {
  return {
    ...r,
    deadline_status:
      r.status === "open"
        ? r.due_date < today
          ? "overdue"
          : (Date.parse(`${r.due_date}T00:00:00+07:00`) - Date.parse(`${today}T00:00:00+07:00`)) /
                86400000 <=
              r.warning_days
            ? "due_soon"
            : "normal"
        : "closed",
  };
}
function log(db, user, ip, objectType, objectId, action, before, after) {
  writeAudit(db, {
    actorId: user.id,
    feature: "M08",
    objectType,
    objectId,
    action,
    before,
    after,
    ip,
  });
}
function target(db, user, id) {
  const scope = accountScope(user);
  const found = db
    .prepare(
      `SELECT a.id,a.full_name,a.status FROM accounts a
    JOIN role_permissions rp ON rp.role_code=a.role_code AND rp.permission_code='M08.edit'
    WHERE a.id=? AND ${scope.sql}`,
    )
    .get(id, ...scope.params);
  assert(
    found && found.status === "active",
    400,
    "INVALID_ASSIGNEE",
    "Người thực hiện không hoạt động hoặc ngoài phạm vi.",
  );
  return found;
}
export function listReportAssignees(db, user) {
  manager(user, "create");
  const scope = accountScope(user);
  return {
    items: db
      .prepare(
        `SELECT DISTINCT a.id,a.full_name,a.username FROM accounts a
    JOIN role_permissions rp ON rp.role_code=a.role_code AND rp.permission_code='M08.edit'
    WHERE a.status='active' AND ${scope.sql} ORDER BY a.full_name`,
      )
      .all(...scope.params),
  };
}
export function listReportTypes(db, user) {
  access(user);
  return {
    items: db
      .prepare(
        "SELECT id,name,description,cycle,warning_days,active,created_at FROM report_types ORDER BY name",
      )
      .all(),
  };
}
export function createReportType(db, user, input, ip) {
  manager(user, "create");
  assert(
    user.role === "A05" && user.scopes.some((s) => s.kind === "all"),
    403,
    "FORBIDDEN",
    "Chỉ quản trị được sửa danh mục dùng chung.",
  );
  object(input, ["name", "description", "cycle", "warningDays"]);
  const name = text(input.name?.trim(), "Tên loại báo cáo", 1, 200);
  const description = text((input.description ?? "").trim(), "Mô tả", 0, 1000);
  assert(cycles.includes(input.cycle), 400, "INVALID_INPUT", "Chu kỳ không hợp lệ.");
  const days = warningDays(input.warningDays ?? 5);
  const id = randomUUID(),
    now = Date.now();
  transaction(db, () => {
    db.prepare("INSERT INTO report_types VALUES (?,?,?,?,?,1,?,?,?)").run(
      id,
      name,
      description,
      input.cycle,
      days,
      user.id,
      now,
      now,
    );
    log(db, user, ip, "report_type", id, "report.type_created", null, {
      name,
      cycle: input.cycle,
      warningDays: days,
    });
  });
  return { id, name, description, cycle: input.cycle, warning_days: days };
}
export function updateReportType(db, user, id, input, ip) {
  manager(user, "edit");
  assert(
    user.role === "A05" && user.scopes.some((s) => s.kind === "all"),
    403,
    "FORBIDDEN",
    "Chỉ quản trị được sửa danh mục dùng chung.",
  );
  object(input, ["name", "description", "warningDays", "active"]);
  const before = db.prepare("SELECT * FROM report_types WHERE id=?").get(id);
  assert(before, 404, "NOT_FOUND", "Không tìm thấy loại báo cáo.");
  const name =
    input.name === undefined ? before.name : text(input.name?.trim(), "Tên loại báo cáo", 1, 200);
  const description =
    input.description === undefined
      ? before.description
      : text(input.description?.trim(), "Mô tả", 0, 1000);
  const days =
    input.warningDays === undefined ? before.warning_days : warningDays(input.warningDays);
  const active =
    input.active === undefined
      ? before.active
      : input.active === true
        ? 1
        : input.active === false
          ? 0
          : null;
  assert(active !== null, 400, "INVALID_INPUT", "Trạng thái không hợp lệ.");
  transaction(db, () => {
    db.prepare(
      "UPDATE report_types SET name=?,description=?,warning_days=?,active=?,updated_at=? WHERE id=?",
    ).run(name, description, days, active, Date.now(), id);
    log(db, user, ip, "report_type", id, "report.type_updated", before, {
      name,
      description,
      warning_days: days,
      active,
    });
  });
  return { id, name, description, warning_days: days, active };
}
function insertRequest(
  db,
  {
    id,
    type,
    title,
    recipient,
    referenceNumber,
    requesterId,
    assigneeId,
    dueDate,
    scheduleId = null,
    periodKey = null,
    now,
  },
) {
  db.prepare(
    `INSERT INTO report_requests
    (id,report_type_id,schedule_id,period_key,title,recipient,reference_number,requester_id,assignee_id,due_date,warning_days,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    type.id,
    scheduleId,
    periodKey,
    title,
    recipient,
    referenceNumber,
    requesterId,
    assigneeId,
    dueDate,
    type.warning_days,
    now,
    now,
  );
  notifyUser(db, {
    userId: assigneeId,
    feature: "M08",
    kind: "assigned",
    title: "Yêu cầu báo cáo mới",
    body: `${title} · hạn ${dueDate}`,
    targetPath: `/bao-cao/${id}`,
    objectId: id,
    dedupeKey: `report:${id}:assigned`,
  });
}
export function createReportRequest(db, user, input, ip) {
  manager(user, "create");
  object(input, ["reportTypeId", "title", "recipient", "referenceNumber", "assigneeId", "dueDate"]);
  const type = db
    .prepare("SELECT * FROM report_types WHERE id=? AND active=1")
    .get(input.reportTypeId);
  assert(type, 400, "INVALID_INPUT", "Loại báo cáo không tồn tại hoặc đã ngừng sử dụng.");
  target(db, user, text(input.assigneeId, "Người thực hiện", 1, 100));
  const title = text((input.title ?? type.name)?.trim(), "Tên báo cáo", 1, 200);
  const recipient = text(input.recipient?.trim(), "Nơi nhận", 1, 200);
  const referenceNumber = input.referenceNumber
    ? text(input.referenceNumber.trim(), "Số văn bản", 1, 100)
    : null;
  const dueDate = date(input.dueDate, "Hạn nộp");
  const id = randomUUID(),
    now = Date.now();
  transaction(db, () => {
    insertRequest(db, {
      id,
      type,
      title,
      recipient,
      referenceNumber,
      requesterId: user.id,
      assigneeId: input.assigneeId,
      dueDate,
      now,
    });
    log(db, user, ip, "report_request", id, "report.request_created", null, {
      title,
      dueDate,
      assigneeId: input.assigneeId,
      referenceNumber,
    });
  });
  return { request: withDerived(row(db, user, id)) };
}
export function listReportRequests(db, user, url) {
  access(user);
  const { page, pageSize } = pagination(url);
  const visible = visibleWhere(user);
  const clauses = [visible.sql],
    params = [...visible.params];
  for (const [key, column] of [
    ["status", "r.status"],
    ["reportTypeId", "r.report_type_id"],
    ["assigneeId", "r.assignee_id"],
  ]) {
    const value = url.searchParams.get(key);
    if (value) {
      text(value, key, 1, 100);
      clauses.push(`${column}=?`);
      params.push(value);
    }
  }
  const q = url.searchParams.get("q");
  if (q) {
    text(q, "Tìm kiếm", 1, 100);
    clauses.push("(fold(r.title) LIKE ? OR fold(coalesce(r.reference_number,'')) LIKE ?)");
    params.push(`%${foldSearchText(q)}%`, `%${foldSearchText(q)}%`);
  }
  const bucket = url.searchParams.get("bucket");
  const today = businessDate();
  if (bucket === "overdue") {
    clauses.push("r.status='open' AND r.due_date<?");
    params.push(today);
  } else if (bucket === "due_soon") {
    clauses.push(
      "r.status='open' AND r.due_date>=? AND julianday(r.due_date)-julianday(?)<=r.warning_days",
    );
    params.push(today, today);
  } else assert(!bucket || bucket === "all", 400, "INVALID_INPUT", "Bộ lọc hạn không hợp lệ.");
  const where = clauses.join(" AND ");
  const from = `FROM report_requests r JOIN report_types t ON t.id=r.report_type_id
    JOIN accounts a ON a.id=r.assignee_id JOIN accounts requester ON requester.id=r.requester_id WHERE ${where}`;
  const items = db
    .prepare(
      `SELECT r.*,t.name AS type_name,t.cycle,a.full_name AS assignee_name,
    requester.full_name AS requester_name ${from} ORDER BY r.due_date DESC,r.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize)
    .map((r) => withDerived(r, today));
  return {
    items,
    total: db.prepare(`SELECT count(*) AS n ${from}`).get(...params).n,
    page,
    pageSize,
  };
}
export function reportDetail(db, user, id) {
  const request = withDerived(row(db, user, id));
  const submissions = db
    .prepare(
      `SELECT s.id,s.request_id,s.submitted_by,a.full_name AS submitter_name,
    s.note,s.file_name,s.content_type,s.file_size,s.submitted_at FROM report_submissions s
    JOIN accounts a ON a.id=s.submitted_by WHERE s.request_id=? ORDER BY s.submitted_at DESC`,
    )
    .all(id);
  return { request, submissions };
}
export function updateReportRequest(db, user, id, input, ip) {
  manager(user, "edit");
  object(input, ["assigneeId", "dueDate", "recipient", "referenceNumber"]);
  const before = row(db, user, id);
  assert(before.status === "open", 409, "INVALID_STATE", "Chỉ sửa được yêu cầu đang mở.");
  assert(
    before.requester_id === user.id || user.role === "A05",
    403,
    "FORBIDDEN",
    "Chỉ người yêu cầu được điều chỉnh.",
  );
  const assignee = input.assigneeId ?? before.assignee_id;
  target(db, user, assignee);
  const dueDate = input.dueDate ? date(input.dueDate, "Hạn nộp") : before.due_date;
  const recipient =
    input.recipient === undefined
      ? before.recipient
      : text(input.recipient.trim(), "Nơi nhận", 1, 200);
  const reference =
    input.referenceNumber === undefined
      ? before.reference_number
      : input.referenceNumber
        ? text(input.referenceNumber.trim(), "Số văn bản", 1, 100)
        : null;
  transaction(db, () => {
    db.prepare(
      "UPDATE report_requests SET assignee_id=?,due_date=?,recipient=?,reference_number=?,updated_at=? WHERE id=?",
    ).run(assignee, dueDate, recipient, reference, Date.now(), id);
    if (assignee !== before.assignee_id)
      notifyUser(db, {
        userId: assignee,
        feature: "M08",
        kind: "assigned",
        title: "Bạn được giao báo cáo",
        body: `${before.title} · hạn ${dueDate}`,
        targetPath: `/bao-cao/${id}`,
        objectId: id,
        dedupeKey: `report:${id}:reassigned:${assignee}`,
      });
    log(
      db,
      user,
      ip,
      "report_request",
      id,
      "report.request_updated",
      { assigneeId: before.assignee_id, dueDate: before.due_date },
      { assigneeId: assignee, dueDate },
    );
  });
  return reportDetail(db, user, id);
}
export function submitReport(db, user, id, upload, ip) {
  access(user, "edit");
  const request = row(db, user, id);
  assert(
    request.assignee_id === user.id,
    403,
    "FORBIDDEN",
    "Chỉ người được giao được nộp báo cáo.",
  );
  assert(
    request.status === "open",
    409,
    "INVALID_STATE",
    "Báo cáo không còn ở trạng thái chờ nộp.",
  );
  const fileName = text(upload.fileName, "Tên file", 1, 180);
  const contentType = upload.contentType;
  const spec = fileTypes[contentType];
  assert(
    spec && !/[\\/\x00-\x1f\x7f]/.test(fileName) && spec.ext.test(fileName),
    415,
    "UNSUPPORTED_MEDIA_TYPE",
    "Chỉ nhận PDF, PNG, JPEG, DOCX hoặc XLSX đúng định dạng.",
  );
  const data = upload.data;
  assert(
    Buffer.isBuffer(data) && data.length > 0 && data.length <= MAX_REPORT_FILE_BYTES,
    413,
    "FILE_TOO_LARGE",
    "File báo cáo phải từ 1 byte đến 10 MB.",
  );
  assert(spec.magic(data), 400, "INVALID_FILE", "Nội dung file không khớp định dạng.");
  const note = text((upload.note ?? "").trim(), "Ghi chú", 0, 1000);
  const submissionId = randomUUID(),
    now = Date.now();
  transaction(db, () => {
    db.prepare(
      `INSERT INTO report_submissions
      (id,request_id,submitted_by,note,file_name,content_type,file_size,file_data,submitted_at)
      VALUES (?,?,?,?,?,?,?,?,?)`,
    ).run(submissionId, id, user.id, note, fileName, contentType, data.length, data, now);
    db.prepare(
      "UPDATE report_requests SET status='submitted',updated_at=? WHERE id=? AND status='open'",
    ).run(now, id);
    notifyUser(db, {
      userId: request.requester_id,
      feature: "M08",
      kind: "submitted",
      title: "Báo cáo đã được nộp",
      body: request.title,
      targetPath: `/bao-cao/${id}`,
      objectId: id,
      dedupeKey: `report:${id}:submitted`,
    });
    log(
      db,
      user,
      ip,
      "report_request",
      id,
      "report.submitted",
      { status: "open" },
      { status: "submitted", fileName, note },
    );
  });
  return reportDetail(db, user, id);
}
export function reportFile(db, user, id, submissionId) {
  row(db, user, id);
  const file = db
    .prepare(
      "SELECT file_name,content_type,file_data FROM report_submissions WHERE id=? AND request_id=?",
    )
    .get(submissionId, id);
  assert(file, 404, "NOT_FOUND", "Không tìm thấy file báo cáo.");
  return file;
}
export function completeReport(db, user, id, ip) {
  access(user, "approve");
  const request = row(db, user, id);
  assert(
    request.requester_id === user.id || user.role === "A05",
    403,
    "FORBIDDEN",
    "Chỉ người yêu cầu được xác nhận hoàn thành.",
  );
  assert(
    request.status === "submitted",
    409,
    "INVALID_STATE",
    "Chỉ hoàn thành được báo cáo đã nộp.",
  );
  transaction(db, () => {
    db.prepare(
      "UPDATE report_requests SET status='completed',completed_at=?,updated_at=? WHERE id=? AND status='submitted'",
    ).run(Date.now(), Date.now(), id);
    notifyUser(db, {
      userId: request.assignee_id,
      feature: "M08",
      kind: "completed",
      title: "Báo cáo đã hoàn thành",
      body: request.title,
      targetPath: `/bao-cao/${id}`,
      objectId: id,
      dedupeKey: `report:${id}:completed`,
    });
    log(
      db,
      user,
      ip,
      "report_request",
      id,
      "report.completed",
      { status: "submitted" },
      { status: "completed" },
    );
  });
  return reportDetail(db, user, id);
}

function nextDate(value, cycle) {
  const [year, month, day] = value.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (cycle === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else {
    const months = cycle === "monthly" ? 1 : cycle === "quarterly" ? 3 : 12;
    const first = new Date(Date.UTC(year, month - 1 + months, 1));
    const last = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
    first.setUTCDate(Math.min(day, last));
    return first.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}
export function listReportSchedules(db, user) {
  access(user);
  const scope = accountScope(user);
  return {
    items: db
      .prepare(
        `SELECT s.*,t.name AS type_name,t.cycle,a.full_name AS assignee_name
    FROM report_schedules s JOIN report_types t ON t.id=s.report_type_id
    JOIN accounts a ON a.id=s.assignee_id WHERE ${scope.sql}
    ORDER BY s.next_due_date`,
      )
      .all(...scope.params),
  };
}
export function createReportSchedule(db, user, input, ip) {
  manager(user, "create");
  object(input, ["reportTypeId", "assigneeId", "recipient", "referenceNumber", "firstDueDate"]);
  const type = db
    .prepare("SELECT * FROM report_types WHERE id=? AND active=1")
    .get(input.reportTypeId);
  assert(
    type && type.cycle !== "once",
    400,
    "INVALID_INPUT",
    "Cần chọn loại báo cáo định kỳ đang hoạt động.",
  );
  target(db, user, text(input.assigneeId, "Người thực hiện", 1, 100));
  const recipient = text(input.recipient?.trim(), "Nơi nhận", 1, 200);
  const reference = input.referenceNumber
    ? text(input.referenceNumber.trim(), "Số văn bản", 1, 100)
    : null;
  const due = date(input.firstDueDate, "Hạn kỳ đầu");
  const id = randomUUID(),
    now = Date.now();
  transaction(db, () => {
    db.prepare(
      `INSERT INTO report_schedules
      (id,report_type_id,assignee_id,requester_id,recipient,reference_number,next_due_date,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)`,
    ).run(id, type.id, input.assigneeId, user.id, recipient, reference, due, now, now);
    log(db, user, ip, "report_schedule", id, "report.schedule_created", null, {
      reportTypeId: type.id,
      dueDate: due,
    });
  });
  return { id, next_due_date: due };
}

export function updateReportSchedule(db, user, id, input, ip) {
  manager(user, "edit");
  object(input, ["active"]);
  assert(typeof input.active === "boolean", 400, "INVALID_INPUT", "Trạng thái lịch không hợp lệ.");
  const schedule = db.prepare("SELECT * FROM report_schedules WHERE id=?").get(id);
  assert(schedule, 404, "NOT_FOUND", "Không tìm thấy lịch báo cáo.");
  assert(
    schedule.requester_id === user.id || user.role === "A05",
    403,
    "FORBIDDEN",
    "Chỉ người lập lịch được cập nhật.",
  );
  target(db, user, schedule.assignee_id);
  return transaction(db, () => {
    db.prepare("UPDATE report_schedules SET active=?,updated_at=? WHERE id=?").run(
      input.active ? 1 : 0,
      Date.now(),
      id,
    );
    log(
      db,
      user,
      ip,
      "report_schedule",
      id,
      "report.schedule_updated",
      { active: schedule.active },
      { active: input.active ? 1 : 0 },
    );
    return { id, active: input.active ? 1 : 0 };
  });
}
export function generateReportPeriod(db, user, id, ip) {
  manager(user, "create");
  const schedule = db
    .prepare(
      `SELECT s.*,t.name AS type_name,t.cycle,t.warning_days,t.active AS type_active
    FROM report_schedules s JOIN report_types t ON t.id=s.report_type_id WHERE s.id=?`,
    )
    .get(id);
  assert(
    schedule && schedule.active && schedule.type_active,
    404,
    "NOT_FOUND",
    "Không tìm thấy lịch báo cáo đang hoạt động.",
  );
  assert(
    schedule.requester_id === user.id || user.role === "A05",
    403,
    "FORBIDDEN",
    "Chỉ người lập lịch được sinh kỳ.",
  );
  target(db, user, schedule.assignee_id);
  const requestId = randomUUID(),
    now = Date.now(),
    dueDate = schedule.next_due_date;
  assert(
    !db
      .prepare("SELECT 1 FROM report_requests WHERE schedule_id=? AND period_key=?")
      .get(id, dueDate),
    409,
    "PERIOD_EXISTS",
    "Kỳ báo cáo này đã được tạo.",
  );
  const result = transaction(db, () => {
    insertRequest(db, {
      id: requestId,
      type: { id: schedule.report_type_id, warning_days: schedule.warning_days },
      title: `${schedule.type_name} - kỳ ${dueDate}`,
      recipient: schedule.recipient,
      referenceNumber: schedule.reference_number,
      requesterId: user.id,
      assigneeId: schedule.assignee_id,
      dueDate,
      scheduleId: id,
      periodKey: dueDate,
      now,
    });
    db.prepare(
      "UPDATE report_schedules SET next_due_date=?,updated_at=? WHERE id=? AND next_due_date=?",
    ).run(nextDate(dueDate, schedule.cycle), now, id, dueDate);
    log(db, user, ip, "report_schedule", id, "report.period_generated", null, {
      requestId,
      dueDate,
    });
    return { requestId, dueDate };
  });
  return result;
}
export function refreshReportReminders(db, user, now = Date.now()) {
  // Invoked by bell/list polling. Unique keys avoid duplicate reminders across requests.
  if (!user.scopes.length || !user.permissions.includes("M08.view")) return;
  const today = businessDate(now);
  const scope = accountScope(user);
  const rows = db
    .prepare(
      `SELECT r.id,r.title,r.due_date,r.warning_days FROM report_requests r
    JOIN accounts a ON a.id=r.assignee_id WHERE r.assignee_id=? AND r.status='open'
    AND ${scope.sql} AND julianday(r.due_date)-julianday(?)<=r.warning_days`,
    )
    .all(user.id, ...scope.params, today);
  for (const r of rows) {
    const overdue = r.due_date < today;
    notifyUser(db, {
      userId: user.id,
      feature: "M08",
      kind: overdue ? "overdue" : "due_soon",
      title: overdue ? "Báo cáo quá hạn" : "Báo cáo sắp đến hạn",
      body: `${r.title} · hạn ${r.due_date}`,
      targetPath: `/bao-cao/${r.id}`,
      objectId: r.id,
      dedupeKey: `report:${r.id}:${overdue ? "overdue" : "due_soon"}:${today}`,
    });
  }
}
