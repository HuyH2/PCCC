import { assert } from "../../core/errors.js";
import { randomUUID } from "node:crypto";
import { transaction } from "../../core/database.js";
import { object, pagination, text } from "../../core/validation.js";
import {
  regionScope,
  requirePermission,
  scopesFor,
} from "../authorization/authorization.service.js";
import { writeAudit } from "../audit/audit.service.js";
import { businessDate } from "../../core/time.js";

const taskColumns = `t.id,t.code,t.title,t.description,t.status,t.kind,t.due_at,t.progress,
  t.completed_at,t.updated_at,t.created_at,t.assigned_by,t.assigned_to,
  sender.full_name AS assigner_name,receiver.full_name AS assignee_name`;
const taskJoins = `tasks t JOIN accounts sender ON sender.id=t.assigned_by
  JOIN accounts receiver ON receiver.id=t.assigned_to`;
const messageColumns = `m.id,m.task_id,m.sender_id,a.full_name AS sender_name,
  a.username AS sender_username,m.body,m.created_at,m.edited_at,m.deleted_at`;

function requireTaskPermission(user, action = "view") {
  requirePermission(user, "M07.view");
  if (action !== "view") requirePermission(user, `M07.${action}`);
  assert(user.scopes.length > 0, 403, "FORBIDDEN", "Tài khoản chưa có phạm vi quản lý.");
}

function requireAssignmentPermission(user) {
  requireTaskPermission(user, "create");
  assert(
    ["A01", "A02", "A05"].includes(user.role),
    403,
    "FORBIDDEN",
    "Bạn không có quyền giao việc.",
  );
  assert(
    user.scopes.some((scope) => scope.kind === "all" || scope.kind === "unit"),
    403,
    "FORBIDDEN",
    "Cần phạm vi đơn vị hoặc toàn hệ thống để giao việc.",
  );
}

function reachableRegions(db, scopes) {
  const principal = { scopes };
  const filter = regionScope(principal);
  return new Set(
    db
      .prepare(`SELECT r.id FROM regions r WHERE ${filter.sql}`)
      .all(...filter.params)
      .map((r) => r.id),
  );
}

export function listTaskAssignees(db, user) {
  requireAssignmentPermission(user);
  const ownAll = user.scopes.some((scope) => scope.kind === "all");
  const regions = ownAll ? null : reachableRegions(db, user.scopes);
  const accounts = db
    .prepare(
      `SELECT a.id,a.full_name,a.username,a.role_code FROM accounts a
    JOIN role_permissions rp ON rp.role_code=a.role_code AND rp.permission_code='M07.view'
    WHERE a.status='active' AND a.id<>? AND EXISTS
      (SELECT 1 FROM account_scopes s WHERE s.account_id=a.id)
    ORDER BY a.full_name,a.id`,
    )
    .all(user.id);
  return {
    items: accounts.filter((account) => {
      if (ownAll) return true;
      const candidateScopes = scopesFor(db, account.id);
      if (candidateScopes.some((scope) => scope.kind === "all")) return true;
      const candidateRegions = reachableRegions(db, candidateScopes);
      return [...candidateRegions].some((region) => regions.has(region));
    }),
  };
}

