import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";

const password = "Isolated-inc-org-test-password-2026";
const origin = "http://localhost:3000";
const now = Date.UTC(2026, 9, 14, 3);

async function fixture(t) {
  const db = openDatabase(":memory:");
  await seedDemo(db, password);
  db.exec("UPDATE accounts SET must_change_password=0");
  const server = createApp(db, { appOrigin: origin, logger: { error() {} } });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((done) => server.close(done));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  const request = async (path, body, method = "PATCH") => {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie"),
    };
  };
  const login = await request("/api/auth/login", { username: "demo.admin", password }, "POST");
  assert.equal(login.status, 200);
  cookie = login.cookie.split(";")[0];
  let serial = 0;
  async function officer() {
    const number = ++serial;
    const result = await request(
      "/api/officers",
      {
        officerCode: `INC-ORG-CB-${number}`,
        fullName: "Cán bộ giả lập",
        rank: "Đại úy",
        position: "Cán bộ",
        phone: "0900000000",
        email: `inc-org-${number}@example.test`,
        unitId: "DV-KV10",
        businessRole: "A03",
      },
      "POST",
    );
    assert.equal(result.status, 201, JSON.stringify(result.data));
    return result.data.officer;
  }
  async function ward(parentId = "DV-KV10") {
    const result = await request(
      "/api/units",
      {
        code: `INC-ORG-P-${++serial}`,
        name: "Phường giả lập",
        level: "WARD",
        parentId,
      },
      "POST",
    );
    assert.equal(result.status, 201, JSON.stringify(result.data));
    return result.data.unit;
  }
  return { db, request, officer, ward };
}

function incident(
  db,
  { id = "INC-ORG-INC", unitId = "DV-KV10", regionId = null, status = "NEW", draft = false } = {},
) {
  db.prepare(
    `INSERT INTO incidents
    (id,incident_code,incident_type,occurred_at,reported_at,address,unit_id,region_id,record_status,
     processing_status,completed_at,created_by,updated_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,'DEMO-A04','DEMO-A04',?,?)`,
  ).run(
    id,
    id,
    draft ? null : "FIRE",
    draft ? null : now,
    now,
    draft ? "" : "Địa chỉ giả lập",
    unitId,
    regionId,
    draft ? "DRAFT" : "OFFICIAL",
    status,
    ["COMPLETED", "CLOSED"].includes(status) ? now : null,
    now,
    now,
  );
}

function assignment(db, officerId, status = "ASSIGNED") {
  db.prepare(
    `INSERT INTO incident_assignments
    (id,incident_id,officer_id,assigned_by,task_description,status,assigned_at,completed_at,updated_at)
    VALUES ('INC-ORG-TASK','INC-ORG-INC',?,'DEMO-A04','Nhiệm vụ giả lập',?,?,?,?)`,
  ).run(officerId, status, now, status === "COMPLETED" ? now : null, now);
}

test("M02 blocks departure and transfer of an officer with active M09 work; cancelling releases the blocker", async (t) => {
  const f = await fixture(t);
  const officer = await f.officer();
  incident(f.db);
  assignment(f.db, officer.id);
  const before = f.db.prepare("SELECT * FROM officers WHERE id=?").get(officer.id);
  const auditBefore = f.db.prepare("SELECT count(*) AS total FROM audit_logs").get().total;
  for (const [path, body] of [
    [
      `/api/officers/${officer.id}/status`,
      { status: "INACTIVE", reason: "Lý do giả lập", effectiveDate: "2026-10-14" },
    ],
    [`/api/officers/${officer.id}`, { unitId: "DV-KV11" }],
  ]) {
    const result = await f.request(path, body);
    assert.equal(result.status, 409, JSON.stringify(result.data));
    assert.equal(result.data.error.code, "ACTIVE_RESPONSIBILITIES");
  }
  assert.deepEqual(f.db.prepare("SELECT * FROM officers WHERE id=?").get(officer.id), before);
  assert.equal(f.db.prepare("SELECT count(*) AS total FROM audit_logs").get().total, auditBefore);
  f.db.exec("UPDATE incident_assignments SET status='CANCELLED' WHERE id='INC-ORG-TASK'");
  const result = await f.request(`/api/officers/${officer.id}/status`, {
    status: "INACTIVE",
    reason: "Nhiệm vụ giả lập đã hủy",
    effectiveDate: "2026-10-14",
  });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(
    f.db.prepare("SELECT status FROM officers WHERE id=?").get(officer.id).status,
    "INACTIVE",
  );
  assert.equal(
    f.db.prepare("SELECT officer_id FROM incident_assignments").get().officer_id,
    officer.id,
  );
});

