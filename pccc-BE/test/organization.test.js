import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { request as httpRequest } from "node:http";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";

const password = "Organization-test-password-2026";
const origin = "http://localhost:3000";
const migrations = new URL("../migrations/", import.meta.url);

async function fixture(t, databasePath = ":memory:") {
  const db = openDatabase(databasePath);
  await seedDemo(db, password);
  db.exec("UPDATE accounts SET must_change_password=0");
  // Grants are test configuration, never an update to the user's database.
  for (const role of ["A01", "A03", "A04", "A05", "A06"])
    for (const permission of ["M02.view", "M02.create", "M02.edit"])
      db.prepare("INSERT OR IGNORE INTO role_permissions VALUES (?,?)").run(role, permission);
  const server = createApp(db, { appOrigin: origin, logger: { error() {} } });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((done) => server.close(done));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { method = "GET", body, cookie, headers = {} } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      data: response.status === 204 ? null : await response.json(),
      cookie: response.headers.get("set-cookie"),
    };
  }
  async function login(username = "demo.admin") {
    const result = await request("/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    return result.cookie.split(";")[0];
  }
  const cookie = await login();
  let serial = 0;
  async function officer(overrides = {}, status = 201) {
    serial++;
    const body = {
      officerCode: `TEST-CB-${serial}`,
      fullName: `Cán bộ kiểm thử ${serial}`,
      rank: "Đại úy",
      position: "Cán bộ tổng hợp",
      phone: "0900000001",
      email: `officer${serial}@example.test`,
      unitId: "DV-KV10",
      businessRole: "A03",
      notes: "Dữ liệu giả lập",
      ...overrides,
    };
    const result = await request("/api/officers", { method: "POST", cookie, body });
    assert.equal(result.status, status, JSON.stringify(result.data));
    return result.data.officer;
  }
  async function unit(overrides = {}, status = 201) {
    serial++;
    const result = await request("/api/units", {
      method: "POST",
      cookie,
      body: {
        code: `TEST-P-${serial}`,
        name: `Phường kiểm thử ${serial}`,
        level: "WARD",
        parentId: "DV-KV10",
        ...overrides,
      },
    });
    assert.equal(result.status, status, JSON.stringify(result.data));
    return result.data.unit;
  }
  return { db, server, base, request, login, cookie, officer, unit };
}

function auditFor(db, id) {
  return db.prepare("SELECT * FROM audit_logs WHERE object_id=? ORDER BY id").all(id);
}

test("ORG migration upgrades 001 without changing IDs, scope, accounts or facility references", async () => {
  const directory = mkdtempSync(join(tmpdir(), "pccc-org-upgrade-"));
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
  const path = join(directory, "upgrade.sqlite");
  let db;
  try {
    db = new DatabaseSync(path);
    db.exec("PRAGMA foreign_keys=ON");
    db.exec(readFileSync(new URL("001-auth.sql", migrations), "utf8"));
    db.exec(
      "CREATE TABLE schema_migrations(name TEXT PRIMARY KEY,applied_at INTEGER NOT NULL); INSERT INTO schema_migrations VALUES ('001-auth.sql',1)",
    );
    db.exec(`
      INSERT INTO roles VALUES ('A05','Quản trị mẫu',1);
      INSERT INTO permissions VALUES ('M02.view','M02','view');
      INSERT INTO role_permissions VALUES ('A05','M02.view');
      INSERT INTO accounts(id,username,password_hash,full_name,officer_id,role_code,created_at)
        VALUES ('OLD-ACCOUNT','legacy','legacy-hash-preserved','Tài khoản giả lập','UNKNOWN-OFFICER','A05',1);
      INSERT INTO units VALUES ('DV-PC07','PC07 mẫu',NULL),('DV-KV10','Khu vực 10 mẫu','DV-PC07'),('DV-KV11','Khu vực 11 mẫu','DV-PC07');
      INSERT INTO regions VALUES ('KP01','Khu phố mẫu','DV-KV10');
      INSERT INTO facilities VALUES ('CS001','Cơ sở giả lập','Địa chỉ giả lập','KP01','UNKNOWN-OFFICER','active');
      INSERT INTO account_scopes(account_id,kind,unit_id) VALUES ('OLD-ACCOUNT','unit','DV-KV10');
    `);
    const snapshot = Object.fromEntries(
      ["accounts", "account_scopes", "facilities", "role_permissions", "regions", "units"].map(
        (table) => [table, db.prepare(`SELECT * FROM ${table}`).all()],
      ),
    );
    db.close();
    db = openDatabase(path);
    for (const table of ["accounts", "account_scopes", "facilities", "role_permissions"])
      assert.deepEqual(db.prepare(`SELECT * FROM ${table}`).all(), snapshot[table], table);
    assert.deepEqual(db.prepare("SELECT id,name,parent_id FROM units").all(), snapshot.units);
    assert.deepEqual(db.prepare("SELECT id,name,unit_id FROM regions").all(), snapshot.regions);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    const count = readdirSync(migrations).filter(
      (file) => file.endsWith(".sql") || file.endsWith(".cjs"),
    ).length;
    assert.equal(db.prepare("SELECT count(*) AS n FROM schema_migrations").get().n, count);
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare("SELECT count(*) AS n FROM schema_migrations").get().n, count);
  } finally {
    db?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ORG tree uses shared units/regions and readonly root; valid ward and neighborhood persist", async (t) => {
  const f = await fixture(t);
  const before = await f.request("/api/organization/tree", { cookie: f.cookie });
  assert.equal(before.status, 200);
  assert.ok(before.data.items.some((node) => node.id === "DV-PC07" && node.readOnly));
  assert.ok(before.data.items.some((node) => node.id === "KP01" && node.kind === "region"));
  const ward = await f.unit();
  const area = await f.unit({
    code: "TEST-AREA",
    name: "Khu vực kiểm thử",
    level: "AREA",
    parentId: "DV-PC07",
  });
  assert.equal(
    (await f.request(`/api/units/${area.id}`, { cookie: f.cookie })).data.unit.level,
    "AREA",
  );
  const result = await f.request("/api/organization/regions", {
    method: "POST",
    cookie: f.cookie,
    body: { code: "TEST-KP", name: "Khu phố kiểm thử", level: "NEIGHBORHOOD", parentId: ward.id },
  });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  const after = await f.request("/api/organization/tree", { cookie: f.cookie });
  assert.ok(after.data.items.some((node) => node.id === ward.id));
  assert.ok(
    after.data.items.some((node) => node.id === result.data.region.id && node.parentId === ward.id),
  );
  assert.equal(
    f.db.prepare("SELECT unit_id FROM regions WHERE id=?").get(result.data.region.id).unit_id,
    ward.id,
  );
  assert.equal((await f.request(`/api/units/${ward.id}`, { cookie: f.cookie })).status, 200);
  assert.equal(
    (await f.request(`/api/organization/regions/${result.data.region.id}`, { cookie: f.cookie }))
      .status,
    200,
  );
});