export function createTask(db, user, input, ip) {
  requireAssignmentPermission(user);
  object(input, ["title", "description", "kind", "dueDate", "assigneeId"]);
  const title = text(
    typeof input.title === "string" ? input.title.trim() : input.title,
    "Tên công việc",
    1,
    200,
  );
  const description = text(
    typeof input.description === "string" ? input.description.trim() : input.description,
    "Mô tả",
    1,
    4000,
  );
  const assigneeId = text(input.assigneeId, "Cán bộ thực hiện", 1, 100);
  assert(
    ["routine", "unscheduled", "assigned"].includes(input.kind),
    400,
    "INVALID_INPUT",
    "Loại công việc không hợp lệ.",
  );
  assert(
    typeof input.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate),
    400,
    "INVALID_INPUT",
    "Hạn hoàn thành không hợp lệ.",
  );
  const dueAt = Date.parse(`${input.dueDate}T23:59:59.999+07:00`);
  assert(
    Number.isFinite(dueAt) &&
      new Date(dueAt + 7 * 60 * 60 * 1000).toISOString().slice(0, 10) === input.dueDate,
    400,
    "INVALID_INPUT",
    "Hạn hoàn thành không hợp lệ.",
  );
  assert(
    listTaskAssignees(db, user).items.some((account) => account.id === assigneeId),
    403,
    "FORBIDDEN",
    "Cán bộ không thuộc phạm vi giao việc hoặc không hoạt động.",
  );
  return transaction(db, () => {
    const now = Date.now();
    const id = randomUUID();
    const code = `CV-${id.slice(0, 13).toUpperCase()}`;
    db.prepare(
      `INSERT INTO tasks
      (id,code,title,description,assigned_by,assigned_to,status,kind,due_at,progress,created_at,updated_at)
      VALUES (?,?,?,?,?,?,'open',?,?,0,?,?)`,
    ).run(id, code, title, description, user.id, assigneeId, input.kind, dueAt, now, now);
    db.prepare(
      `INSERT INTO task_assignments(task_id,assignee_id,assigned_by,assigned_at,note)
      VALUES (?,?,?,?,?)`,
    ).run(id, assigneeId, user.id, now, "Giao việc");
    writeAudit(db, {
      actorId: user.id,
      feature: "M07",
      objectType: "task",
      objectId: id,
      action: "task.created",
      after: { title, assigneeId, kind: input.kind, dueAt },
      ip,
    });
    return taskDetail(db, user, id);
  });
}

export function updateTaskProgress(db, user, id, input, ip) {
  requireTaskPermission(user, "edit");
  const { task } = taskDetail(db, user, id);
  assert(
    task.assigned_to === user.id,
    403,
    "FORBIDDEN",
    "Chỉ người thực hiện được cập nhật tiến độ.",
  );
  assert(task.status === "open", 409, "TASK_CLOSED", "Công việc đã đóng.");
  object(input, ["progress", "note"]);
  assert(
    Number.isInteger(input.progress) && input.progress >= 0 && input.progress <= 100,
    400,
    "INVALID_INPUT",
    "Tiến độ phải là số nguyên từ 0 đến 100.",
  );
  const note =
    input.note === undefined
      ? ""
      : text(typeof input.note === "string" ? input.note.trim() : input.note, "Ghi chú", 0, 1000);
  assert(
    task.progress !== input.progress || note.length > 0,
    409,
    "NO_CHANGE",
    "Tiến độ không thay đổi.",
  );
  return transaction(db, () => {
    const now = Date.now();
    const changed = db
      .prepare(
        "UPDATE tasks SET progress=?,updated_at=? WHERE id=? AND progress=? AND status='open'",
      )
      .run(input.progress, now, id, task.progress);
    assert(changed.changes === 1, 409, "TASK_CHANGED", "Công việc đã thay đổi. Hãy tải lại.");
    db.prepare(
      `INSERT INTO task_progress(task_id,account_id,progress,status,note,created_at)
      VALUES (?,?,?,'open',?,?)`,
    ).run(id, user.id, input.progress, note || null, now);
    writeAudit(db, {
      actorId: user.id,
      feature: "M07",
      objectType: "task",
      objectId: id,
      action: "task.progress_updated",
      before: { progress: task.progress },
      after: { progress: input.progress, note },
      ip,
    });
    return taskDetail(db, user, id);
  });
}

