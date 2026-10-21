import { randomUUID } from "node:crypto";
import { assert } from "../../core/errors.js";
import { object, text } from "../../core/validation.js";
import {
  requireAdministrator,
  permissionsFor,
  scopesFor,
} from "../authorization/authorization.service.js";
import { audit, writeAudit } from "../audit/audit.service.js";
import { transaction } from "../../core/database.js";
import { hashPassword } from "../../core/password.js";
import { businessDate } from "../../core/time.js";

export function preserveAdministrator(db) {
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

const SCOPE_TABLES = { unit: "units", region: "regions", facility: "facilities" };

function normalizeScopes(db, value) {
  assert(
    Array.isArray(value) && value.length <= 100,
    400,
    "INVALID_INPUT",
    "Danh sách phạm vi không hợp lệ.",
  );
  const seen = new Set();
  const scopes = value.map((scope) => {
    object(scope, ["kind", "targetId"]);
    assert(
      scope.kind === "all" || Object.hasOwn(SCOPE_TABLES, scope.kind),
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
        db.prepare(`SELECT 1 FROM ${SCOPE_TABLES[scope.kind]} WHERE id=?`).get(scope.targetId),
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
  return scopes;
}

function activeRole(db, role) {
  text(role, "Vai trò", 3, 3);
  assert(
    db.prepare("SELECT 1 FROM roles WHERE code=? AND enabled=1").get(role),
    400,
    "INVALID_INPUT",
    "Vai trò không tồn tại hoặc chưa kích hoạt.",
  );
  return role;
}

function uniqueOfficer(db, officerId, exceptId = "") {
  assert(
    !db.prepare("SELECT 1 FROM accounts WHERE officer_id=? AND id<>?").get(officerId, exceptId),
    409,
    "DUPLICATE_OFFICER",
    "Cán bộ này đã có tài khoản.",
  );
  return officerId;
}

function writeScopes(db, accountId, scopes) {
  db.prepare("DELETE FROM account_scopes WHERE account_id=?").run(accountId);
  for (const scope of scopes)
    db.prepare(
      "INSERT INTO account_scopes(account_id,kind,unit_id,region_id,facility_id) VALUES (?,?,?,?,?)",
    ).run(
      accountId,
      scope.kind,
      scope.kind === "unit" ? scope.targetId : null,
      scope.kind === "region" ? scope.targetId : null,
      scope.kind === "facility" ? scope.targetId : null,
    );
}

export function updateAccountAuthorization(db, principal, id, payload, ip) {
  requireAdministrator(principal);
  object(payload, ["role", "scopes", "fullName", "officerId"]);
  const account = db
    .prepare("SELECT id,full_name,officer_id,role_code FROM accounts WHERE id=?")
    .get(id);
  assert(account, 404, "NOT_FOUND", "Không tìm thấy tài khoản.");
  const role = activeRole(db, payload.role);
  const scopes = normalizeScopes(db, payload.scopes);
  const fullName =
    payload.fullName === undefined
      ? account.full_name
      : text(payload.fullName?.trim(), "Họ tên", 1, 200);
  const officerId =
    payload.officerId === undefined
      ? account.officer_id
      : text(payload.officerId?.trim(), "Mã cán bộ", 1, 64);
  if (officerId !== account.officer_id) {
    uniqueOfficer(db, officerId, id);
    assert(
      !db.prepare("SELECT 1 FROM region_assignments WHERE account_id=?").get(id),
      409,
      "ACCOUNT_ASSIGNED",
      "Cán bộ đang phụ trách khu vực; hãy phân công người khác trước khi đổi mã cán bộ.",
    );
    assert(
      !db.prepare("SELECT 1 FROM facilities WHERE officer_id=?").get(account.officer_id),
      409,
      "ACCOUNT_ASSIGNED",
      "Cán bộ đang phụ trách cơ sở; hãy chuyển giao trước khi đổi mã cán bộ.",
    );
  }
  return transaction(db, () => {
    const before = {
      role: account.role_code,
      fullName: account.full_name,
      officerId: account.officer_id,
      scopes: scopesFor(db, id),
    };
    // A region assignment and its `region` scope are one invariant. Removing that scope
    // through PUT would leave an owner who cannot read the region, so the assignment is
    // removed with an explicit history entry instead of keeping a broken link.
    const assignedRegions = db
      .prepare("SELECT region_id FROM region_assignments WHERE account_id=?")
      .all(id)
      .map((row) => row.region_id);
    const removedRegionIds = scopes.some((scope) => scope.kind === "all")
      ? []
      : assignedRegions.filter(
          (regionId) => !scopes.some((s) => s.kind === "region" && s.targetId === regionId),
        );
    db.prepare("UPDATE accounts SET role_code=?,full_name=?,officer_id=? WHERE id=?").run(
      role,
      fullName,
      officerId,
      id,
    );
    writeScopes(db, id, scopes);
    preserveAdministrator(db);
    // Force the affected account to log in again after role/scope changes.
    db.prepare("DELETE FROM sessions WHERE account_id=?").run(id);
    const auditId = writeAudit(db, {
      actorId: principal.id,
      feature: "M01.authorization",
      objectType: "account",
      objectId: id,
      action: "authorization.account_changed",
      before,
      after: { role, fullName, officerId, scopes, removedRegionIds },
      ip,
    });
    const now = Date.now();
    const effectiveDate = businessDate(now);
    for (const regionId of removedRegionIds) {
      const removed = db
        .prepare("DELETE FROM region_assignments WHERE region_id=? AND account_id=?")
        .run(regionId, id);
      if (!removed.changes) continue;
      db.prepare(
        `INSERT INTO assignment_events
        (region_id,from_account_id,to_account_id,action,reason,effective_date,
          performed_by,occurred_at,audit_log_id)
        VALUES (?,?,NULL,'unassign',?,?,?,?,?)`,
      ).run(
        regionId,
        id,
        "Thu hồi qua cập nhật phạm vi",
        effectiveDate,
        principal.id,
        now,
        auditId,
      );
    }
    return { scopes: scopesFor(db, id), removedRegionIds };
  });
}

const USERNAME = /^[a-z0-9._-]{1,100}$/;

export async function createAccount(db, principal, payload, ip) {
  requireAdministrator(principal);
  object(payload, ["username", "fullName", "officerId", "role", "password", "scopes"]);
  const username = text(payload.username?.trim().toLowerCase(), "Tên đăng nhập", 1, 100);
  assert(USERNAME.test(username), 400, "INVALID_INPUT", "Tên đăng nhập không đúng định dạng.");
  const fullName = text(payload.fullName?.trim(), "Họ tên", 1, 200);
  const officerId = text(payload.officerId?.trim(), "Mã cán bộ", 1, 64);
  const role = activeRole(db, payload.role);
  const password = text(payload.password, "Mật khẩu", 12, 256);
  const scopes = normalizeScopes(db, payload.scopes ?? []);
  assert(
    scopes.length > 0,
    400,
    "SCOPE_REQUIRED",
    "Tài khoản phải có ít nhất một phạm vi (đơn vị/khu vực/cơ sở) để có thể được phân công.",
  );
  const passwordHash = await hashPassword(password);
  const id = `ACC-${randomUUID()}`;
  return transaction(db, () => {
    // Both checks run after the async hash, inside the write transaction, so concurrent
    // requests cannot create duplicate usernames or officer ids.
    uniqueOfficer(db, officerId);
    assert(
      !db.prepare("SELECT 1 FROM accounts WHERE username=?").get(username),
      409,
      "DUPLICATE_USERNAME",
      "Tên đăng nhập đã tồn tại.",
    );
    db.prepare(
      `INSERT INTO accounts(id,username,password_hash,full_name,officer_id,role_code,status,
        must_change_password,created_at) VALUES (?,?,?,?,?,?,'active',1,?)`,
    ).run(id, username, passwordHash, fullName, officerId, role, Date.now());
    writeScopes(db, id, scopes);
    const after = findAccount(db, id);
    writeAudit(db, {
      actorId: principal.id,
      feature: "M01",
      objectType: "account",
      objectId: id,
      action: "account.created",
      after: { ...after, scopes },
      ip,
    });
    return { account: after, scopes: scopesFor(db, id) };
  });
}

const STATUS_ACTIONS = {
  active: "account.activated",
  locked: "account.locked",
  inactive: "account.deactivated",
};

export function setAccountStatus(db, principal, id, status, ip) {
  requireAdministrator(principal);
  assert(Object.hasOwn(STATUS_ACTIONS, status), 400, "INVALID_INPUT", "Trạng thái không hợp lệ.");
  return transaction(db, () => {
    const before = db.prepare("SELECT id,status FROM accounts WHERE id=?").get(id);
    assert(before, 404, "NOT_FOUND", "Không tìm thấy tài khoản.");
    assert(
      before.status !== status,
      409,
      "ACCOUNT_STATUS_CONFLICT",
      "Trạng thái tài khoản đã thay đổi.",
    );
    if (status !== "active")
      assert(id !== principal.id, 409, "SELF_LOCK", "Không thể tự khóa tài khoản đang thực hiện.");
    db.prepare("UPDATE accounts SET status=? WHERE id=?").run(status, id);
    if (status !== "active") {
      preserveAdministrator(db);
      db.prepare("DELETE FROM sessions WHERE account_id=?").run(id);
    }
    writeAudit(db, {
      actorId: principal.id,
      feature: "M01",
      objectType: "account",
      objectId: id,
      action: STATUS_ACTIONS[status],
      before: { status: before.status },
      after: { status },
      ip,
    });
    return { ...findAccount(db, id), status };
  });
}

export async function resetAccountPassword(db, principal, id, password, ip) {
  requireAdministrator(principal);
  text(password, "Mật khẩu mới", 12, 256);
  const account = db.prepare("SELECT id FROM accounts WHERE id=?").get(id);
  assert(account, 404, "NOT_FOUND", "Không tìm thấy tài khoản.");
  const passwordHash = await hashPassword(password);
  transaction(db, () => {
    db.prepare("UPDATE accounts SET password_hash=?,must_change_password=1 WHERE id=?").run(
      passwordHash,
      id,
    );
    db.prepare("DELETE FROM sessions WHERE account_id=?").run(id);
    writeAudit(db, {
      actorId: principal.id,
      feature: "M01",
      objectType: "account",
      objectId: id,
      action: "account.password_reset",
      ip,
    });
  });
  return { message: "Đã đặt lại mật khẩu. Người dùng phải đổi mật khẩu ở lần đăng nhập tới." };
}

const ACCOUNT_COLUMNS =
  "id,username,full_name,officer_id,role_code,status,must_change_password,last_login_at,created_at";

export function listRoles(db) {
  return {
    roles: db
      .prepare("SELECT * FROM roles ORDER BY code")
      .all()
      .map((r) => ({ ...r, permissions: permissionsFor(db, r.code) })),
    permissions: db.prepare("SELECT * FROM permissions ORDER BY code").all(),
  };
}

export function findAccount(db, id) {
  return db.prepare(`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id=?`).get(id);
}

export function listAccounts(db, { page, pageSize }, search = "") {
  assert(search.length <= 100, 400, "INVALID_INPUT", "Từ khóa tìm kiếm quá dài.");
  const where = search
    ? "WHERE instr(fold(a.username),fold(?))>0 OR instr(fold(a.full_name),fold(?))>0 OR instr(fold(a.officer_id),fold(?))>0"
    : "";
  const params = search ? [search, search, search] : [];
  return {
    items: db
      .prepare(
        `SELECT a.id,a.username,a.full_name,a.officer_id,a.role_code,a.status,a.last_login_at,
      (SELECT count(*) FROM region_assignments ra WHERE ra.account_id=a.id) AS region_count,
      (SELECT count(*) FROM facilities f WHERE f.officer_id=a.officer_id) AS facility_count,
      (SELECT u.name FROM account_scopes s JOIN units u ON u.id=s.unit_id
        WHERE s.account_id=a.id AND s.kind='unit' ORDER BY s.id LIMIT 1) AS unit_name
      FROM accounts a ${where} ORDER BY a.username LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize),
    total: db.prepare(`SELECT count(*) AS total FROM accounts a ${where}`).get(...params).total,
    page,
    pageSize,
  };
}

export function listScopeOptions(db, kind, { page, pageSize }) {
  assert(
    Object.hasOwn(SCOPE_TABLES, kind),
    400,
    "INVALID_INPUT",
    "kind phải là unit, region hoặc facility.",
  );
  const table = SCOPE_TABLES[kind];
  return {
    items: db
      .prepare(`SELECT id,name FROM ${table} ORDER BY id LIMIT ? OFFSET ?`)
      .all(pageSize, (page - 1) * pageSize),
    total: db.prepare(`SELECT count(*) AS total FROM ${table}`).get().total,
    page,
    pageSize,
  };
}
