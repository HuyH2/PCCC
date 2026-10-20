import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";

const password = "Region-test-password-2026";
const origin = "http://localhost:3000";

async function fixture(t) {
  const db = openDatabase(":memory:");
  await seedDemo(db, password);
  db.exec("UPDATE accounts SET must_change_password=0");
  const server = createApp(db);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { method = "GET", cookie, body } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  async function login(username = "demo.admin", secret = password) {
    const response = await request("/api/auth/login", {
      method: "POST",
      body: { username, password: secret },
    });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return response.cookie;
  }
  return { db, request, login };
}

test("region catalogue follows the caller scope and M02 grants", async (t) => {
  const { request, login } = await fixture(t);
  const admin = await login();
  const commander = await login("demo.chi-huy");
  const officer = await login("demo.can-bo");

  const all = await request("/api/regions?pageSize=50", { cookie: admin });
  assert.equal(all.status, 200);
  assert.deepEqual(
    all.data.items.map((item) => item.id),
    ["KP01", "KP02", "KP03"],
  );
  assert.equal(all.data.items[0].facility_count, 1);

  const scoped = await request("/api/regions?pageSize=50", { cookie: commander });
  assert.equal(scoped.status, 200);
  assert.deepEqual(
    scoped.data.items.map((item) => item.id),
    ["KP01", "KP02"],
  );

  const searched = await request("/api/regions?search=02&pageSize=50", { cookie: admin });
  assert.deepEqual(
    searched.data.items.map((item) => item.id),
    ["KP02"],
  );
  const byUnit = await request("/api/regions?unitId=DV-KV11&pageSize=50", { cookie: admin });
  assert.deepEqual(
    byUnit.data.items.map((item) => item.id),
    ["KP03"],
  );
  const paged = await request("/api/regions?page=2&pageSize=2", { cookie: admin });
  assert.equal(paged.data.total, 3);
  assert.deepEqual(
    paged.data.items.map((item) => item.id),
    ["KP03"],
  );

  assert.equal((await request("/api/regions", { cookie: officer })).status, 403);
  assert.equal((await request("/api/units", { cookie: commander })).status, 200);
  assert.equal((await request("/api/regions/officers", { cookie: commander })).status, 200);
  assert.equal((await request("/api/regions/KP03", { cookie: commander })).status, 404);
  assert.equal((await request("/api/regions/KP03/officers", { cookie: commander })).status, 404);
});

test("assignment keeps one owner, history and the data scope in sync", async (t) => {
  const { db, request, login } = await fixture(t);
  const commander = await login("demo.chi-huy");

  const assigned = await request("/api/regions/KP01/assignment", {
    method: "POST",
    cookie: commander,
    body: { accountId: "DEMO-A04", effectiveDate: "2026-11-01", note: "Điều động cán bộ" },
  });
  assert.equal(assigned.status, 200, JSON.stringify(assigned.data));
  assert.equal(assigned.data.region.officer_account_id, "DEMO-A04");
  assert.equal(assigned.data.region.effective_date, "2026-11-01");
  assert.equal(assigned.data.history.length, 1);
  assert.equal(assigned.data.history[0].action, "assign");
  assert.equal(assigned.data.history[0].from_name, "Cán bộ kiểm tra/Quản lý địa bàn (mẫu)");
  assert.equal(assigned.data.history[0].to_name, "Cán bộ tổng hợp (mẫu)");
  assert.equal(
    db.prepare("SELECT account_id FROM region_assignments WHERE region_id='KP01'").get().account_id,
    "DEMO-A04",
  );
  assert.ok(
    db
      .prepare(
        "SELECT 1 FROM account_scopes WHERE account_id='DEMO-A04' AND kind='region' AND region_id='KP01'",
      )
      .get(),
  );
  assert.equal(
    db.prepare("SELECT 1 FROM account_scopes WHERE account_id='DEMO-A03' AND kind='region'").get(),
    undefined,
  );
  assert.ok(
    db
      .prepare(
        "SELECT 1 FROM account_scopes WHERE account_id='DEMO-A03' AND kind='facility' AND facility_id='CS001'",
      )
      .get(),
  );

  const repeated = await request("/api/regions/KP01/assignment", {
    method: "POST",
    cookie: commander,
    body: { accountId: "DEMO-A04" },
  });
  assert.equal(repeated.status, 409);

  const unassigned = await request("/api/regions/KP01/assignment", {
    method: "POST",
    cookie: commander,
    body: { accountId: null, note: "Kết thúc phụ trách" },
  });
  assert.equal(unassigned.status, 200);
  assert.equal(unassigned.data.region.officer_account_id, null);
  assert.equal(unassigned.data.history[0].action, "unassign");
  assert.equal(
    db.prepare("SELECT 1 FROM region_assignments WHERE region_id='KP01'").get(),
    undefined,
  );

  const audit = db
    .prepare("SELECT action FROM audit_logs WHERE object_id='KP01' ORDER BY id")
    .all()
    .map((row) => row.action);
  assert.deepEqual(audit, ["region.assigned", "region.unassigned"]);
});

