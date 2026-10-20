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

const taskColumns = `t.id,t.code,t.title,t.description,t.status,t.kind,t.due_at,t.progress,t.updated_at,t.created_at,
  t.assigned_by,t.assigned_to,
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

export function listTaskProgressHistory(db, user, id, url) {
  taskDetail(db, user, id);
  const { page, pageSize } = pagination(url);
  const where = "l.object_type='task' AND l.object_id=? AND l.action='task.progress_updated'";
  return {
    items: db
      .prepare(
        `SELECT l.id,l.actor_id,a.full_name AS actor_name,l.before_json,l.after_json,l.occurred_at
      FROM audit_logs l LEFT JOIN accounts a ON a.id=l.actor_id WHERE ${where}
      ORDER BY l.occurred_at DESC,l.id DESC LIMIT ? OFFSET ?`,
      )
      .all(id, pageSize, (page - 1) * pageSize)
      .map((row) => ({
        ...row,
        before: JSON.parse(row.before_json),
        after: JSON.parse(row.after_json),
        before_json: undefined,
        after_json: undefined,
      })),
    total: db.prepare(`SELECT count(*) AS n FROM audit_logs l WHERE ${where}`).get(id).n,
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

export function listTasks(db, user, url) {
  requireTaskPermission(user);
  const { page, pageSize } = pagination(url);
  const params = [user.id, user.id];
  const where = "t.assigned_by=? OR t.assigned_to=?";
  return {
    items: db
      .prepare(
        `SELECT ${taskColumns} FROM ${taskJoins} WHERE ${where}
      ORDER BY t.created_at DESC,t.id DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize),
    total: db.prepare(`SELECT count(*) AS n FROM tasks t WHERE ${where}`).get(...params).n,
    page,
    pageSize,
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
