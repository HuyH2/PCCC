import { randomUUID } from "node:crypto";
import { assert } from "../../core/errors.js";
import { object, pagination, text } from "../../core/validation.js";
import { transaction } from "../../core/database.js";
import { accountScope, requireAdministrator } from "../authorization/authorization.service.js";
import { writeAudit } from "../audit/audit.service.js";

/** Shared notification writer. Call it inside the caller's business transaction. */
export function notifyUser(
  db,
  { userId, feature, kind, title, body, targetPath = null, objectId = null, dedupeKey = null },
) {
  text(userId, "Người nhận", 1, 100);
  text(feature, "Phân hệ", 1, 30);
  text(kind, "Loại thông báo", 1, 50);
  text(title, "Tiêu đề", 1, 200);
  text(body, "Nội dung", 1, 1000);
  assert(
    targetPath === null || /^\/[a-zA-Z0-9/_-]+$/.test(targetPath),
    400,
    "INVALID_INPUT",
    "Đường dẫn thông báo không hợp lệ.",
  );
  const id = randomUUID();
  db.prepare(
    `INSERT OR IGNORE INTO notifications
    (id,user_id,feature,kind,title,body,target_path,object_id,dedupe_key,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).run(id, userId, feature, kind, title, body, targetPath, objectId, dedupeKey, Date.now());
  return id;
}

export function createNotification(db, user, input, ip) {
  requireAdministrator(user, "M01.edit");
  object(input, ["userId", "feature", "kind", "title", "body", "targetPath", "objectId"]);
  const account = db
    .prepare("SELECT id FROM accounts WHERE id=? AND status='active'")
    .get(input.userId);
  assert(account, 400, "INVALID_RECIPIENT", "Người nhận không tồn tại hoặc đã bị khóa.");
  return transaction(db, () => {
    const id = notifyUser(db, {
      userId: input.userId,
      feature: input.feature,
      kind: input.kind,
      title: input.title,
      body: input.body,
      targetPath: input.targetPath,
      objectId: input.objectId,
    });
    writeAudit(db, {
      actorId: user.id,
      feature: "M10",
      objectType: "notification",
      objectId: id,
      action: "notification.created",
      after: { userId: input.userId, kind: input.kind },
      ip,
    });
    return { id };
  });
}

export function listNotifications(db, user, url) {
  const { page, pageSize } = pagination(url);
  const unread = url.searchParams.get("unread") === "1";
  const visible = notificationVisibility(user);
  const where = `n.user_id=? AND ${visible.sql}${unread ? " AND n.read_at IS NULL" : ""}`;
  const params = [user.id, ...visible.params];
  return {
    items: db
      .prepare(
        `SELECT n.id,n.feature,n.kind,n.title,n.body,n.target_path,n.object_id,n.created_at,n.read_at
      FROM notifications n WHERE ${where} ORDER BY n.created_at DESC,n.id DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize),
    total: db.prepare(`SELECT count(*) AS n FROM notifications n WHERE ${where}`).get(...params).n,
    unreadCount: db
      .prepare(
        `SELECT count(*) AS n FROM notifications n WHERE n.user_id=? AND n.read_at IS NULL AND ${visible.sql}`,
      )
      .get(user.id, ...visible.params).n,
    page,
    pageSize,
  };
}

function notificationVisibility(user) {
  if (!user.permissions.includes("M08.view") || user.scopes.length === 0)
    return { sql: "n.feature <> 'M08'", params: [] };
  const scope = accountScope(user);
  return {
    sql: `(n.feature <> 'M08' OR EXISTS (
    SELECT 1 FROM report_requests r JOIN accounts a ON a.id=r.assignee_id
    WHERE r.id=n.object_id AND ${scope.sql}))`,
    params: scope.params,
  };
}

export function markNotificationRead(db, user, id) {
  const visible = notificationVisibility(user);
  const row = db
    .prepare(`SELECT n.id FROM notifications n WHERE n.id=? AND n.user_id=? AND ${visible.sql}`)
    .get(id, user.id, ...visible.params);
  assert(row, 404, "NOT_FOUND", "Không tìm thấy thông báo.");
  db.prepare("UPDATE notifications SET read_at=coalesce(read_at,?) WHERE id=? AND user_id=?").run(
    Date.now(),
    id,
    user.id,
  );
  return { id, read: true };
}

export function markAllNotificationsRead(db, user) {
  const visible = notificationVisibility(user);
  const result = db
    .prepare(
      `UPDATE notifications AS n SET read_at=? WHERE n.user_id=? AND n.read_at IS NULL AND ${visible.sql}`,
    )
    .run(Date.now(), user.id, ...visible.params);
  return { updated: result.changes };
}