test("region and account writes validate input, permissions and lifecycle", async (t) => {
  const { db, request, login } = await fixture(t);
  const admin = await login();
  const commander = await login("demo.chi-huy");

  assert.equal(
    (
      await request("/api/regions", {
        method: "POST",
        cookie: commander,
        body: { id: "KP09", name: "Khu phố 09", unitId: "DV-KV10" },
      })
    ).status,
    403,
  );

  const created = await request("/api/regions", {
    method: "POST",
    cookie: admin,
    body: { id: "KP09", name: "Khu phố 09", unitId: "DV-KV11" },
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.region.id, "KP09");
  assert.equal(
    (
      await request("/api/regions", {
        method: "POST",
        cookie: admin,
        body: { id: "KP09", name: "Trùng mã", unitId: "DV-KV11" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/api/regions", {
        method: "POST",
        cookie: admin,
        body: { id: "KP10", name: "Sai đơn vị", unitId: "DV-MISSING" },
      })
    ).status,
    400,
  );

  const account = {
    username: "canbo.moi",
    fullName: "Cán bộ mới",
    officerId: "CB-NEW",
    role: "A03",
    password: "Temp-password-2026",
    scopes: [{ kind: "unit", targetId: "DV-KV10" }],
  };
  const newAccount = await request("/api/authorization/accounts", {
    method: "POST",
    cookie: admin,
    body: account,
  });
  assert.equal(newAccount.status, 201, JSON.stringify(newAccount.data));
  assert.equal(newAccount.data.account.must_change_password, 1);
  assert.equal(newAccount.data.account.status, "active");
  assert.equal(
    (
      await request("/api/authorization/accounts", {
        method: "POST",
        cookie: admin,
        body: { ...account, username: "khac.ten" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/api/authorization/accounts", {
        method: "POST",
        cookie: admin,
        body: { ...account, officerId: "CB-KHAC" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/api/authorization/accounts", {
        method: "POST",
        cookie: commander,
        body: { ...account, username: "canbo.khac", officerId: "CB-KHAC" },
      })
    ).status,
    403,
  );

  const memberCookie = await login("canbo.moi", "Temp-password-2026");
  assert.ok(memberCookie);

  const reset = await request(
    `/api/authorization/accounts/${newAccount.data.account.id}/reset-password`,
    {
      method: "POST",
      cookie: admin,
      body: { password: "Another-password-2026" },
    },
  );
  assert.equal(reset.status, 200);
  assert.equal((await request("/api/auth/me", { cookie: memberCookie })).status, 401);

  const inactive = await request(
    `/api/authorization/accounts/${newAccount.data.account.id}/status`,
    {
      method: "POST",
      cookie: admin,
      body: { status: "inactive" },
    },
  );
  assert.equal(inactive.status, 200);
  assert.equal(inactive.data.account.status, "inactive");
  assert.equal(
    (
      await request("/api/auth/login", {
        method: "POST",
        body: { username: "canbo.moi", password: "Another-password-2026" },
      })
    ).status,
    403,
  );

  const reactivated = await request(
    `/api/authorization/accounts/${newAccount.data.account.id}/status`,
    {
      method: "POST",
      cookie: admin,
      body: { status: "active" },
    },
  );
  assert.equal(reactivated.status, 200);
  await login("canbo.moi", "Another-password-2026");

  assert.equal(
    (
      await request("/api/regions/KP09/assignment", {
        method: "POST",
        cookie: commander,
        body: { accountId: newAccount.data.account.id },
      })
    ).status,
    404,
    "Commander must not assign a region outside the granted unit",
  );
  assert.equal(
    (
      await request("/api/regions/KP09/assignment", {
        method: "POST",
        cookie: admin,
        body: { accountId: newAccount.data.account.id },
      })
    ).status,
    200,
  );
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM assignment_events WHERE region_id='KP09'").get().n,
    1,
  );
});

function accountBody(overrides = {}) {
  return {
    username: "canbo.test",
    fullName: "Cán bộ kiểm thử",
    officerId: "CB-TEST",
    role: "A03",
    password: "Temp-password-2026",
    scopes: [],
    ...overrides,
  };
}

test("officer lookup and assignment target obey the caller scope", async (t) => {
  const { db, request, login } = await fixture(t);
  const admin = await login();
  const commander = await login("demo.chi-huy");
  const created = await request("/api/authorization/accounts", {
    method: "POST",
    cookie: admin,
    body: accountBody({
      username: "kv11.officer",
      fullName: "Cán bộ KV11",
      officerId: "CB-KV11",
      scopes: [{ kind: "unit", targetId: "DV-KV11" }],
    }),
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const outsiderId = created.data.account.id;

  const commanderList = await request("/api/regions/officers?regionId=KP02", {
    cookie: commander,
  });
  assert.equal(commanderList.status, 200);
  const commanderIds = commanderList.data.items.map((item) => item.id);
  assert.ok(!commanderIds.includes(outsiderId), "must not list accounts from DV-KV11");
  assert.ok(!commanderIds.includes("DEMO-A05"), "must not list system administrators");
  assert.ok(commanderIds.includes("DEMO-A03"), "region-scoped officer inside DV-KV10 is visible");
  assert.ok(commanderIds.includes("DEMO-A04"));

  const adminList = await request("/api/regions/officers?regionId=KP02", { cookie: admin });
  assert.ok(adminList.data.items.some((item) => item.id === outsiderId));

  const denied = await request("/api/regions/KP02/assignment", {
    method: "POST",
    cookie: commander,
    body: { accountId: outsiderId },
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.data.error.code, "ACCOUNT_OUT_OF_SCOPE");
  assert.equal(
    db
      .prepare(
        "SELECT 1 FROM account_scopes WHERE account_id=? AND kind='region' AND region_id='KP02'",
      )
      .get(outsiderId),
    undefined,
  );

  const allowed = await request("/api/regions/KP02/assignment", {
    method: "POST",
    cookie: admin,
    body: { accountId: outsiderId },
  });
  assert.equal(allowed.status, 200, JSON.stringify(allowed.data));
  assert.equal(allowed.data.region.officer_account_id, outsiderId);
});

test("region detail and counts never expose facilities outside the caller scope", async (t) => {
  const { db, request, login } = await fixture(t);
  const admin = await login();
  db.prepare(
    "INSERT INTO facilities(id,name,address,region_id,officer_id) VALUES ('CS009','Cơ sở ngoài phạm vi','Địa chỉ giả lập','KP01','CB-OTHER')",
  ).run();
  const created = await request("/api/authorization/accounts", {
    method: "POST",
    cookie: admin,
    body: accountBody({
      username: "facility.user",
      officerId: "CB-FACILITY",
      scopes: [{ kind: "facility", targetId: "CS001" }],
    }),
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const accountId = created.data.account.id;
  db.prepare("INSERT OR IGNORE INTO role_permissions VALUES ('A03','M02.view')").run();
  db.prepare("UPDATE accounts SET must_change_password=0 WHERE id=?").run(accountId);
  const facilityUser = await login("facility.user", "Temp-password-2026");

  const detail = await request("/api/regions/KP01", { cookie: facilityUser });
  assert.equal(detail.status, 200);
  assert.deepEqual(
    detail.data.facilities.map((item) => item.id),
    ["CS001"],
  );
  assert.equal(detail.data.region.facility_count, 1);
  assert.ok(!detail.data.officers.some((item) => item.officer_id === "CB-OTHER"));

  const list = await request("/api/regions?pageSize=50", { cookie: facilityUser });
  assert.deepEqual(
    list.data.items.map((item) => item.id),
    ["KP01"],
  );
  assert.equal(list.data.items[0].facility_count, 1);

  const adminDetail = await request("/api/regions/KP01", { cookie: admin });
  assert.deepEqual(adminDetail.data.facilities.map((item) => item.id).sort(), ["CS001", "CS009"]);
  assert.equal(adminDetail.data.region.facility_count, 2);
  assert.ok(adminDetail.data.officers.some((item) => item.officer_id === "CB-OTHER"));
});

test("account changes cannot break assignment links or leave an owner without access", async (t) => {
  const { db, request, login } = await fixture(t);
  const admin = await login();

  const rename = await request("/api/authorization/accounts/DEMO-A03", {
    method: "PUT",
    cookie: admin,
    body: {
      role: "A03",
      fullName: "Cán bộ A03",
      officerId: "CB-RENAMED",
      scopes: [{ kind: "region", targetId: "KP01" }],
    },
  });
  assert.equal(rename.status, 409);
  assert.equal(rename.data.error.code, "ACCOUNT_ASSIGNED");
  assert.equal(
    db.prepare("SELECT officer_id FROM accounts WHERE id='DEMO-A03'").get().officer_id,
    "CB-A03",
  );

  const update = await request("/api/authorization/accounts/DEMO-A03", {
    method: "PUT",
    cookie: admin,
    body: { role: "A03", fullName: "Cán bộ A03", officerId: "CB-A03", scopes: [] },
  });
  assert.equal(update.status, 200, JSON.stringify(update.data));
  assert.deepEqual(update.data.scopes, []);
  assert.deepEqual(update.data.removedRegionIds, ["KP01"]);
  assert.equal(
    db.prepare("SELECT account_id FROM region_assignments WHERE region_id='KP01'").get(),
    undefined,
  );
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM account_scopes WHERE account_id='DEMO-A03'").get().n,
    0,
  );
  const event = db
    .prepare("SELECT action,reason FROM assignment_events WHERE region_id='KP01'")
    .get();
  assert.equal(event.action, "unassign");
  assert.equal(event.reason, "Thu hồi qua cập nhật phạm vi");
});

test("transfers append assignment history instead of inheriting old notes", async (t) => {
  const { db, request, login } = await fixture(t);
  const admin = await login();
  const assigned = await request("/api/regions/KP01/assignment", {
    method: "POST",
    cookie: admin,
    body: { accountId: "DEMO-A04", effectiveDate: "2026-11-01", note: "Ghi chú cũ" },
  });
  assert.equal(assigned.status, 200);

  const transfer = await request("/api/account-transfers", {
    method: "POST",
    cookie: admin,
    body: {
      sourceAccountId: "DEMO-A04",
      targetAccountId: "DEMO-A03",
      regionIds: ["KP01"],
      facilityIds: [],
      reason: "Điều động cán bộ",
    },
  });
  assert.equal(transfer.status, 201, JSON.stringify(transfer.data));

  const detail = await request("/api/regions/KP01", { cookie: admin });
  assert.equal(detail.status, 200);
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(detail.data.region.officer_account_id, "DEMO-A03");
  assert.equal(detail.data.region.effective_date, today);
  assert.equal(detail.data.region.assignment_note, "Điều động cán bộ");
  assert.equal(detail.data.history.length, 2);
  assert.equal(detail.data.history[0].action, "assign");
  assert.equal(detail.data.history[0].effective_date, today);
  assert.equal(detail.data.history[0].reason, "Điều động cán bộ");
  assert.equal(detail.data.history[0].to_name, "Cán bộ kiểm tra/Quản lý địa bàn (mẫu)");
  assert.equal(detail.data.history[0].performed_by_name, "Quản trị hệ thống (mẫu)");
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM assignment_events WHERE region_id='KP01'").get().n,
    2,
  );
});

test("assignment dates are calendar-valid", async (t) => {
  const { request, login } = await fixture(t);
  const admin = await login();
  for (const effectiveDate of ["2026-02-30", "2026-13-01", "0000-01-01", "21-10-2026"]) {
    const response = await request("/api/regions/KP02/assignment", {
      method: "POST",
      cookie: admin,
      body: { accountId: "DEMO-A04", effectiveDate },
    });
    assert.equal(response.status, 400, `${effectiveDate} must be rejected`);
    assert.equal(response.data.error.code, "INVALID_INPUT");
  }
});

test("concurrent account creation keeps username and officer id unique", async (t) => {
  const { request, login } = await fixture(t);
  const admin = await login();
  const create = (body) =>
    request("/api/authorization/accounts", { method: "POST", cookie: admin, body });

  const [sameOfficerA, sameOfficerB] = await Promise.all([
    create(accountBody({ username: "race.one", officerId: "CB-RACE" })),
    create(accountBody({ username: "race.two", officerId: "CB-RACE" })),
  ]);
  assert.deepEqual([sameOfficerA.status, sameOfficerB.status].sort(), [201, 409]);

  const [sameNameA, sameNameB] = await Promise.all([
    create(accountBody({ username: "race.same", officerId: "CB-RACE-A" })),
    create(accountBody({ username: "race.same", officerId: "CB-RACE-B" })),
  ]);
  assert.deepEqual([sameNameA.status, sameNameB.status].sort(), [201, 409]);
});

test("status guards and an audit failure roll back the assignment", async (t) => {
  const { db, request, login } = await fixture(t);
  const admin = await login();

  const self = await request("/api/authorization/accounts/DEMO-A05/status", {
    method: "POST",
    cookie: admin,
    body: { status: "inactive" },
  });
  assert.equal(self.status, 409);
  assert.equal(self.data.error.code, "SELF_LOCK");

  const invalid = await request("/api/authorization/accounts/DEMO-A04/status", {
    method: "POST",
    cookie: admin,
    body: { status: "zombie" },
  });
  assert.equal(invalid.status, 400);

  const created = await request("/api/authorization/accounts", {
    method: "POST",
    cookie: admin,
    body: accountBody({ username: "inactive.officer", officerId: "CB-INACTIVE" }),
  });
  assert.equal(created.status, 201);
  const accountId = created.data.account.id;
  await request(`/api/authorization/accounts/${accountId}/status`, {
    method: "POST",
    cookie: admin,
    body: { status: "inactive" },
  });
  const inactiveAssignment = await request("/api/regions/KP02/assignment", {
    method: "POST",
    cookie: admin,
    body: { accountId },
  });
  assert.equal(inactiveAssignment.status, 409);
  assert.equal(inactiveAssignment.data.error.code, "ACCOUNT_UNAVAILABLE");

  db.exec(
    "CREATE TRIGGER fail_region_audit BEFORE INSERT ON audit_logs WHEN NEW.action='region.assigned' BEGIN SELECT RAISE(ABORT,'test'); END",
  );
  const before = db
    .prepare("SELECT account_id FROM region_assignments WHERE region_id='KP01'")
    .get().account_id;
  const failed = await request("/api/regions/KP01/assignment", {
    method: "POST",
    cookie: admin,
    body: { accountId: "DEMO-A04", note: "audit phải rollback" },
  });
  assert.equal(failed.status, 500);
  assert.equal(
    db.prepare("SELECT account_id FROM region_assignments WHERE region_id='KP01'").get().account_id,
    before,
  );
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM assignment_events WHERE region_id='KP01'").get().n,
    0,
  );
});