export function updateTaskStatus(db, user, id, input, ip) {
  requireTaskPermission(user, "edit");
  const { task } = taskDetail(db, user, id);
  object(input, ["status", "note"]);
  const status = input.status;
  assert(
    ["open", "completed", "cancelled"].includes(status),
    400,
    "INVALID_INPUT",
    "Trạng thái công việc không hợp lệ.",
  );
  assert(task.status !== status, 409, "NO_CHANGE", "Trạng thái công việc không thay đổi.");
  const isAssignee = task.assigned_to === user.id;
  const isAssigner = task.assigned_by === user.id;
  if (status === "completed") {
    assert(
      isAssignee || isAssigner,
      403,
      "FORBIDDEN",
      "Chỉ người thực hiện hoặc người giao được hoàn thành công việc.",
    );
    assert(task.status === "open", 409, "TASK_CLOSED", "Công việc đã đóng.");
  } else {
    assert(isAssigner, 403, "FORBIDDEN", "Chỉ người giao được hủy hoặc mở lại công việc.");
    if (status === "cancelled")
      assert(task.status === "open", 409, "TASK_CLOSED", "Chỉ hủy được công việc đang mở.");
  }
  const note =
    input.note === undefined
      ? ""
      : text(typeof input.note === "string" ? input.note.trim() : input.note, "Ghi chú", 0, 1000);
  return transaction(db, () => {
    const now = Date.now();
    const nextProgress = status === "completed" ? 100 : task.progress;
    const completedAt = status === "completed" ? now : null;
    const changed = db
      .prepare(
        `UPDATE tasks SET status=?,progress=?,completed_at=?,updated_at=?
        WHERE id=? AND status=?`,
      )
      .run(status, nextProgress, completedAt, now, id, task.status);
    assert(changed.changes === 1, 409, "TASK_CHANGED", "Công việc đã thay đổi. Hãy tải lại.");
    const defaultNote =
      status === "completed"
        ? "Hoàn thành công việc"
        : status === "cancelled"
          ? "Hủy công việc"
          : "Mở lại công việc";
    db.prepare(
      `INSERT INTO task_progress(task_id,account_id,progress,status,note,created_at)
      VALUES (?,?,?,?,?,?)`,
    ).run(id, user.id, nextProgress, status, note || defaultNote, now);
    writeAudit(db, {
      actorId: user.id,
      feature: "M07",
      objectType: "task",
      objectId: id,
      action: "task.status_changed",
      before: { status: task.status, progress: task.progress },
      after: { status, progress: nextProgress, note },
      ip,
    });
    return taskDetail(db, user, id);
  });
}

export function listTaskProgressHistory(db, user, id, url) {
  taskDetail(db, user, id);
  const { page, pageSize } = pagination(url);
  const where = "tp.task_id=?";
  const rows = db
    .prepare(
      `SELECT tp.id,tp.account_id,a.full_name AS actor_name,tp.progress,tp.status,tp.note,
        tp.created_at AS occurred_at,
        LAG(tp.progress,1,0) OVER (ORDER BY tp.created_at,tp.id) AS before_progress
      FROM task_progress tp JOIN accounts a ON a.id=tp.account_id
      WHERE ${where}
      ORDER BY tp.created_at DESC,tp.id DESC LIMIT ? OFFSET ?`,
    )
    .all(id, pageSize, (page - 1) * pageSize)
    .map((row) => ({
      id: row.id,
      account_id: row.account_id,
      actor_name: row.actor_name,
      occurred_at: row.occurred_at,
      status: row.status,
      before: { progress: row.before_progress },
      after: { progress: row.progress, note: row.note ?? "" },
    }));
  return {
    items: rows,
    total: db.prepare("SELECT count(*) AS n FROM task_progress tp WHERE tp.task_id=?").get(id).n,
    page,
    pageSize,
  };
}

export function taskDetail(db, user, id) {
  requireTaskPermission(user);
  const task = db
    .prepare(
      `SELECT ${taskColumns} FROM ${taskJoins}
    WHERE t.id=? AND (t.assigned_by=? OR t.assigned_to=?)`,
    )
    .get(id, user.id, user.id);
  assert(task, 404, "NOT_FOUND", "Không tìm thấy công việc trong phạm vi tham gia.");
  return { task };
}