test("M02 historical M09 assignments on a closed incident do not freeze officer transfers", async (t) => {
  const f = await fixture(t);
  const officer = await f.officer();
  incident(f.db, { status: "CLOSED" });
  assignment(f.db, officer.id);
  const result = await f.request(`/api/officers/${officer.id}`, { unitId: "DV-KV11" });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(
    f.db.prepare("SELECT unit_id FROM officers WHERE id=?").get(officer.id).unit_id,
    "DV-KV11",
  );
  assert.equal(
    f.db.prepare("SELECT officer_id FROM incident_assignments").get().officer_id,
    officer.id,
  );
});

test("M02 preserves M09 unit references for draft and closed history without blocking an unrelated empty unit", async (t) => {
  const f = await fixture(t);
  const draftWard = await f.ward();
  const historicalWard = await f.ward();
  const emptyWard = await f.ward();
  incident(f.db, { id: "INC-ORG-DRAFT", unitId: draftWard.id, draft: true });
  incident(f.db, { id: "INC-ORG-HISTORY", unitId: historicalWard.id, status: "CLOSED" });
  for (const ward of [draftWard, historicalWard]) {
    const before = f.db.prepare("SELECT * FROM units WHERE id=?").get(ward.id);
    const auditBefore = f.db.prepare("SELECT count(*) AS total FROM audit_logs").get().total;
    for (const [path, body, code] of [
      [`/api/units/${ward.id}/status`, { status: "INACTIVE" }, "ACTIVE_DEPENDENCIES"],
      [`/api/units/${ward.id}`, { parentId: "DV-KV11" }, "REPARENT_REFERENCED"],
    ]) {
      const result = await f.request(path, body);
      assert.equal(result.status, 409, JSON.stringify(result.data));
      assert.equal(result.data.error.code, code);
    }
    assert.deepEqual(f.db.prepare("SELECT * FROM units WHERE id=?").get(ward.id), before);
    assert.equal(f.db.prepare("SELECT count(*) AS total FROM audit_logs").get().total, auditBefore);
  }
  assert.equal(
    (await f.request(`/api/units/${emptyWard.id}/status`, { status: "INACTIVE" })).status,
    200,
  );
});

test("M02 region status and ancestry stay unchanged when M09 holds a historical reference", async (t) => {
  const f = await fixture(t);
  const source = await f.ward();
  const target = await f.ward("DV-KV11");
  const created = await f.request(
    "/api/organization/regions",
    {
      code: "INC-ORG-KP",
      name: "Khu phố giả lập",
      parentId: source.id,
      level: "NEIGHBORHOOD",
    },
    "POST",
  );
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const region = created.data.region;
  incident(f.db, { regionId: region.id, unitId: null, status: "COMPLETED" });
  const before = f.db.prepare("SELECT * FROM regions WHERE id=?").get(region.id);
  const auditBefore = f.db.prepare("SELECT count(*) AS total FROM audit_logs").get().total;
  for (const [path, body, code] of [
    [
      `/api/organization/regions/${region.id}/status`,
      { status: "INACTIVE" },
      "ACTIVE_DEPENDENCIES",
    ],
    [`/api/organization/regions/${region.id}`, { parentId: target.id }, "REPARENT_REFERENCED"],
  ]) {
    const result = await f.request(path, body);
    assert.equal(result.status, 409, JSON.stringify(result.data));
    assert.equal(result.data.error.code, code);
  }
  assert.deepEqual(f.db.prepare("SELECT * FROM regions WHERE id=?").get(region.id), before);
  assert.equal(f.db.prepare("SELECT count(*) AS total FROM audit_logs").get().total, auditBefore);
  assert.deepEqual(f.db.prepare("PRAGMA foreign_key_check").all(), []);
});
