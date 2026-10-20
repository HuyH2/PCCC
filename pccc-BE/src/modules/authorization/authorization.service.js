import { assert } from "../../core/errors.js";

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

const unitDescendants = `WITH RECURSIVE descendants(id) AS (SELECT id FROM units WHERE id=?
  UNION SELECT child.id FROM units child JOIN descendants d ON child.parent_id=d.id)
  SELECT id FROM descendants`;

/** Filter at SQL level, before count, pagination or detail lookup. Empty scope denies all. */
function scopeFilter(principal, clauseForKind) {
  if (principal.scopes.some((s) => s.kind === "all")) return { sql: "1=1", params: [] };
  const clauses = [];
  const params = [];
  for (const scope of principal.scopes) {
    const clause = clauseForKind[scope.kind];
    if (!clause) continue;
    clauses.push(clause);
    params.push(scope.targetId);
  }
  return { sql: clauses.length ? `(${clauses.join(" OR ")})` : "0=1", params };
}

/** Facilities on alias f (facilities or facility_overview). */
export function facilityScope(principal) {
  return scopeFilter(principal, {
    facility: "f.id=?",
    region: "f.region_id=?",
    unit: `f.region_id IN (SELECT id FROM regions WHERE unit_id IN (${unitDescendants}))`,
  });
}

/** Regions on alias r: the regions that contain the caller's facilities. */
export function regionScope(principal) {
  return scopeFilter(principal, {
    facility: "r.id IN (SELECT region_id FROM facilities WHERE id=?)",
    region: "r.id=?",
    unit: `r.unit_id IN (${unitDescendants})`,
  });
}

/** Units on alias u: only unit-level grants expose units (and their sub-units). */
export function unitScope(principal) {
  return scopeFilter(principal, { unit: `u.id IN (${unitDescendants})` });
}

/**
 * Accounts on alias a: an account is visible when one of its direct scopes is inside the
 * caller's scope. Accounts with an `all` scope are only visible to callers that also have
 * `all`, so unit/region commanders cannot enumerate system administrators.
 */
export function accountScope(principal) {
  if (principal.scopes.some((s) => s.kind === "all")) return { sql: "1=1", params: [] };
  const clauses = [];
  const params = [];
  for (const scope of principal.scopes) {
    if (scope.kind === "unit") {
      clauses.push(`(
        a.id IN (SELECT s.account_id FROM account_scopes s
          WHERE s.kind='unit' AND s.unit_id IN (${unitDescendants}))
        OR a.id IN (SELECT s.account_id FROM account_scopes s
          WHERE s.kind='region' AND s.region_id IN
            (SELECT id FROM regions WHERE unit_id IN (${unitDescendants})))
        OR a.id IN (SELECT s.account_id FROM account_scopes s
          WHERE s.kind='facility' AND s.facility_id IN
            (SELECT id FROM facilities WHERE region_id IN
              (SELECT id FROM regions WHERE unit_id IN (${unitDescendants}))))
      )`);
      params.push(scope.targetId, scope.targetId, scope.targetId);
    } else if (scope.kind === "region") {
      clauses.push(`(
        a.id IN (SELECT s.account_id FROM account_scopes s
          WHERE s.kind='region' AND s.region_id=?)
        OR a.id IN (SELECT s.account_id FROM account_scopes s
          WHERE s.kind='facility' AND s.facility_id IN
            (SELECT id FROM facilities WHERE region_id=?))
      )`);
      params.push(scope.targetId, scope.targetId);
    } else if (scope.kind === "facility") {
      clauses.push(
        `a.id IN (SELECT s.account_id FROM account_scopes s
          WHERE s.kind='facility' AND s.facility_id=?)`,
      );
      params.push(scope.targetId);
    }
  }
  return { sql: clauses.length ? `(${clauses.join(" OR ")})` : "0=1", params };
}