function dateBoundary(value, field) {
  assert(
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value),
    400,
    "INVALID_INPUT",
    `${field} không hợp lệ.`,
  );
  const epoch = Date.parse(`${value}T00:00:00+07:00`);
  const calendar = Date.parse(`${value}T00:00:00Z`);
  assert(
    Number.isFinite(epoch) &&
      Number.isFinite(calendar) &&
      new Date(calendar).toISOString().slice(0, 10) === value,
    400,
    "INVALID_INPUT",
    `${field} không hợp lệ.`,
  );
  return epoch;
}

export function listTasks(db, user, url, forcedView = "") {
  requireTaskPermission(user);
  const { page, pageSize } = pagination(url);
  const view = forcedView || url.searchParams.get("view") || "all";
  assert(
    ["all", "mine", "assigned"].includes(view),
    400,
    "INVALID_INPUT",
    "Bộ lọc công việc không hợp lệ.",
  );
  const conditions = [
    view === "mine"
      ? "t.assigned_to=?"
      : view === "assigned"
        ? "t.assigned_by=?"
        : "(t.assigned_by=? OR t.assigned_to=?)",
  ];
  const params = view === "all" ? [user.id, user.id] : [user.id];
  const status = url.searchParams.get("status");
  if (status) {
    assert(
      ["open", "completed", "cancelled"].includes(status),
      400,
      "INVALID_INPUT",
      "Trạng thái lọc không hợp lệ.",
    );
    conditions.push("t.status=?");
    params.push(status);
  }
  const assigneeId = url.searchParams.get("assigneeId");
  if (assigneeId) {
    conditions.push("t.assigned_to=?");
    params.push(assigneeId);
  }
  const from = url.searchParams.get("from");
  if (from) {
    conditions.push("t.due_at>=?");
    params.push(dateBoundary(from, "Từ ngày"));
  }
  const to = url.searchParams.get("to");
  if (to) {
    conditions.push("t.due_at<?");
    params.push(dateBoundary(to, "Đến ngày") + 86400000);
  }
  const deadline = url.searchParams.get("deadline");
  if (deadline) {
    assert(["overdue", "week"].includes(deadline), 400, "INVALID_INPUT", "Hạn lọc không hợp lệ.");
    const todayStart = Date.parse(`${businessDate()}T00:00:00+07:00`);
    conditions.push("t.status='open' AND t.due_at IS NOT NULL");
    if (deadline === "overdue") conditions.push("t.due_at<?");
    else conditions.push("t.due_at>=? AND t.due_at<?");
    params.push(todayStart);
    if (deadline === "week") params.push(todayStart + 7 * 86400000);
  }
  const where = conditions.join(" AND ");
  const order =
    url.searchParams.get("sort") === "due" ? "t.due_at ASC,t.id" : "t.created_at DESC,t.id DESC";
  return {
    items: db
      .prepare(
        `SELECT ${taskColumns} FROM ${taskJoins} WHERE ${where}
      ORDER BY ${order} LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize),
    total: db.prepare(`SELECT count(*) AS n FROM tasks t WHERE ${where}`).get(...params).n,
    page,
    pageSize,
    view,
  };
}

function messageDetail(db, taskId, id) {
  const message = db
    .prepare(
      `SELECT ${messageColumns}
    FROM task_messages m JOIN accounts a ON a.id=m.sender_id
    WHERE m.task_id=? AND m.id=?`,
    )
    .get(taskId, id);
  assert(message, 404, "NOT_FOUND", "Không tìm thấy tin nhắn.");
  return message;
}

function visibleMessage(message) {
  return { ...message, body: message.deleted_at === null ? message.body : null };
}

export function listTaskMessages(db, user, taskId, url) {
  taskDetail(db, user, taskId);
  const { page, pageSize } = pagination(url);
  // Page 1 is the newest window; each returned window reads oldest to newest.
  const items = db
    .prepare(
      `SELECT ${messageColumns}
    FROM task_messages m JOIN accounts a ON a.id=m.sender_id
    WHERE m.task_id=? ORDER BY m.created_at DESC,m.id DESC LIMIT ? OFFSET ?`,
    )
    .all(taskId, pageSize, (page - 1) * pageSize)
    .reverse()
    .map(visibleMessage);
  return {
    items,
    total: db.prepare("SELECT count(*) AS n FROM task_messages WHERE task_id=?").get(taskId).n,
    page,
    pageSize,
  };
}

function validatedBody(input) {
  object(input, ["body"]);
  return text(
    typeof input.body === "string" ? input.body.trim() : input.body,
    "Nội dung tin nhắn",
    1,
    2000,
  );
}

export function sendTaskMessage(db, user, taskId, input, ip) {
  requireTaskPermission(user, "create");
  const { task } = taskDetail(db, user, taskId);
  assert(task.status === "open", 409, "TASK_CLOSED", "Công việc đã đóng, không thể gửi tin nhắn.");
  const body = validatedBody(input);
  return transaction(db, () => {
    const now = Date.now();
    const result = db
      .prepare(
        `INSERT INTO task_messages(task_id,sender_id,body,created_at)
      VALUES (?,?,?,?)`,
      )
      .run(taskId, user.id, body, now);
    const id = Number(result.lastInsertRowid);
    writeAudit(db, {
      actorId: user.id,
      feature: "M07",
      objectType: "task_message",
      objectId: String(id),
      action: "task_message.sent",
      after: { taskId },
      ip,
    });
    return { message: visibleMessage(messageDetail(db, taskId, id)) };
  });
}

function editableMessage(db, user, taskId, id) {
  requireTaskPermission(user, "edit");
  const { task } = taskDetail(db, user, taskId);
  assert(task.status === "open", 409, "TASK_CLOSED", "Công việc đã đóng, không thể sửa tin nhắn.");
  const message = messageDetail(db, taskId, id);
  assert(
    message.sender_id === user.id,
    403,
    "FORBIDDEN",
    "Chỉ người gửi được sửa hoặc xóa tin nhắn.",
  );
  assert(message.deleted_at === null, 409, "MESSAGE_DELETED", "Tin nhắn đã được xóa.");
  return message;
}

export function editTaskMessage(db, user, taskId, id, input, ip) {
  const previous = editableMessage(db, user, taskId, id);
  const body = validatedBody(input);
  assert(body !== previous.body, 409, "NO_CHANGE", "Nội dung tin nhắn không thay đổi.");
  return transaction(db, () => {
    const changed = db
      .prepare(
        `UPDATE task_messages SET body=?,edited_at=?
      WHERE id=? AND task_id=? AND sender_id=? AND deleted_at IS NULL`,
      )
      .run(body, Date.now(), id, taskId, user.id);
    assert(changed.changes === 1, 409, "MESSAGE_CHANGED", "Tin nhắn đã thay đổi. Hãy tải lại.");
    writeAudit(db, {
      actorId: user.id,
      feature: "M07",
      objectType: "task_message",
      objectId: String(id),
      action: "task_message.edited",
      after: { taskId },
      ip,
    });
    return { message: visibleMessage(messageDetail(db, taskId, id)) };
  });
}

export function deleteTaskMessage(db, user, taskId, id, ip) {
  editableMessage(db, user, taskId, id);
  return transaction(db, () => {
    const changed = db
      .prepare(
        `UPDATE task_messages SET deleted_at=?,deleted_by=?
      WHERE id=? AND task_id=? AND sender_id=? AND deleted_at IS NULL`,
      )
      .run(Date.now(), user.id, id, taskId, user.id);
    assert(changed.changes === 1, 409, "MESSAGE_CHANGED", "Tin nhắn đã thay đổi. Hãy tải lại.");
    writeAudit(db, {
      actorId: user.id,
      feature: "M07",
      objectType: "task_message",
      objectId: String(id),
      action: "task_message.deleted",
      after: { taskId },
      ip,
    });
    return { message: visibleMessage(messageDetail(db, taskId, id)) };
  });
}
