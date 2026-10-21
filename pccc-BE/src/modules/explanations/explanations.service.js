import { assert } from "../../core/errors.js";
import { transaction } from "../../core/database.js";
import { object, pagination, text } from "../../core/validation.js";
import { validPeriod } from "../../core/time.js";
import { accountScope, requirePermission } from "../authorization/authorization.service.js";
import { writeAudit } from "../audit/audit.service.js";

function requireExplanationView(user) {
  requirePermission(user, "M07.view");
  assert(user.scopes.length > 0, 403, "FORBIDDEN", "Tài khoản chưa có phạm vi quản lý.");
}

function canRequest(user) {
  return ["A01", "A02", "A05"].includes(user.role) && user.permissions.includes("M07.edit");
}

function visibleAccounts(db, user) {
  if (!canRequest(user)) {
    return db
      .prepare("SELECT id,full_name,username FROM accounts WHERE id=? AND status='active'")
      .all(user.id);
  }
  const scope = accountScope(user);
  return db
    .prepare(
      `SELECT a.id,a.full_name,a.username FROM accounts a
      JOIN role_permissions rp ON rp.role_code=a.role_code AND rp.permission_code='M07.view'
      WHERE a.status='active' AND a.id<>? AND EXISTS
        (SELECT 1 FROM account_scopes s WHERE s.account_id=a.id) AND ${scope.sql}
      ORDER BY a.full_name,a.id`,
    )
    .all(user.id, ...scope.params);
}

function explanationSelect() {
  return `SELECT e.*,a.full_name AS account_name,a.username AS account_username,
    r.full_name AS requester_name,t.code AS task_code,t.title AS task_title,
    v.full_name AS reviewer_name
    FROM explanations e
    JOIN accounts a ON a.id=e.account_id
    JOIN accounts r ON r.id=e.requested_by
    LEFT JOIN tasks t ON t.id=e.task_id
    LEFT JOIN accounts v ON v.id=e.reviewed_by`;
}

function visibleWhere(user) {
  if (user.role === "A05" && user.scopes.some((scope) => scope.kind === "all"))
    return { sql: "1=1", params: [] };
  return { sql: "(e.requested_by=? OR e.account_id=?)", params: [user.id, user.id] };
}

function findVisible(db, user, id) {
  const visibility = visibleWhere(user);
  const row = db
    .prepare(`${explanationSelect()} WHERE e.id=? AND ${visibility.sql}`)
    .get(id, ...visibility.params);
  assert(row, 404, "NOT_FOUND", "Không tìm thấy yêu cầu giải trình.");
  return row;
}