test("ORG unit edits, responsible officer and audit commit together with before/after", async (t) => {
  const f = await fixture(t);
  const ward = await f.unit();
  const officer = await f.officer({ unitId: ward.id });
  const response = await f.request(`/api/units/${ward.id}`, {
    method: "PATCH",
    cookie: f.cookie,
    body: { name: "Phường đã cập nhật", leaderOfficerId: officer.id },
  });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  assert.equal(response.data.unit.leaderOfficerId, officer.id);
  const logs = auditFor(f.db, ward.id);
  assert.equal(logs.length, 2);
  assert.equal(logs[1].actor_id, "DEMO-A05");
  assert.ok(logs[1].occurred_at > 0);
  assert.equal(JSON.parse(logs[1].before_json).name, ward.name);
  assert.equal(JSON.parse(logs[1].after_json).name, "Phường đã cập nhật");
  assert.equal(
    (
      await f.request(`/api/units/${ward.id}/status`, {
        method: "PATCH",
        cookie: f.cookie,
        body: { status: "INACTIVE" },
      })
    ).status,
    409,
  );
});

test("ORG invalid parent, level, self/cycle, duplicate code and responsible person leave data unchanged", async (t) => {
  const f = await fixture(t);
  const ward = await f.unit({ code: "UNIQUE-WARD" });
  await f.unit({ code: "unique-ward" }, 409);
  for (const body of [
    { name: "Thiếu mã" },
    { code: "BAD1", name: "Sai cha", level: "WARD", parentId: "missing" },
    { code: "BAD2", name: "Sai cấp", level: "WARD", parentId: "DV-PC07" },
    { code: "BAD3", name: "Cấp gốc", level: "ROOT", parentId: null },
  ]) {
    const result = await f.request("/api/units", { method: "POST", cookie: f.cookie, body });
    assert.ok([400, 404, 409].includes(result.status), JSON.stringify(result));
  }
  const before = f.db.prepare("SELECT * FROM units WHERE id=?").get(ward.id);
  const auditCount = auditFor(f.db, ward.id).length;
  for (const body of [
    { parentId: ward.id },
    { parentId: "DV-PC07" },
    { leaderOfficerId: "missing" },
  ]) {
    const result = await f.request(`/api/units/${ward.id}`, {
      method: "PATCH",
      cookie: f.cookie,
      body,
    });
    assert.ok([400, 404, 409].includes(result.status), JSON.stringify(result));
  }
  assert.deepEqual(f.db.prepare("SELECT * FROM units WHERE id=?").get(ward.id), before);
  assert.equal(auditFor(f.db, ward.id).length, auditCount);
  assert.ok(
    [400, 409].includes(
      (
        await f.request("/api/units/DV-PC07", {
          method: "PATCH",
          cookie: f.cookie,
          body: { name: "Đổi gốc" },
        })
      ).status,
    ),
  );
  assert.ok(
    [400, 409].includes(
      (
        await f.request("/api/units/DV-KV10", {
          method: "PATCH",
          cookie: f.cookie,
          body: { parentId: ward.id },
        })
      ).status,
    ),
  );
});

