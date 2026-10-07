import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../src/database.js";
import { seedDemo } from "../src/seed.js";
import { createApp } from "../src/app.js";
import { tokenHash } from "../src/authentication.js";

const password = "Temporary-test-password-2026";
const origin = "http://localhost:3000";

async function fixture(t) {
  const db = openDatabase(":memory:");
  await seedDemo(db, password);
  // Most tests exercise normal access; first-login behavior has its own test.
  db.exec("UPDATE accounts SET must_change_password=0");
  const server = createApp(db, { appOrigin: origin });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { method = "GET", body, cookie, headers = {} } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      data: response.status === 204 ? null : await response.json(),
      cookie: response.headers.get("set-cookie"),
      headers: response.headers,
    };
  }
  async function login(username = "demo.admin") {
    const response = await request("/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return response.cookie.split(";")[0];
  }
  return { db, request, login, base };
}

test("migration persists, reopens idempotently, and enforces FK/unique/audit constraints", async () => {
  const directory = mkdtempSync(join(tmpdir(), "pccc-auth-test-"));
  const path = join(directory, "auth.sqlite");
  let db;
  try {
    db = openDatabase(path);
    await seedDemo(db, password);
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare("SELECT count(*) AS n FROM schema_migrations").get().n, 1);
    assert.equal(db.prepare("SELECT count(*) AS n FROM accounts").get().n, 6);
    assert.throws(() =>
      db.prepare("INSERT INTO role_permissions VALUES (?,?)").run("A99", "M03.view"),
    );
    assert.throws(() =>
      db.prepare("INSERT INTO role_permissions VALUES (?,?)").run("A03", "M03.view"),
    );
    assert.throws(() =>
      db
        .prepare(
          "INSERT INTO account_scopes(account_id,kind,region_id) VALUES ('DEMO-A03','region','missing')",
        )
        .run(),
    );
    db.prepare("INSERT INTO audit_logs(action,occurred_at,ip) VALUES ('test',1,'local')").run();
    assert.throws(() => db.exec("UPDATE audit_logs SET action='changed'"));
    assert.throws(() => db.exec("DELETE FROM audit_logs"));
  } finally {
    db?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("seed preserves existing password, permissions and scopes", async (t) => {
  const { db } = await fixture(t);
  const before = db.prepare("SELECT password_hash FROM accounts WHERE id='DEMO-A03'").get();
  db.exec(
    "DELETE FROM role_permissions WHERE role_code='A03'; DELETE FROM account_scopes WHERE account_id='DEMO-A03'",
  );
  await seedDemo(db, "Another-temporary-password");
  assert.deepEqual(
    db.prepare("SELECT password_hash FROM accounts WHERE id='DEMO-A03'").get(),
    before,
  );
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM role_permissions WHERE role_code='A03'").get().n,
    0,
  );
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM account_scopes WHERE account_id='DEMO-A03'").get().n,
    0,
  );
});

test("login sets HttpOnly session, persists identity, rotates and logs out with real revocation", async (t) => {
  const { db, request, login } = await fixture(t);
  const result = await request("/api/auth/login", {
    method: "POST",
    body: { username: "DEMO.ADMIN", password },
  });
  assert.equal(result.status, 200);
  assert.match(result.cookie, /HttpOnly/);
  assert.match(result.cookie, /SameSite=Lax/);
  assert.equal(result.data.redirectTo, "/quan-tri/vai-tro");
  assert.ok(!JSON.stringify(result.data).includes("password_hash"));
  const cookie = result.cookie.split(";")[0];
  const token = cookie.split("=")[1];
  assert.equal(db.prepare("SELECT token_hash FROM sessions").get().token_hash, tokenHash(token));
  assert.equal((await request("/api/auth/me", { cookie })).data.user.role, "A05");
  const rotation = await request("/api/auth/login", {
    method: "POST",
    cookie,
    body: { username: "demo.admin", password },
  });
  assert.equal(rotation.status, 200);
  assert.equal((await request("/api/auth/me", { cookie })).status, 401);
  const activeCookie = rotation.cookie.split(";")[0];
  assert.equal(
    (await request("/api/auth/logout", { method: "POST", cookie: activeCookie })).status,
    200,
  );
  assert.equal((await request("/api/auth/me", { cookie: activeCookie })).status, 401);
  assert.equal((await request("/api/auth/logout", { method: "POST" })).status, 200);
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM audit_logs WHERE action='auth.login'").get().n,
    2,
  );
  await login("demo.can-bo");
});

