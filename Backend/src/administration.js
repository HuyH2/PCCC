import { assert } from "./errors.js";
import { object, text } from "./validation.js";
import { requireAdministrator, permissionsFor, scopesFor } from "./authorization.js";
import { audit } from "./authentication.js";
import { transaction } from "./database.js";

function preserveAdministrator(db) {
  const row = db
    .prepare(
      `SELECT count(*) AS total FROM accounts a JOIN roles r ON r.code=a.role_code
    WHERE a.status='active' AND a.role_code='A05' AND r.enabled=1
    AND EXISTS(SELECT 1 FROM account_scopes s WHERE s.account_id=a.id AND s.kind='all')
    AND EXISTS(SELECT 1 FROM role_permissions p WHERE p.role_code=a.role_code AND p.permission_code='M01.edit')
    AND EXISTS(SELECT 1 FROM role_permissions p WHERE p.role_code=a.role_code AND p.permission_code='M01.view')`,
    )
    .get();
  assert(
    row.total > 0,
    409,
    "LAST_ADMINISTRATOR",
    "Phải giữ ít nhất một quản trị đang hoạt động có quyền cấu hình và phạm vi toàn hệ thống.",
  );
}

export function updateRolePermissions(db, principal, role, payload, ip) {
  requireAdministrator(principal);
  object(payload, ["permissions"]);
  assert(
    db.prepare("SELECT 1 FROM roles WHERE code=? AND enabled=1").get(role),
    404,
    "NOT_FOUND",
    "Không tìm thấy vai trò đang hoạt động.",
  );
  assert(
    Array.isArray(payload.permissions) && payload.permissions.length <= 55,
    400,
    "INVALID_INPUT",
    "Danh sách quyền không hợp lệ.",
  );
  const codes = payload.permissions.map((p) => text(p, "Quyền"));
  assert(new Set(codes).size === codes.length, 400, "INVALID_INPUT", "Quyền không được trùng.");
  for (const code of codes)
    assert(
      db.prepare("SELECT 1 FROM permissions WHERE code=?").get(code),
      400,
      "INVALID_INPUT",
      "Quyền không tồn tại.",
    );
  transaction(db, () => {
    const before = permissionsFor(db, role);
    db.prepare("DELETE FROM role_permissions WHERE role_code=?").run(role);
    for (const code of codes)
      db.prepare("INSERT INTO role_permissions VALUES (?,?)").run(role, code);
    preserveAdministrator(db);
    audit(db, principal.id, "authorization.role_permissions_changed", role, before, codes, ip);
  });
}

export function updateAccountAuthorization(db, principal, id, payload, ip) {
  requireAdministrator(principal);
  object(payload, ["role", "scopes"]);
  text(payload.role, "Vai trò", 3, 3);
  assert(
    db.prepare("SELECT 1 FROM accounts WHERE id=?").get(id),
    404,
    "NOT_FOUND",
    "Không tìm thấy tài khoản.",
  );
  assert(
    db.prepare("SELECT 1 FROM roles WHERE code=? AND enabled=1").get(payload.role),
    400,
    "INVALID_INPUT",
    "Vai trò không tồn tại hoặc chưa kích hoạt.",
  );
  assert(
    Array.isArray(payload.scopes) && payload.scopes.length <= 100,
    400,
    "INVALID_INPUT",
    "Danh sách phạm vi không hợp lệ.",
  );
  const seen = new Set();
  const scopes = payload.scopes.map((scope) => {
    object(scope, ["kind", "targetId"]);
    const tables = { unit: "units", region: "regions", facility: "facilities" };
    assert(
      scope.kind === "all" || Object.hasOwn(tables, scope.kind),
      400,
      "INVALID_INPUT",
      "Loại phạm vi không hợp lệ.",
    );
    if (scope.kind === "all")
      assert(
        scope.targetId == null,
        400,
        "INVALID_INPUT",
        "Phạm vi toàn hệ thống không có targetId.",
      );
    else {
      text(scope.targetId, "Định danh phạm vi");
      assert(
        db.prepare(`SELECT 1 FROM ${tables[scope.kind]} WHERE id=?`).get(scope.targetId),
        400,
        "INVALID_INPUT",
        "Phạm vi không tồn tại.",
      );
    }
    const key = `${scope.kind}:${scope.targetId ?? ""}`;
    assert(!seen.has(key), 400, "INVALID_INPUT", "Phạm vi không được trùng.");
    seen.add(key);
    return { kind: scope.kind, targetId: scope.targetId ?? null };
  });
  assert(
    !scopes.some((s) => s.kind === "all") || scopes.length === 1,
    400,
    "INVALID_INPUT",
    "Phạm vi toàn hệ thống không kết hợp với phạm vi khác.",
  );
  transaction(db, () => {
    const before = {
      role: db.prepare("SELECT role_code FROM accounts WHERE id=?").get(id).role_code,
      scopes: scopesFor(db, id),
    };
    db.prepare("UPDATE accounts SET role_code=? WHERE id=?").run(payload.role, id);
    db.prepare("DELETE FROM account_scopes WHERE account_id=?").run(id);
    for (const s of scopes)
      db.prepare(
        "INSERT INTO account_scopes(account_id,kind,unit_id,region_id,facility_id) VALUES (?,?,?,?,?)",
      ).run(
        id,
        s.kind,
        s.kind === "unit" ? s.targetId : null,
        s.kind === "region" ? s.targetId : null,
        s.kind === "facility" ? s.targetId : null,
      );
    preserveAdministrator(db);
    // Force the affected account to log in again after role/scope changes.
    db.prepare("DELETE FROM sessions WHERE account_id=?").run(id);
    audit(
      db,
      principal.id,
      "authorization.account_changed",
      id,
      before,
      { role: payload.role, scopes },
      ip,
    );
  });
}