test("ORG empty units deactivate without physical delete; active children and references block", async (t) => {
  const f = await fixture(t);
  const ward = await f.unit();
  const result = await f.request(`/api/units/${ward.id}/status`, {
    method: "PATCH",
    cookie: f.cookie,
    body: { status: "INACTIVE" },
  });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(f.db.prepare("SELECT status FROM units WHERE id=?").get(ward.id).status, "INACTIVE");
  assert.equal(auditFor(f.db, ward.id).length, 2);
  assert.equal(
    (
      await f.request("/api/units/DV-KV10/status", {
        method: "PATCH",
        cookie: f.cookie,
        body: { status: "INACTIVE" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await f.request("/api/organization/regions/KP01/status", {
        method: "PATCH",
        cookie: f.cookie,
        body: { status: "INACTIVE" },
      })
    ).status,
    409,
  );
  assert.equal(
    (await f.request(`/api/units/${ward.id}`, { method: "DELETE", cookie: f.cookie })).status,
    404,
  );
  assert.ok(f.db.prepare("SELECT 1 FROM units WHERE id=?").get(ward.id));
});

test("ORG M02 permissions, session, CSRF and forged actor are enforced on every endpoint", async (t) => {
  const f = await fixture(t);
  f.db
    .prepare("DELETE FROM role_permissions WHERE role_code='A02' AND permission_code LIKE 'M02.%'")
    .run();
  for (const path of [
    "/api/organization/tree",
    "/api/organization/options",
    "/api/units",
    "/api/units/DV-KV10",
    "/api/officers",
  ])
    assert.equal((await f.request(path)).status, 401, path);
  const cookie = await f.login("demo.to-truong");
  for (const path of [
    "/api/organization/tree",
    "/api/organization/options",
    "/api/units",
    "/api/units/DV-KV10",
    "/api/officers",
  ])
    assert.equal((await f.request(path, { cookie })).status, 403, path);
  assert.equal(
    (
      await f.request("/api/officers", {
        method: "POST",
        cookie: f.cookie,
        body: {},
        headers: { Origin: "http://evil.test" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.request("/api/officers", {
        method: "POST",
        cookie: f.cookie,
        body: { actorId: "DEMO-A01", scope: "all" },
      })
    ).status,
    400,
  );
  f.db
    .prepare("DELETE FROM role_permissions WHERE role_code='A05' AND permission_code='M02.edit'")
    .run();
  assert.equal(
    (
      await f.request("/api/units/DV-KV10", {
        method: "PATCH",
        cookie: f.cookie,
        body: { name: "Forbidden" },
      })
    ).status,
    403,
  );
  f.db
    .prepare("DELETE FROM role_permissions WHERE role_code='A05' AND permission_code='M02.create'")
    .run();
  assert.equal(
    (await f.request("/api/officers", { method: "POST", cookie: f.cookie, body: {} })).status,
    403,
  );
});

test("ORG unit scope includes descendants and blocks reads, writes and parent moves outside scope", async (t) => {
  const f = await fixture(t);
  const ward = await f.unit();
  const inside = await f.officer({ unitId: ward.id });
  const outside = await f.officer({ unitId: "DV-KV11" });
  const cookie = await f.login("demo.chi-huy");
  const list = await f.request("/api/officers", { cookie });
  assert.equal(list.status, 200);
  assert.ok(list.data.items.some((row) => row.id === inside.id));
  assert.ok(!list.data.items.some((row) => row.id === outside.id));
  assert.equal((await f.request(`/api/officers/${outside.id}`, { cookie })).status, 404);
  assert.equal(
    (
      await f.request(`/api/officers/${outside.id}`, {
        method: "PATCH",
        cookie,
        body: { notes: "Forbidden" },
      })
    ).status,
    404,
  );
  assert.ok(
    [403, 404].includes(
      (
        await f.request("/api/officers", {
          method: "POST",
          cookie,
          body: {
            officerCode: "OUT",
            fullName: "Ngoài phạm vi",
            rank: "Đại úy",
            position: "Cán bộ",
            phone: "0900000002",
            email: "out@example.test",
            unitId: "DV-KV11",
            businessRole: "A03",
          },
        })
      ).status,
    ),
  );
  assert.ok(
    [403, 404, 409].includes(
      (
        await f.request(`/api/units/${ward.id}`, {
          method: "PATCH",
          cookie,
          body: { parentId: "DV-KV11" },
        })
      ).status,
    ),
  );
  const tree = await f.request("/api/organization/tree", { cookie });
  assert.ok(!tree.data.items.some((node) => node.id === "DV-KV11" || node.id === "KP03"));
});

test("ORG officer create returns 201; NOCASE code/email duplicates and concurrent submits return 409", async (t) => {
  const f = await fixture(t);
  const officer = await f.officer({ officerCode: "CASE-CODE", email: "unique@example.test" });
  assert.ok(officer.id);
  assert.equal(officer.status, "ACTIVE");
  await f.officer({ officerCode: "case-code" }, 409);
  await f.officer({ email: "UNIQUE@EXAMPLE.TEST" }, 409);
  const payload = {
    officerCode: "CONCURRENT",
    fullName: "Cán bộ đồng thời",
    rank: "Đại úy",
    position: "Cán bộ",
    phone: "0900000001",
    email: "race@example.test",
    unitId: "DV-KV10",
    businessRole: "A03",
  };
  const results = await Promise.all(
    [1, 2].map(() =>
      f.request("/api/officers", { method: "POST", cookie: f.cookie, body: payload }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    f.db.prepare("SELECT count(*) AS n FROM officers WHERE officer_code='CONCURRENT'").get().n,
    1,
  );
  const log = auditFor(f.db, officer.id)[0];
  assert.equal(log.actor_id, "DEMO-A05");
  assert.equal(log.before_json, null);
  assert.equal(JSON.parse(log.after_json).officerCode, "CASE-CODE");
});

test("ORG officer validation rejects missing, malformed, oversized, disabled role and unknown unit", async (t) => {
  const f = await fixture(t);
  const before = f.db.prepare("SELECT count(*) AS n FROM officers").get().n;
  for (const overrides of [
    { officerCode: "" },
    { fullName: " " },
    { email: "not-an-email" },
    { phone: "hello" },
    { unitId: "missing" },
    { businessRole: "A07" },
    { notes: "x".repeat(5001) },
    { status: "TRANSFERRED" },
  ]) {
    const result = await f.request("/api/officers", {
      method: "POST",
      cookie: f.cookie,
      body: {
        officerCode: "INVALID",
        fullName: "Cán bộ giả lập",
        rank: "Đại úy",
        position: "Cán bộ",
        phone: "0900000001",
        email: "invalid@example.test",
        unitId: "DV-KV10",
        businessRole: "A03",
        ...overrides,
      },
    });
    assert.ok([400, 404, 409].includes(result.status), JSON.stringify(result));
  }
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM officers").get().n, before);
});

test("ORG officer partial edit preserves omitted fields and never changes linked account role/scope", async (t) => {
  const f = await fixture(t);
  const officer = await f.officer();
  f.db.prepare("UPDATE accounts SET officer_id=? WHERE id='DEMO-A04'").run(officer.id);
  const account = f.db.prepare("SELECT * FROM accounts WHERE id='DEMO-A04'").get();
  const scopes = f.db.prepare("SELECT * FROM account_scopes WHERE account_id='DEMO-A04'").all();
  const response = await f.request(`/api/officers/${officer.id}`, {
    method: "PATCH",
    cookie: f.cookie,
    body: { notes: "Đã sửa ghi chú", businessRole: "A02" },
  });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  assert.equal(response.data.officer.fullName, officer.fullName);
  assert.equal(response.data.officer.email, officer.email);
  assert.equal(response.data.officer.businessRole, "A02");
  assert.deepEqual(f.db.prepare("SELECT * FROM accounts WHERE id='DEMO-A04'").get(), account);
  assert.deepEqual(
    f.db.prepare("SELECT * FROM account_scopes WHERE account_id='DEMO-A04'").all(),
    scopes,
  );
  const detail = await f.request(`/api/officers/${officer.id}`, { cookie: f.cookie });
  assert.equal(detail.data.officer.notes, "Đã sửa ghi chú");
  assert.equal(detail.data.officer.linkedAccountCount, 1);
  assert.equal(
    (
      await f.request(`/api/officers/${officer.id}`, {
        method: "PATCH",
        cookie: f.cookie,
        body: { status: "INACTIVE" },
      })
    ).status,
    400,
  );
});

test("ORG search matches Vietnamese name, position and unit before filtering/count/pagination", async (t) => {
  const f = await fixture(t);
  const a = await f.officer({ fullName: "Nguyễn Kiểm Thử", position: "Tổng hợp dữ liệu" });
  await f.officer({ fullName: "Cán bộ khác", position: "Chỉ huy" });
  for (const search of ["Nguyễn Kiểm Thử", "nguyen kiem thu", "Tổng hợp dữ liệu", "khu vực 10"]) {
    const result = await f.request(`/api/officers?search=${encodeURIComponent(search)}`, {
      cookie: f.cookie,
    });
    assert.equal(result.status, 200);
    assert.ok(
      result.data.items.some((row) => row.id === a.id),
      search,
    );
  }
  const list = await f.request("/api/officers?status=ACTIVE&unitId=DV-KV10&pageSize=1&page=2", {
    cookie: f.cookie,
  });
  assert.equal(list.data.page, 2);
  assert.equal(list.data.pageSize, 1);
  assert.equal(list.data.items.length, 1);
  assert.ok(list.data.total >= 2);
  assert.equal(
    (await f.request("/api/officers?search=' OR 1=1 --", { cookie: f.cookie })).data.total,
    0,
  );
  for (const query of ["page=0", "pageSize=101", "status=BOGUS", `search=${"x".repeat(101)}`])
    assert.equal(
      (await f.request(`/api/officers?${query}`, { cookie: f.cookie })).status,
      400,
      query,
    );
});

test("ORG ACTIVE to INACTIVE/TRANSFERRED requires real date, reason and keeps profile plus audit", async (t) => {
  const f = await fixture(t);
  const officer = await f.officer();
  for (const body of [
    { status: "INACTIVE" },
    { status: "INACTIVE", reason: " ", effectiveDate: "2026-10-13" },
    { status: "INACTIVE", reason: "Nghỉ", effectiveDate: "2026-02-30" },
    { status: "BOGUS", reason: "Nghỉ", effectiveDate: "2026-10-13" },
  ])
    assert.equal(
      (
        await f.request(`/api/officers/${officer.id}/status`, {
          method: "PATCH",
          cookie: f.cookie,
          body,
        })
      ).status,
      400,
    );
  for (const status of ["INACTIVE", "TRANSFERRED"]) {
    const target = status === "INACTIVE" ? officer : await f.officer();
    const response = await f.request(`/api/officers/${target.id}/status`, {
      method: "PATCH",
      cookie: f.cookie,
      body: { status, reason: "Lý do kiểm thử", effectiveDate: "2026-10-13" },
    });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    assert.equal(response.data.officer.status, status);
    const log = auditFor(f.db, target.id).at(-1);
    assert.equal(JSON.parse(log.before_json).status, "ACTIVE");
    assert.equal(JSON.parse(log.after_json).status, status);
    assert.ok(log.after_json.includes("Lý do kiểm thử"));
    assert.equal(
      (await f.request(`/api/officers/${target.id}`, { method: "DELETE", cookie: f.cookie }))
        .status,
      404,
    );
    assert.ok(f.db.prepare("SELECT 1 FROM officers WHERE id=?").get(target.id));
  }
});

test("ORG officer assignment references block departure or incompatible unit moves without territory transfer", async (t) => {
  const f = await fixture(t);
  const ward = await f.unit();
  const officer = await f.officer({ unitId: ward.id });
  assert.equal(
    (
      await f.request(`/api/units/${ward.id}`, {
        method: "PATCH",
        cookie: f.cookie,
        body: { leaderOfficerId: officer.id },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await f.request(`/api/officers/${officer.id}/status`, {
        method: "PATCH",
        cookie: f.cookie,
        body: { status: "TRANSFERRED", reason: "Chuyển đơn vị", effectiveDate: "2026-10-13" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await f.request(`/api/officers/${officer.id}`, {
        method: "PATCH",
        cookie: f.cookie,
        body: { unitId: "DV-KV11" },
      })
    ).status,
    409,
  );
  assert.equal(
    f.db.prepare("SELECT status FROM officers WHERE id=?").get(officer.id).status,
    "ACTIVE",
  );
});

test("ORG all officer/unit/status mutations rollback entirely when audit insert fails", async (t) => {
  const f = await fixture(t);
  const ward = await f.unit();
  const officer = await f.officer();
  const beforeUnit = f.db.prepare("SELECT * FROM units WHERE id=?").get(ward.id);
  const beforeOfficer = f.db.prepare("SELECT * FROM officers WHERE id=?").get(officer.id);
  const beforeCount = f.db.prepare("SELECT count(*) AS n FROM officers").get().n;
  f.db.exec(
    "CREATE TRIGGER fail_org_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'simulated audit failure'); END",
  );
  for (const [path, body] of [
    [`/api/units/${ward.id}`, { name: "Ne doit pas rester" }],
    [`/api/units/${ward.id}/status`, { status: "INACTIVE" }],
    [`/api/officers/${officer.id}`, { notes: "Must rollback" }],
    [
      `/api/officers/${officer.id}/status`,
      { status: "INACTIVE", reason: "Rollback", effectiveDate: "2026-10-13" },
    ],
  ])
    assert.equal(
      (await f.request(path, { method: "PATCH", cookie: f.cookie, body })).status,
      500,
      path,
    );
  await f.officer({}, 500);
  await f.unit({}, 500);
  assert.deepEqual(f.db.prepare("SELECT * FROM units WHERE id=?").get(ward.id), beforeUnit);
  assert.deepEqual(
    f.db.prepare("SELECT * FROM officers WHERE id=?").get(officer.id),
    beforeOfficer,
  );
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM officers").get().n, beforeCount);
  assert.equal(auditFor(f.db, officer.id).length, 1);
});

test("ORG region/facility scopes never grant entire unit staff or owning-unit mutations; empty scope denies all", async (t) => {
  const f = await fixture(t);
  const shown = await f.officer({ fullName: "Người phụ trách trong phạm vi" });
  const hidden = await f.officer({ fullName: "Người cùng đơn vị ngoài phạm vi" });
  f.db.prepare("UPDATE facilities SET officer_id=? WHERE id='CS001'").run(shown.id);
  f.db.prepare("UPDATE facilities SET officer_id=? WHERE id='CS002'").run(hidden.id);
  const cookie = await f.login("demo.can-bo");
  for (const kind of ["region", "facility"]) {
    f.db.prepare("DELETE FROM account_scopes WHERE account_id='DEMO-A03'").run();
    const column = kind === "region" ? "region_id" : "facility_id";
    f.db
      .prepare(`INSERT INTO account_scopes(account_id,kind,${column}) VALUES (?,?,?)`)
      .run("DEMO-A03", kind, kind === "region" ? "KP01" : "CS001");
    const list = await f.request("/api/officers", { cookie });
    assert.equal(list.status, 200);
    assert.ok(list.data.items.some((row) => row.id === shown.id));
    assert.ok(!list.data.items.some((row) => row.id === hidden.id));
    assert.equal((await f.request(`/api/officers/${hidden.id}`, { cookie })).status, 404);
    assert.equal(
      (await f.request("/api/officers?search=" + encodeURIComponent(hidden.fullName), { cookie }))
        .data.total,
      0,
    );
    const options = await f.request("/api/organization/options", { cookie });
    assert.ok(!options.data.officers.some((row) => row.id === hidden.id));
    assert.ok(
      [403, 404].includes(
        (
          await f.request("/api/units/DV-KV10", {
            method: "PATCH",
            cookie,
            body: { name: "Forbidden owner edit" },
          })
        ).status,
      ),
    );
  }
  f.db.prepare("DELETE FROM account_scopes WHERE account_id='DEMO-A03'").run();
  assert.equal((await f.request("/api/officers", { cookie })).data.total, 0);
  assert.deepEqual((await f.request("/api/organization/tree", { cookie })).data.items, []);
  assert.deepEqual((await f.request("/api/organization/options", { cookie })).data.officers, []);
});

test("ORG valid empty ward reparent succeeds; references prevent changing authorization ancestry", async (t) => {
  const f = await fixture(t);
  const ward = await f.unit();
  const response = await f.request(`/api/units/${ward.id}`, {
    method: "PATCH",
    cookie: f.cookie,
    body: { parentId: "DV-KV11" },
  });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  assert.equal(response.data.unit.parentId, "DV-KV11");
  const cookie = await f.login("demo.chi-huy");
  assert.equal((await f.request(`/api/units/${ward.id}`, { cookie })).status, 404);
  const occupied = await f.unit();
  await f.officer({ unitId: occupied.id });
  assert.equal(
    (
      await f.request(`/api/units/${occupied.id}`, {
        method: "PATCH",
        cookie: f.cookie,
        body: { parentId: "DV-KV11" },
      })
    ).status,
    409,
  );
  assert.equal(
    f.db.prepare("SELECT parent_id FROM units WHERE id=?").get(occupied.id).parent_id,
    "DV-KV10",
  );
  assert.equal((await f.request("/api/facilities", { cookie })).data.total, 2);
});

test("ORG DB constraints enforce officer FK, unique, statuses and no physical deletion", async (t) => {
  const f = await fixture(t);
  const officer = await f.officer();
  assert.throws(() =>
    f.db.prepare("UPDATE officers SET unit_id='missing' WHERE id=?").run(officer.id),
  );
  assert.throws(() =>
    f.db.prepare("UPDATE officers SET business_role='A99' WHERE id=?").run(officer.id),
  );
  assert.throws(() =>
    f.db.prepare("UPDATE officers SET status='UNKNOWN' WHERE id=?").run(officer.id),
  );
  assert.throws(() =>
    f.db
      .prepare(
        "UPDATE officers SET status='INACTIVE',status_reason=NULL,status_effective_date=NULL WHERE id=?",
      )
      .run(officer.id),
  );
  assert.throws(() => f.db.prepare("DELETE FROM officers WHERE id=?").run(officer.id));
  assert.throws(() => f.db.prepare("UPDATE units SET parent_id=id WHERE id='DV-KV10'").run());
  assert.deepEqual(f.db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("ORG duplicate edit returns 409 and inactive unit/leader cannot be assigned", async (t) => {
  const f = await fixture(t);
  const a = await f.officer();
  const b = await f.officer();
  for (const body of [
    { officerCode: a.officerCode.toLowerCase() },
    { email: a.email.toUpperCase() },
  ])
    assert.equal(
      (await f.request(`/api/officers/${b.id}`, { method: "PATCH", cookie: f.cookie, body }))
        .status,
      409,
    );
  const ward = await f.unit();
  assert.equal(
    (
      await f.request(`/api/units/${ward.id}/status`, {
        method: "PATCH",
        cookie: f.cookie,
        body: { status: "INACTIVE" },
      })
    ).status,
    200,
  );
  const result = await f.request(`/api/officers/${a.id}`, {
    method: "PATCH",
    cookie: f.cookie,
    body: { unitId: ward.id },
  });
  assert.ok([400, 409].includes(result.status));
  assert.equal(
    (
      await f.request(`/api/officers/${a.id}/status`, {
        method: "PATCH",
        cookie: f.cookie,
        body: { status: "INACTIVE", reason: "Nghỉ kiểm thử", effectiveDate: "2026-10-13" },
      })
    ).status,
    200,
  );
  const activeWard = await f.unit();
  assert.ok(
    [400, 409].includes(
      (
        await f.request(`/api/units/${activeWard.id}`, {
          method: "PATCH",
          cookie: f.cookie,
          body: { leaderOfficerId: a.id },
        })
      ).status,
    ),
  );
});

test("ORG real SQLite reopen retains officers, edits, status and audit; reseed never overwrites", async () => {
  const directory = mkdtempSync(join(tmpdir(), "pccc-org-restart-"));
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
  const path = join(directory, "restart.sqlite");
  let db;
  let server;
  try {
    db = openDatabase(path);
    await seedDemo(db, password);
    db.exec(
      "UPDATE accounts SET must_change_password=0; INSERT OR IGNORE INTO role_permissions VALUES ('A05','M02.create'); INSERT OR IGNORE INTO role_permissions VALUES ('A05','M02.view'); INSERT OR IGNORE INTO role_permissions VALUES ('A05','M02.edit')",
    );
    server = createApp(db, { appOrigin: origin });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    const login = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ username: "demo.admin", password }),
    });
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const payload = {
      officerCode: "PERSIST",
      fullName: "Cán bộ tồn tại sau khởi động",
      rank: "Đại úy",
      position: "Cán bộ",
      phone: "0900000001",
      email: "persist@example.test",
      unitId: "DV-KV10",
      businessRole: "A04",
    };
    const created = await fetch(base + "/api/officers", {
      method: "POST",
      headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(created.status, 201);
    const officer = (await created.json()).officer;
    await new Promise((done) => server.close(done));
    server = null;
    const record = db.prepare("SELECT * FROM officers WHERE id=?").get(officer.id);
    const logs = auditFor(db, officer.id);
    db.close();
    db = openDatabase(path);
    assert.deepEqual(db.prepare("SELECT * FROM officers WHERE id=?").get(officer.id), record);
    assert.deepEqual(auditFor(db, officer.id), logs);
    db.prepare("UPDATE officers SET notes='Người dùng đã chỉnh sửa' WHERE id=?").run(officer.id);
    const count = db.prepare("SELECT count(*) AS n FROM officers").get().n;
    const grants = db.prepare("SELECT * FROM role_permissions").all();
    await seedDemo(db, password);
    assert.equal(db.prepare("SELECT count(*) AS n FROM officers").get().n, count);
    assert.equal(
      db.prepare("SELECT notes FROM officers WHERE id=?").get(officer.id).notes,
      "Người dùng đã chỉnh sửa",
    );
    assert.deepEqual(db.prepare("SELECT * FROM role_permissions").all(), grants);
  } finally {
    if (server) await new Promise((done) => server.close(done));
    db?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ORG ancestor context cannot reveal notes and hidden leaders survive ordinary scoped edits", async (t) => {
  const f = await fixture(t);
  const leader = await f.officer();
  const ward = await f.unit({ leaderOfficerId: leader.id });
  f.db.prepare("UPDATE units SET notes='PRIVATE-AREA-NOTES' WHERE id='DV-KV10'").run();
  const narrowCookie = await f.login("demo.can-bo");
  const tree = await f.request("/api/organization/tree", { cookie: narrowCookie });
  assert.ok(!JSON.stringify(tree.data).includes("PRIVATE-AREA-NOTES"));
  const context = await f.request("/api/units/DV-KV10", { cookie: narrowCookie });
  assert.ok(!JSON.stringify(context.data).includes("PRIVATE-AREA-NOTES"));
  f.db.prepare("DELETE FROM account_scopes WHERE account_id='DEMO-A04'").run();
  f.db
    .prepare("INSERT INTO account_scopes(account_id,kind,unit_id) VALUES ('DEMO-A04','unit',?)")
    .run(ward.id);
  const cookie = await f.login("demo.tong-hop");
  const detail = await f.request(`/api/units/${ward.id}`, { cookie });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.unit.leaderOfficerId, null);
  const edited = await f.request(`/api/units/${ward.id}`, {
    method: "PATCH",
    cookie,
    body: { name: "Chỉ sửa tên" },
  });
  assert.equal(edited.status, 200, JSON.stringify(edited.data));
  assert.equal(JSON.parse(auditFor(f.db, ward.id).at(-1).before_json).leaderOfficerId, leader.id);
  assert.equal(
    f.db.prepare("SELECT leader_officer_id FROM units WHERE id=?").get(ward.id).leader_officer_id,
    leader.id,
  );
});

test("ORG unit staff scope does not expand through cross-unit legacy facility assignments", async (t) => {
  const f = await fixture(t);
  const cookie = await f.login("demo.chi-huy");
  // CS002 is in KV10 but its legacy officer CB-OTHER belongs to KV11.
  const list = await f.request("/api/officers", { cookie });
  assert.ok(!list.data.items.some((row) => row.id === "CB-OTHER"));
  assert.equal((await f.request("/api/officers/CB-OTHER", { cookie })).status, 404);
  const options = await f.request("/api/organization/options", { cookie });
  assert.ok(!options.data.officers.some((row) => row.id === "CB-OTHER"));
  assert.equal((await f.request("/api/facilities", { cookie })).data.total, 2);
  assert.equal(
    f.db.prepare("SELECT officer_id FROM facilities WHERE id='CS002'").get().officer_id,
    "CB-OTHER",
  );
});

test("ORG neighborhood edit/status audit and rollback share the existing regions source", async (t) => {
  const f = await fixture(t);
  const ward = await f.unit();
  const created = await f.request("/api/organization/regions", {
    method: "POST",
    cookie: f.cookie,
    body: {
      code: "REGION-FLOW",
      name: "Khu phố kiểm thử luồng",
      level: "NEIGHBORHOOD",
      parentId: ward.id,
    },
  });
  assert.equal(created.status, 201);
  const id = created.data.region.id;
  assert.equal(
    (
      await f.request("/api/organization/regions", {
        method: "POST",
        cookie: f.cookie,
        body: { code: "region-flow", name: "Trùng mã", parentId: ward.id },
      })
    ).status,
    409,
  );
  const edited = await f.request(`/api/organization/regions/${id}`, {
    method: "PATCH",
    cookie: f.cookie,
    body: { notes: "Ghi chú khu phố" },
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.region.name, created.data.region.name);
  const before = f.db.prepare("SELECT * FROM regions WHERE id=?").get(id);
  f.db.exec(
    "CREATE TRIGGER fail_region_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'test rollback'); END",
  );
  assert.equal(
    (
      await f.request(`/api/organization/regions/${id}/status`, {
        method: "PATCH",
        cookie: f.cookie,
        body: { status: "INACTIVE" },
      })
    ).status,
    500,
  );
  assert.deepEqual(f.db.prepare("SELECT * FROM regions WHERE id=?").get(id), before);
  f.db.exec("DROP TRIGGER fail_region_audit");
  assert.equal(
    (
      await f.request(`/api/organization/regions/${id}/status`, {
        method: "PATCH",
        cookie: f.cookie,
        body: { status: "INACTIVE" },
      })
    ).status,
    200,
  );
  assert.equal(JSON.parse(auditFor(f.db, id).at(-1).after_json).status, "INACTIVE");
});

test("ORG revoked session while request body is streaming cannot commit an officer", async (t) => {
  const f = await fixture(t);
  const before = f.db.prepare("SELECT count(*) AS n FROM officers").get().n;
  const body = JSON.stringify({
    officerCode: "REVOKED",
    fullName: "Cán bộ không được tạo",
    rank: "Đại úy",
    position: "Cán bộ",
    phone: "0900000001",
    email: "revoked@example.test",
    unitId: "DV-KV10",
    businessRole: "A03",
  });
  let request;
  const completed = new Promise((done, reject) => {
    request = httpRequest(
      f.base + "/api/officers",
      {
        method: "POST",
        headers: {
          Origin: origin,
          Cookie: f.cookie,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        response.resume();
        response.on("end", () => done(response.statusCode));
      },
    );
    request.on("error", reject);
  });
  const first = body.indexOf(",");
  request.write(body.slice(0, first));
  await new Promise((done) => setTimeout(done, 30));
  f.db.prepare("DELETE FROM sessions WHERE account_id='DEMO-A05'").run();
  request.end(body.slice(first));
  assert.equal(await completed, 401);
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM officers").get().n, before);
});