test("wrong password and missing username have generic failure; locked/inactive/disabled roles refuse login", async (t) => {
  const { db, request } = await fixture(t);
  for (const username of ["demo.admin", "missing"]) {
    const result = await request("/api/auth/login", {
      method: "POST",
      body: { username, password: "wrong" },
    });
    assert.equal(result.status, 401);
    assert.equal(result.data.error.code, "INVALID_CREDENTIALS");
    assert.equal(result.cookie, null);
  }
  for (const status of ["locked", "inactive"]) {
    db.prepare("UPDATE accounts SET status=? WHERE id='DEMO-A03'").run(status);
    assert.equal(
      (
        await request("/api/auth/login", {
          method: "POST",
          body: { username: "demo.can-bo", password },
        })
      ).status,
      403,
    );
  }
  db.exec(
    "UPDATE accounts SET status='active' WHERE id='DEMO-A03'; UPDATE roles SET enabled=0 WHERE code='A03'",
  );
  assert.equal(
    (
      await request("/api/auth/login", {
        method: "POST",
        body: { username: "demo.can-bo", password },
      })
    ).status,
    403,
  );
  assert.equal(db.prepare("SELECT count(*) AS n FROM sessions").get().n, 0);
});

test("locked account, expired or fabricated session immediately loses access", async (t) => {
  const { db, request, login } = await fixture(t);
  assert.equal((await request("/api/auth/me")).status, 401);
  assert.equal((await request("/api/auth/me", { cookie: "pccc_session=fake" })).status, 401);
  const cookie = await login("demo.can-bo");
  db.exec("UPDATE accounts SET status='locked' WHERE id='DEMO-A03'");
  assert.equal((await request("/api/auth/me", { cookie })).status, 401);
  db.exec(
    "UPDATE accounts SET status='active' WHERE id='DEMO-A03'; UPDATE sessions SET expires_at=1",
  );
  assert.equal((await request("/api/auth/me", { cookie })).status, 401);
});

