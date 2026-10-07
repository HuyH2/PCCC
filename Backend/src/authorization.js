import { assert } from "./errors.js";

export function permissionsFor(db, role) {
  return db
    .prepare(
      "SELECT permission_code FROM role_permissions WHERE role_code=? ORDER BY permission_code",
    )
    .all(role)
    .map((r) => r.permission_code);
}

export function scopesFor(db, accountId) {
  return db
    .prepare(
      "SELECT kind,unit_id,region_id,facility_id FROM account_scopes WHERE account_id=? ORDER BY id",
    )
    .all(accountId)
    .map((s) => ({ kind: s.kind, targetId: s.unit_id ?? s.region_id ?? s.facility_id ?? null }));
}

export function requirePermission(principal, permission) {
  assert(
    !principal.mustChangePassword,
    403,
    "PASSWORD_CHANGE_REQUIRED",
    "Vui lòng đổi mật khẩu trước khi truy cập chức năng.",
  );
  assert(
    principal.permissions.includes(permission),
    403,
    "FORBIDDEN",
    "Bạn không có quyền thực hiện thao tác này.",
  );
}

export function requireAdministrator(principal, permission = "M01.edit") {
  requirePermission(principal, permission);
  assert(
    principal.role === "A05" && principal.scopes.some((s) => s.kind === "all"),
    403,
    "FORBIDDEN",
    "Chỉ quản trị hệ thống có phạm vi toàn hệ thống được cấu hình quyền.",
  );
}

/** Filter at SQL level, before count, pagination or detail lookup. Empty scope denies all. */
export function facilityScope(principal) {
  if (principal.scopes.some((s) => s.kind === "all")) return { sql: "1=1", params: [] };
  const clauses = [];
  const params = [];
  for (const scope of principal.scopes) {
    if (scope.kind === "facility") clauses.push("f.id=?");
    else if (scope.kind === "region") clauses.push("f.region_id=?");
    else if (scope.kind === "unit")
      clauses.push(`f.region_id IN (SELECT id FROM regions WHERE unit_id IN (
      WITH RECURSIVE descendants(id) AS (SELECT id FROM units WHERE id=? UNION SELECT u.id FROM units u JOIN descendants d ON u.parent_id=d.id)
      SELECT id FROM descendants))`);
    else continue;
    params.push(scope.targetId);
  }
  return { sql: clauses.length ? `(${clauses.join(" OR ")})` : "0=1", params };
}