export function listExplanations(db, user, url) {
  requireExplanationView(user);
  const { page, pageSize } = pagination(url);
  const visibility = visibleWhere(user);
  const conditions = [visibility.sql];
  const params = [...visibility.params];
  const status = url.searchParams.get("status");
  if (status) {
    assert(
      ["requested", "submitted", "accepted", "rejected"].includes(status),
      400,
      "INVALID_INPUT",
      "Trạng thái giải trình không hợp lệ.",
    );
    conditions.push("e.status=?");
    params.push(status);
  }
  const period = url.searchParams.get("period");
  if (period) {
    assert(validPeriod(period), 400, "INVALID_INPUT", "Kỳ giải trình phải có dạng YYYY-MM.");
    conditions.push("e.period=?");
    params.push(period);
  }
  const where = conditions.join(" AND ");
  return {
    items: db
      .prepare(
        `${explanationSelect()} WHERE ${where}
        ORDER BY e.requested_at DESC,e.id DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize),
    total: db.prepare(`SELECT count(*) AS n FROM explanations e WHERE ${where}`).get(...params).n,
    page,
    pageSize,
    accounts: canRequest(user) ? visibleAccounts(db, user) : [],
  };
}

export function getExplanation(db, user, id) {
  requireExplanationView(user);
  return { explanation: findVisible(db, user, id) };
}

export function createExplanation(db, user, input, ip) {
  requireExplanationView(user);
  assert(canRequest(user), 403, "FORBIDDEN", "Bạn không có quyền yêu cầu giải trình.");
  object(input, ["accountId", "taskId", "period", "reason"]);
  const accountId = text(input.accountId, "Cán bộ giải trình", 1, 100);
  assert(accountId !== user.id, 400, "INVALID_INPUT", "Không thể tự yêu cầu mình giải trình.");
  const reason = text(
    typeof input.reason === "string" ? input.reason.trim() : input.reason,
    "Lý do yêu cầu",
    1,
    2000,
  );
  const taskId = input.taskId ? text(input.taskId, "Công việc", 1, 100) : null;
  const period = input.period ? text(input.period, "Kỳ KPI", 7, 7) : null;
  assert(taskId || period, 400, "INVALID_INPUT", "Cần chọn công việc hoặc kỳ KPI.");
  if (period) assert(validPeriod(period), 400, "INVALID_INPUT", "Kỳ KPI phải có dạng YYYY-MM.");
  const account = visibleAccounts(db, user).find((item) => item.id === accountId);
  assert(account, 403, "FORBIDDEN", "Cán bộ ngoài phạm vi yêu cầu giải trình.");
  if (taskId) {
    const task = db.prepare("SELECT id,assigned_by,assigned_to FROM tasks WHERE id=?").get(taskId);
    assert(task, 404, "NOT_FOUND", "Không tìm thấy công việc.");
    assert(
      task.assigned_to === accountId,
      400,
      "INVALID_INPUT",
      "Công việc không thuộc cán bộ này.",
    );
    assert(
      user.role === "A05" || task.assigned_by === user.id,
      403,
      "FORBIDDEN",
      "Chỉ người giao việc được yêu cầu giải trình.",
    );
  }
  return transaction(db, () => {
    const now = Date.now();
    const result = db
      .prepare(
        `INSERT INTO explanations
        (task_id,account_id,period,requested_by,reason,status,requested_at)
        VALUES (?,?,?,?,?,'requested',?)`,
      )
      .run(taskId, accountId, period, user.id, reason, now);
    const id = Number(result.lastInsertRowid);
    writeAudit(db, {
      actorId: user.id,
      feature: "M07",
      objectType: "explanation",
      objectId: String(id),
      action: "explanation.requested",
      after: { accountId, taskId, period, reason },
      ip,
    });
    return { explanation: findVisible(db, user, id) };
  });
}

export function submitExplanation(db, user, id, input, ip) {
  requireExplanationView(user);
  const explanation = findVisible(db, user, id);
  assert(
    explanation.account_id === user.id,
    403,
    "FORBIDDEN",
    "Chỉ cán bộ được yêu cầu mới được gửi giải trình.",
  );
  assert(
    explanation.status === "requested",
    409,
    "EXPLANATION_CLOSED",
    "Yêu cầu giải trình đã được phản hồi hoặc đóng.",
  );
  object(input, ["response"]);
  const response = text(
    typeof input.response === "string" ? input.response.trim() : input.response,
    "Nội dung giải trình",
    1,
    4000,
  );
  return transaction(db, () => {
    const now = Date.now();
    const changed = db
      .prepare(
        `UPDATE explanations SET response=?,status='submitted',submitted_at=?
        WHERE id=? AND account_id=? AND status='requested'`,
      )
      .run(response, now, id, user.id);
    assert(changed.changes === 1, 409, "EXPLANATION_CHANGED", "Yêu cầu đã thay đổi. Hãy tải lại.");
    writeAudit(db, {
      actorId: user.id,
      feature: "M07",
      objectType: "explanation",
      objectId: String(id),
      action: "explanation.submitted",
      after: { response },
      ip,
    });
    return { explanation: findVisible(db, user, id) };
  });
}

export function reviewExplanation(db, user, id, input, ip) {
  requireExplanationView(user);
  assert(canRequest(user), 403, "FORBIDDEN", "Bạn không có quyền xử lý giải trình.");
  const explanation = findVisible(db, user, id);
  assert(
    user.role === "A05" || explanation.requested_by === user.id,
    403,
    "FORBIDDEN",
    "Chỉ người yêu cầu hoặc quản trị được xử lý giải trình.",
  );
  assert(
    explanation.status === "submitted",
    409,
    "EXPLANATION_CLOSED",
    "Chỉ giải trình đã gửi mới được xử lý.",
  );
  object(input, ["decision", "note"]);
  const decision = input.decision;
  assert(
    decision === "accepted" || decision === "rejected",
    400,
    "INVALID_INPUT",
    "Quyết định giải trình không hợp lệ.",
  );
  const note =
    input.note === undefined
      ? ""
      : text(typeof input.note === "string" ? input.note.trim() : input.note, "Ghi chú", 0, 1000);
  return transaction(db, () => {
    const now = Date.now();
    const changed = db
      .prepare(
        `UPDATE explanations
        SET status=?,reviewed_by=?,reviewed_at=?,review_note=?,debt_waived=?
        WHERE id=? AND status='submitted'`,
      )
      .run(decision, user.id, now, note, decision === "accepted" && explanation.period ? 1 : 0, id);
    assert(changed.changes === 1, 409, "EXPLANATION_CHANGED", "Yêu cầu đã thay đổi. Hãy tải lại.");
    writeAudit(db, {
      actorId: user.id,
      feature: "M07",
      objectType: "explanation",
      objectId: String(id),
      action: `explanation.${decision}`,
      after: { note, debtWaived: decision === "accepted" && Boolean(explanation.period) },
      ip,
    });
    return { explanation: findVisible(db, user, id) };
  });
}
