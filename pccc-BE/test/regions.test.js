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

  assert.equal((await request("/api/regions", { cookie: officer })).status, 403);
  assert.equal((await request("/api/units", { cookie: commander })).status, 200);
  assert.equal((await request("/api/regions/officers", { cookie: commander })).status, 200);
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
