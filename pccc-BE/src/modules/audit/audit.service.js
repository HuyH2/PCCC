import { requireAdministrator } from "../authorization/authorization.service.js";
import { assert } from "../../core/errors.js";
import { pagination, text } from "../../core/validation.js";

// Shared writer: callers must pass business snapshots, never request bodies or credentials.
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/password|token|secret|cookie|file_data|contentBase64/i.test(key))
        .map(([key, entry]) => [key, redact(entry)]),
    );
  return value;
}

export async function writeAudit(
  db,
  {
    actorId = null,
    feature,
    objectType,
    objectId = null,
    action,
    before = null,
    after = null,
    ip = "unknown",
  },
) {
  text(feature, "Chức năng", 1, 100);
  text(objectType, "Loại đối tượng", 1, 100);
  text(action, "Thao tác", 1, 100);
  const result = await db
    .prepare(
      `INSERT INTO audit_logs(actor_id,action,object_id,before_json,after_json,occurred_at,ip,feature,object_type)
    VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`,
    )
    .run(
      actorId,
      action,
      objectId,
      before == null ? null : JSON.stringify(redact(before)),
      after == null ? null : JSON.stringify(redact(after)),
      Date.now(),
      ip,
      feature,
      objectType,
    );
  return Number(result.lastInsertRowid);
}

// Backward-compatible signature for authentication and authorization features.
export async function audit(db, actor, action, object, before, after, ip) {
  await writeAudit(db, {
    actorId: actor,
    feature: action.startsWith("auth.") ? "M01.auth" : "M01.authorization",
    objectType: action.includes("role_permissions") ? "role" : "account",
    objectId: object,
    action,
    before,
    after,
    ip,
  });
}

export async function listAuditLogs(db, user, url) {
  requireAdministrator(user, "M01.view");
  const { page, pageSize } = pagination(url);
  const clauses = [];
  const params = [];
  for (const [key, column] of Object.entries({
    actorId: "l.actor_id",
    action: "l.action",
    objectId: "l.object_id",
    objectType: "l.object_type",
  })) {
    const value = url.searchParams.get(key);
    if (value) {
      text(value, key, 1, 128);
      clauses.push(`${column}=?`);
      params.push(value);
    }
  }
  // Older rows retain their original content; classify them without mutating history.
  const featureSql = `CASE WHEN l.feature='system' AND l.action LIKE 'auth.%' THEN 'M01.auth'
    WHEN l.feature='system' AND l.action LIKE 'authorization.%' THEN 'M01.authorization' ELSE l.feature END`;
  const feature = url.searchParams.get("feature");
  if (feature) {
    text(feature, "Chức năng", 1, 100);
    clauses.push(`(${featureSql})=?`);
    params.push(feature);
  }
  const bounds = {};
  for (const key of ["from", "to"]) {
    const value = url.searchParams.get(key);
    if (!value) continue;
    assert(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value) &&
        Number.isFinite(Date.parse(value)) &&
        new Date(value.slice(0, 10)).toISOString().slice(0, 10) === value.slice(0, 10),
      400,
      "INVALID_INPUT",
      "Thời gian cần có múi giờ ISO 8601.",
    );
    bounds[key] = Date.parse(value);
    clauses.push(`l.occurred_at ${key === "from" ? ">=" : "<="} ?`);
    params.push(bounds[key]);
  }
  assert(
    bounds.from == null || bounds.to == null || bounds.from <= bounds.to,
    400,
    "INVALID_INPUT",
    "Khoảng thời gian không hợp lệ.",
  );
  const where = clauses.length ? clauses.join(" AND ") : "1=1";
  return {
    items: await db
      .prepare(
        `SELECT l.*, (${featureSql}) AS feature, a.full_name AS actor_name, a.username AS actor_username
      FROM audit_logs l LEFT JOIN accounts a ON a.id=l.actor_id WHERE ${where}
      ORDER BY l.occurred_at DESC,l.id DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize),
    total: (
      await db.prepare(`SELECT count(*) AS n FROM audit_logs l WHERE ${where}`).get(...params)
    ).n,
    page,
    pageSize,
  };
}
