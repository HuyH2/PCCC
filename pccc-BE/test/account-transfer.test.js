import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";

const password = "Transfer-test-password-2026";
const origin = "http://localhost:3000";

async function fixture(t) {
  const db = await openDatabase(":memory:");
  await seedDemo(db, password);
  await db.exec("UPDATE accounts SET must_change_password=0");
  const server = createApp(db);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
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
  async function login(username = "demo.admin") {
    const response = await request("/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    assert.equal(response.status, 200);
    return response.cookie;
  }
  return { db, request, login };
}

const transfer = (extra = {}) => ({
  sourceAccountId: "DEMO-A03",
  targetAccountId: "DEMO-A04",
  regionIds: ["KP01"],
  facilityIds: ["CS001"],
  reason: "Cán bộ thay đổi công tác (dữ liệu mẫu)",
  ...extra,
});

test("account transfer migration and seed retain one current region owner with history constraints", async (t) => {
  const { db } = await fixture(t);
  assert.equal(
    (await db.prepare("SELECT account_id FROM region_assignments WHERE region_id='KP01'").get())
      .account_id,
    "DEMO-A03",
  );
  assert.equal(
    (await db.prepare("SELECT account_id FROM region_assignments WHERE region_id='KP02'").get())
      .account_id,
    "DEMO-A01",
  );
  await assert.rejects(
    async () =>
      await db.prepare("INSERT INTO region_assignments VALUES ('KP01','DEMO-A04',1)").run(),
  );
  await assert.rejects(
    async () =>
      await db
        .prepare(
          "INSERT INTO account_transfer_items(transfer_id,region_id,facility_id,source_officer_id,target_officer_id) VALUES ('missing','KP01','CS001','old','new')",
        )
        .run(),
  );
  await seedDemo(db, password);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM region_assignments").get()).n, 2);
});

test("administrator locks and unlocks accounts, revokes sessions and preserves last admin", async (t) => {
  const { db, request, login } = await fixture(t);
  const admin = await login();
  const officer = await login("demo.can-bo");
  const path = "/api/authorization/accounts/DEMO-A03";
  assert.equal((await request(`${path}/lock`, { method: "POST" })).status, 401);
  assert.equal((await request(`${path}/lock`, { method: "POST", cookie: officer })).status, 403);
  assert.equal((await request(`${path}/lock`, { method: "POST", cookie: admin })).status, 200);
  assert.equal(
    (await db.prepare("SELECT status FROM accounts WHERE id='DEMO-A03'").get()).status,
    "locked",
  );
  assert.equal((await request("/api/auth/me", { cookie: officer })).status, 401);
  assert.equal((await request(`${path}/lock`, { method: "POST", cookie: admin })).status, 409);
  assert.equal(
    (await request("/api/authorization/accounts/DEMO-A05/lock", { method: "POST", cookie: admin }))
      .status,
    409,
  );
  assert.equal((await request(`${path}/unlock`, { method: "POST", cookie: admin })).status, 200);
  assert.equal((await request(`${path}/unlock`, { method: "POST", cookie: admin })).status, 409);
  assert.equal(
    (
      await db
        .prepare(
          "SELECT count(*) AS n FROM audit_logs WHERE action IN ('account.locked','account.unlocked')",
        )
        .get()
    ).n,
    2,
  );
});

test("partial and full transfer update current owners, direct scope, sessions and append-only history", async (t) => {
  const { db, request, login } = await fixture(t);
  const admin = await login();
  const source = await login("demo.can-bo");
  const candidates = await request("/api/account-transfers/candidates", { cookie: admin });
  assert.equal(candidates.status, 200);
  assert.ok(candidates.data.items.some((item) => item.id === "DEMO-A03"));
  const assignments = await request("/api/account-transfers/assignments?sourceAccountId=DEMO-A03", {
    cookie: admin,
  });
  assert.deepEqual(
    assignments.data.regions.map((item) => item.id),
    ["KP01"],
  );
  assert.deepEqual(
    assignments.data.facilities.map((item) => item.id),
    ["CS001"],
  );

  const partial = await request("/api/account-transfers", {
    method: "POST",
    cookie: admin,
    body: transfer({ regionIds: [] }),
  });
  assert.equal(partial.status, 201, JSON.stringify(partial.data));
  assert.equal(
    (await db.prepare("SELECT officer_id FROM facilities WHERE id='CS001'").get()).officer_id,
    "CB-A04",
  );
  assert.equal(
    (await db.prepare("SELECT account_id FROM region_assignments WHERE region_id='KP01'").get())
      .account_id,
    "DEMO-A03",
  );
  assert.equal((await request("/api/auth/me", { cookie: source })).status, 401);
  assert.equal(
    (
      await request("/api/account-transfers", {
        method: "POST",
        cookie: admin,
        body: transfer({ regionIds: [] }),
      })
    ).status,
    409,
  );

  const full = await request("/api/account-transfers", {
    method: "POST",
    cookie: admin,
    body: transfer({ facilityIds: [] }),
  });
  assert.equal(full.status, 201, JSON.stringify(full.data));
  assert.equal(
    (await db.prepare("SELECT account_id FROM region_assignments WHERE region_id='KP01'").get())
      .account_id,
    "DEMO-A04",
  );
  assert.equal(
    (
      await db
        .prepare(
          "SELECT count(*) AS n FROM account_scopes WHERE account_id='DEMO-A03' AND kind='region'",
        )
        .get()
    ).n,
    0,
  );
  assert.equal(
    (
      await db
        .prepare(
          "SELECT count(*) AS n FROM account_scopes WHERE account_id='DEMO-A04' AND kind='region' AND region_id='KP01'",
        )
        .get()
    ).n,
    1,
  );
  const history = await request("/api/account-transfers", { cookie: admin });
  assert.equal(history.data.total, 2);
  assert.equal(history.data.items[0].items[0].id, "KP01");
  assert.equal(history.data.items[1].items[0].id, "CS001");
  for (const item of history.data.items)
    assert.equal(
      (await db.prepare("SELECT action FROM audit_logs WHERE id=?").get(item.audit_log_id)).action,
      "account.transfer_completed",
    );
  await assert.rejects(
    async () => await db.exec("DELETE FROM audit_logs WHERE action='account.transfer_completed'"),
  );
});

test("transfer denies unauthorized and invalid selections; audit failure rolls back all changes", async (t) => {
  const { db, request, login } = await fixture(t);
  const admin = await login();
  const officer = await login("demo.can-bo");
  assert.equal((await request("/api/account-transfers")).status, 401);
  assert.equal((await request("/api/account-transfers", { cookie: officer })).status, 403);
  assert.equal(
    (await request("/api/account-transfers", { method: "POST", cookie: officer, body: transfer() }))
      .status,
    403,
  );
  for (const body of [
    transfer({ targetAccountId: "DEMO-A03" }),
    transfer({ regionIds: [], facilityIds: [] }),
    transfer({ regionIds: ["KP01", "KP01"] }),
    transfer({ facilityIds: ["CS003"] }),
    transfer({ reason: "" }),
  ]) {
    const result = await request("/api/account-transfers", { method: "POST", cookie: admin, body });
    assert.ok([400, 409].includes(result.status), JSON.stringify(result.data));
  }
  await db.exec(
    "CREATE TRIGGER reject_transfer_audit BEFORE INSERT ON audit_logs FOR EACH ROW WHEN (NEW.action='account.transfer_completed') EXECUTE FUNCTION raise_abort('test')",
  );
  assert.equal(
    (await request("/api/account-transfers", { method: "POST", cookie: admin, body: transfer() }))
      .status,
    500,
  );
  assert.equal(
    (await db.prepare("SELECT officer_id FROM facilities WHERE id='CS001'").get()).officer_id,
    "CB-A03",
  );
  assert.equal(
    (await db.prepare("SELECT account_id FROM region_assignments WHERE region_id='KP01'").get())
      .account_id,
    "DEMO-A03",
  );
  assert.equal((await db.prepare("SELECT count(*) AS n FROM account_transfers").get()).n, 0);
});