test("first login requires password change, revokes all sessions, and accepts only the new password", async (t) => {
  const { db, request, login } = await fixture(t);
  db.exec("UPDATE accounts SET must_change_password=1 WHERE id='DEMO-A03'");
  const result = await request("/api/auth/login", {
    method: "POST",
    body: { username: "demo.can-bo", password },
  });
  assert.equal(result.data.redirectTo, "/doi-mat-khau");
  const cookie = result.cookie.split(";")[0];
  const otherCookie = await login("demo.can-bo");
  assert.equal(
    (await request("/api/facilities", { cookie })).data.error.code,
    "PASSWORD_CHANGE_REQUIRED",
  );
  assert.equal(
    (
      await request("/api/auth/change-password", {
        method: "POST",
        cookie,
        body: { currentPassword: "wrong", newPassword: "New-password-2026" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/auth/change-password", {
        method: "POST",
        cookie,
        body: { currentPassword: password, newPassword: "short" },
      })
    ).status,
    400,
  );
  const changed = await request("/api/auth/change-password", {
    method: "POST",
    cookie,
    body: { currentPassword: password, newPassword: "New-password-2026" },
  });
  assert.equal(changed.status, 200);
  assert.equal((await request("/api/auth/me", { cookie: otherCookie })).status, 401);
  assert.equal(
    (
      await request("/api/auth/login", {
        method: "POST",
        body: { username: "demo.can-bo", password },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/api/auth/login", {
        method: "POST",
        body: { username: "demo.can-bo", password: "New-password-2026" },
      })
    ).status,
    200,
  );
  const audit = JSON.stringify(db.prepare("SELECT * FROM audit_logs").all());
  assert.ok(
    !audit.includes(password) && !audit.includes("New-password-2026") && !audit.includes(cookie),
  );
});

test("skip password change preserves password and session, persists choice and audits once", async (t) => {
  const { db, request, login } = await fixture(t);
  db.exec("UPDATE accounts SET must_change_password=1 WHERE id='DEMO-A03'");
  const before = db
    .prepare("SELECT password_hash FROM accounts WHERE id='DEMO-A03'")
    .get().password_hash;
  const cookie = await login("demo.can-bo");
  assert.equal((await request("/api/facilities", { cookie })).status, 403);
  const skipped = await request("/api/auth/skip-password-change", { method: "POST", cookie });
  assert.equal(skipped.status, 200);
  assert.equal(skipped.data.redirectTo, "/");
  assert.equal((await request("/api/auth/me", { cookie })).data.user.mustChangePassword, false);
  assert.equal((await request("/api/facilities", { cookie })).data.total, 1);
  assert.equal((await request("/api/authorization/roles", { cookie })).status, 403);
  assert.equal(
    db.prepare("SELECT password_hash FROM accounts WHERE id='DEMO-A03'").get().password_hash,
    before,
  );
  assert.equal(
    (await request("/api/auth/skip-password-change", { method: "POST", cookie })).status,
    200,
  );
  assert.equal(
    db
      .prepare("SELECT count(*) AS n FROM audit_logs WHERE action='auth.password_change_skipped'")
      .get().n,
    1,
  );
  await request("/api/auth/logout", { method: "POST", cookie });
  const again = await request("/api/auth/login", {
    method: "POST",
    body: { username: "demo.can-bo", password },
  });
  assert.equal(again.status, 200);
  assert.equal(again.data.redirectTo, "/");
});

test("skip requires active authentication and valid origin, and affects only the session account", async (t) => {
  const { db, request, login } = await fixture(t);
  db.exec("UPDATE accounts SET must_change_password=1");
  assert.equal((await request("/api/auth/skip-password-change", { method: "POST" })).status, 401);
  const cookie = await login();
  assert.equal(
    (
      await request("/api/auth/skip-password-change", {
        method: "POST",
        cookie,
        headers: { Origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  const result = await request("/api/auth/skip-password-change", {
    method: "POST",
    cookie,
    body: { accountId: "DEMO-A03" },
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.redirectTo, "/quan-tri/vai-tro");
  assert.equal(
    db.prepare("SELECT must_change_password FROM accounts WHERE id='DEMO-A03'").get()
      .must_change_password,
    1,
  );
  db.exec("UPDATE accounts SET status='locked' WHERE id='DEMO-A05'");
  assert.equal(
    (await request("/api/auth/skip-password-change", { method: "POST", cookie })).status,
    401,
  );
});

test("rate limit caps repeated credentials attempts", async (t) => {
  const { request } = await fixture(t);
  for (let i = 0; i < 10; i++)
    assert.equal(
      (
        await request("/api/auth/login", {
          method: "POST",
          body: { username: "missing", password: "wrong" },
        })
      ).status,
      401,
    );
  assert.equal(
    (
      await request("/api/auth/login", {
        method: "POST",
        body: { username: "missing", password: "wrong" },
      })
    ).status,
    429,
  );
});

test("successful logins do not exhaust the shared frontend proxy failure budget", async (t) => {
  const { request, login } = await fixture(t);
  for (let i = 0; i < 12; i++) {
    const cookie = await login("demo.can-bo");
    assert.equal((await request("/api/auth/logout", { method: "POST", cookie })).status, 200);
  }
});

test("origin and input validation block CSRF, forged roles, malformed JSON, oversized body and SQL injection", async (t) => {
  const { request, base, login } = await fixture(t);
  assert.equal(
    (
      await request("/api/auth/login", {
        method: "POST",
        body: { username: "demo.admin", password },
        headers: { Origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/auth/login", {
        method: "POST",
        body: { username: "demo.admin", password, role: "A05" },
      })
    ).status,
    400,
  );
  assert.equal((await fetch(base + "/api/auth/logout", { method: "POST" })).status, 403);
  assert.equal(
    (
      await fetch(base + "/api/auth/login", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: "{",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await fetch(base + "/api/auth/login", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: "x".repeat(20000),
      })
    ).status,
    413,
  );
  const cookie = await login("demo.can-bo");
  assert.equal(
    (await request("/api/facilities?search=%27%20OR%201%3D1--", { cookie })).data.total,
    0,
  );
  assert.equal((await request("/api/facilities?page=0", { cookie })).status, 400);
});

test("permission denial protects admin API independent of claimed role", async (t) => {
  const { request, login } = await fixture(t);
  const cookie = await login("demo.can-bo");
  for (const path of [
    "/api/authorization/roles",
    "/api/authorization/accounts",
    "/api/audit-logs",
    "/api/authorization/scope-options?kind=unit",
  ])
    assert.equal((await request(path, { cookie })).status, 403);
  assert.equal(
    (
      await request("/api/authorization/accounts/DEMO-A03", {
        method: "PUT",
        cookie,
        body: { role: "A05", scopes: [{ kind: "all" }] },
      })
    ).status,
    403,
  );
});

test("region scope protects list/search/count/detail/dashboard and denies empty scope", async (t) => {
  const { db, request, login } = await fixture(t);
  const cookie = await login("demo.can-bo");
  const list = await request("/api/facilities?pageSize=1", { cookie });
  assert.equal(list.data.total, 1);
  assert.equal(list.data.items[0].id, "CS001");
  assert.equal((await request("/api/facilities/CS002", { cookie })).status, 404);
  assert.equal((await request("/api/facilities?search=CS002", { cookie })).data.total, 0);
  assert.equal((await request("/api/dashboard", { cookie })).data.facilityCount, 1);
  db.exec("DELETE FROM account_scopes WHERE account_id='DEMO-A03'");
  assert.equal((await request("/api/facilities", { cookie })).data.total, 0);
  assert.equal((await request("/api/dashboard", { cookie })).data.facilityCount, 0);
});

test("unit scopes include descendants; facility-only scope limits to exactly that object", async (t) => {
  const { db, request, login } = await fixture(t);
  const cookie = await login("demo.chi-huy");
  assert.equal((await request("/api/facilities", { cookie })).data.total, 2);
  db.exec("UPDATE account_scopes SET unit_id='DV-PC07' WHERE account_id='DEMO-A01'");
  assert.equal((await request("/api/facilities", { cookie })).data.total, 3);
  db.exec(
    "DELETE FROM account_scopes WHERE account_id='DEMO-A01'; INSERT INTO account_scopes(account_id,kind,facility_id) VALUES ('DEMO-A01','facility','CS003')",
  );
  assert.equal((await request("/api/facilities", { cookie })).data.items[0].id, "CS003");
  assert.equal((await request("/api/facilities/CS001", { cookie })).status, 404);
});

test("admin changes role grants immediately, rejects invalid grants, preserves last admin and audits", async (t) => {
  const { db, request, login } = await fixture(t);
  const admin = await login();
  const officer = await login("demo.can-bo");
  assert.equal((await request("/api/authorization/roles", { cookie: admin })).data.roles.length, 7);
  for (const permissions of [["unknown"], ["M03.view", "M03.view"]])
    assert.equal(
      (
        await request("/api/authorization/roles/A03/permissions", {
          method: "PUT",
          cookie: admin,
          body: { permissions },
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await request("/api/authorization/roles/A05/permissions", {
        method: "PUT",
        cookie: admin,
        body: { permissions: ["M01.view"] },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/api/authorization/roles/A05/permissions", {
        method: "PUT",
        cookie: admin,
        body: { permissions: ["M01.edit"] },
      })
    ).status,
    409,
  );
  assert.ok(
    db
      .prepare(
        "SELECT 1 FROM role_permissions WHERE role_code='A05' AND permission_code='M01.edit'",
      )
      .get(),
  );
  assert.equal(
    (
      await request("/api/authorization/roles/A03/permissions", {
        method: "PUT",
        cookie: admin,
        body: { permissions: [] },
      })
    ).status,
    200,
  );
  assert.equal((await request("/api/facilities", { cookie: officer })).status, 403);
  assert.ok(
    db
      .prepare("SELECT 1 FROM audit_logs WHERE action='authorization.role_permissions_changed'")
      .get(),
  );
});

test("admin assigns role and validated scope atomically, revokes session and keeps audit before/after", async (t) => {
  const { db, request, login } = await fixture(t);
  const admin = await login();
  const officer = await login("demo.can-bo");
  const put = (body, id = "DEMO-A03") =>
    request(`/api/authorization/accounts/${id}`, { method: "PUT", cookie: admin, body });
  assert.equal(
    (await put({ role: "A03", scopes: [{ kind: "region", targetId: "missing" }] })).status,
    400,
  );
  assert.equal((await put({ role: "A07", scopes: [] })).status, 400);
  assert.equal(
    (await put({ role: "A03", scopes: [{ kind: "all" }, { kind: "region", targetId: "KP01" }] }))
      .status,
    400,
  );
  assert.equal((await put({ role: "A06", scopes: [] }, "DEMO-A05")).status, 409);
  assert.equal((await request("/api/auth/me", { cookie: admin })).status, 200);
  const updated = await put({ role: "A06", scopes: [{ kind: "facility", targetId: "CS003" }] });
  assert.equal(updated.status, 200);
  assert.equal((await request("/api/auth/me", { cookie: officer })).status, 401);
  const newCookie = await login("demo.can-bo");
  assert.equal((await request("/api/facilities", { cookie: newCookie })).data.items[0].id, "CS003");
  const audit = db
    .prepare("SELECT * FROM audit_logs WHERE action='authorization.account_changed'")
    .get();
  assert.equal(JSON.parse(audit.before_json).role, "A03");
  assert.equal(JSON.parse(audit.after_json).role, "A06");
});

test("scope-limited admin cannot configure global permissions", async (t) => {
  const { db, request, login } = await fixture(t);
  const cookie = await login();
  db.exec(
    "DELETE FROM account_scopes WHERE account_id='DEMO-A05'; INSERT INTO account_scopes(account_id,kind,region_id) VALUES ('DEMO-A05','region','KP01')",
  );
  assert.equal((await request("/api/authorization/roles", { cookie })).status, 403);
});

test("read-only leadership gets scoped reads and no edit permission", async (t) => {
  const { request, login } = await fixture(t);
  const cookie = await login("demo.nguoi-xem");
  const user = (await request("/api/auth/me", { cookie })).data.user;
  assert.ok(user.permissions.every((p) => p.endsWith(".view")));
  assert.equal((await request("/api/facilities", { cookie })).data.total, 3);
  assert.equal(
    (
      await request("/api/authorization/roles/A06/permissions", {
        method: "PUT",
        cookie,
        body: { permissions: ["M03.edit"] },
      })
    ).status,
    403,
  );
});
