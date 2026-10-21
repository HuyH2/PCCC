import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";

const password = "Facility-history-test-2026";

test("legacy history table gains decision reference without losing rows", async () => {
  const directory = mkdtempSync(join(tmpdir(), "pccc-facility-upgrade-"));
  const path = join(directory, "legacy.sqlite");
  let db;
  try {
    db = openDatabase(path);
    await seedDemo(db, password);
    const previous = db.prepare("SELECT count(*) AS n FROM facility_status_history").get().n;
    db.exec("ALTER TABLE facility_status_history DROP COLUMN decision_reference");
    db.prepare("DELETE FROM schema_migrations WHERE name=?").run(
      "013-facility-history-decision-reference.cjs",
    );
    db.close();
    db = openDatabase(path);
    assert(
      db
        .prepare("PRAGMA table_info(facility_status_history)")
        .all()
        .some((column) => column.name === "decision_reference"),
    );
    assert.equal(db.prepare("SELECT count(*) AS n FROM facility_status_history").get().n, previous);
    await seedDemo(db, password);
    assert.equal(db.prepare("SELECT count(*) AS n FROM facility_status_history").get().n, previous);
  } finally {
    db?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

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
        Origin: "http://localhost:3000",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  async function login(username) {
    const result = await request("/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    assert.equal(result.status, 200);
    return result.cookie;
  }
  return { db, request, login };
}

test("status transition writes immutable history and audit, and timeline filters by type/time", async (t) => {
  const { db, request, login } = await fixture(t);
  const officer = await login("demo.can-bo");
  const commander = await login("demo.chi-huy");
  const base = "/api/facilities/CS001";
  assert.equal((await request(`${base}/status`)).status, 401);
  assert.equal((await request(`${base}/status`, { cookie: officer })).data.status, "active");
  const changed = await request(`${base}/status`, {
    method: "PUT",
    cookie: officer,
    body: { status: "paused", reason: "Cơ sở tạm ngừng để bảo trì" },
  });
  assert.equal(changed.status, 200);
  assert.equal(changed.data.previousStatus, "active");
  assert.equal(db.prepare("SELECT status FROM facilities WHERE id='CS001'").get().status, "paused");
  const history = await request(`${base}/status-history`, { cookie: officer });
  assert.equal(history.data.total, 1);
  assert.equal(history.data.items[0].actor_username, "demo.can-bo");
  assert.equal(history.data.items[0].reason, "Cơ sở tạm ngừng để bảo trì");
  const updated = await request(base, {
    method: "PUT",
    cookie: officer,
    body: { name: "Cơ sở đã cập nhật", address: "Địa chỉ mới" },
  });
  assert.equal(updated.status, 200);
  assert.equal((await request(`${base}/changes`, { cookie: officer })).data.total, 1);
  assert.equal((await request(`${base}/timeline`, { cookie: officer })).data.total, 2);
  assert.equal((await request(`${base}/timeline?type=status`, { cookie: officer })).data.total, 1);
  assert.equal((await request(`${base}/timeline?type=details`, { cookie: officer })).data.total, 1);
  assert.equal(
    (await request(`${base}/timeline?from=2099-01-01T00:00:00Z`, { cookie: officer })).data.total,
    0,
  );
  assert.equal((await request(`${base}/timeline?from=bad`, { cookie: officer })).status, 400);
  assert.equal((await request(`${base}/timeline?type=other`, { cookie: officer })).status, 400);
  const suspended = await request(`${base}/status`, {
    method: "PUT",
    cookie: commander,
    body: { status: "suspended", reason: "Theo quyết định xử lý", decisionReference: "QD-QA-01" },
  });
  assert.equal(suspended.status, 200);
  const statusTimeline = await request(`${base}/timeline?type=status`, { cookie: officer });
  assert.equal(statusTimeline.data.total, 2);
  assert.equal(statusTimeline.data.items[0].decision_reference, "QD-QA-01");
  assert.equal(
    (
      await request(`${base}/status`, {
        method: "PUT",
        cookie: officer,
        body: { status: "active", reason: "Tự đề nghị" },
      })
    ).status,
    403,
  );
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM facility_status_history WHERE facility_id='CS001'").get()
      .n,
    2,
  );
  const auditId = db
    .prepare("SELECT audit_log_id FROM facility_status_history ORDER BY id DESC LIMIT 1")
    .get().audit_log_id;
  assert.equal(
    db.prepare("SELECT action FROM audit_logs WHERE id=?").get(auditId).action,
    "facility.status_changed",
  );
  assert.throws(() => db.prepare("DELETE FROM facility_status_history").run());
});

test("scope, permission and validation protect reads and mutations without partial history", async (t) => {
  const { db, request, login } = await fixture(t);
  const officer = await login("demo.can-bo");
  const viewer = await login("demo.nguoi-xem");
  const base = "/api/facilities/CS001";
  assert.equal((await request("/api/facilities/CS003/timeline", { cookie: officer })).status, 404);
  assert.equal((await request(`${base}/status`, { cookie: viewer })).status, 200);
  assert.equal(
    (await request(base, { method: "PUT", cookie: viewer, body: { name: "Không được" } })).status,
    403,
  );
  assert.equal(
    (
      await request(`${base}/status`, {
        method: "PUT",
        cookie: officer,
        body: { status: "suspended", reason: "Không có quyền", decisionReference: "QD-01" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`${base}/status`, {
        method: "PUT",
        cookie: officer,
        body: { status: "paused", reason: "" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`${base}/status`, {
        method: "PUT",
        cookie: officer,
        body: { status: "active", reason: "Không thay đổi" },
      })
    ).status,
    409,
  );
  assert.equal(
    (await request(base, { method: "PUT", cookie: officer, body: { name: 5 } })).status,
    400,
  );
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM facility_status_history WHERE facility_id='CS001'").get()
      .n,
    0,
  );
  assert.equal(db.prepare("SELECT status FROM facilities WHERE id='CS001'").get().status, "active");
});

test("admin approval restores suspended facility only with evidence, decision and explicit confirmation", async (t) => {
  const { db, request, login } = await fixture(t);
  const admin = await login("demo.admin");
  const officer = await login("demo.can-bo");
  assert.equal((await request("/api/violations", { cookie: officer })).data.total, 0);
  assert.equal(
    (await request("/api/violations?status=suspended", { cookie: admin })).data.total,
    1,
  );
  const base = "/api/facilities/CS002/status";
  const restore = {
    status: "active",
    reason: "Đã khắc phục và được phê duyệt",
    remediationEvidence: "Biên bản QA số 01 và ảnh minh chứng",
    decisionReference: "QD-QA-RESTORE-01",
    approvalConfirmed: true,
  };
  assert.equal(
    (await request(base, { method: "PUT", cookie: officer, body: restore })).status,
    404,
  );
  assert.equal(
    (
      await request(base, {
        method: "PUT",
        cookie: admin,
        body: { ...restore, approvalConfirmed: false },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(base, {
        method: "PUT",
        cookie: admin,
        body: { ...restore, remediationEvidence: "" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(base, {
        method: "PUT",
        cookie: admin,
        body: { ...restore, decisionReference: "" },
      })
    ).status,
    400,
  );
  assert.equal((await request(base, { method: "PUT", cookie: admin, body: restore })).status, 200);
  assert.equal(db.prepare("SELECT status FROM facilities WHERE id='CS002'").get().status, "active");
  const record = db.prepare("SELECT * FROM facility_violations WHERE facility_id='CS002'").get();
  assert.equal(record.status, "restored");
  assert.equal(record.approved_by, "DEMO-A05");
  assert.equal(record.restoration_decision_reference, "QD-QA-RESTORE-01");
  assert.equal((await request("/api/violations?status=restored", { cookie: admin })).data.total, 1);
  assert.equal((await request("/api/facilities/CS002/timeline", { cookie: admin })).data.total, 2);
  await seedDemo(db, password);
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM facility_violations WHERE facility_id='CS002'").get().n,
    1,
  );
});

test("failed audit insert rolls back facility status and violation record", async (t) => {
  const { db, request, login } = await fixture(t);
  const commander = await login("demo.chi-huy");
  db.exec(`CREATE TRIGGER reject_facility_status_audit BEFORE INSERT ON audit_logs
    WHEN NEW.action='facility.status_changed'
    BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END`);
  const result = await request("/api/facilities/CS001/status", {
    method: "PUT",
    cookie: commander,
    body: {
      status: "suspended",
      reason: "Kiểm tra transaction",
      decisionReference: "QD-QA-ROLLBACK",
    },
  });
  assert.equal(result.status, 500);
  assert.equal(db.prepare("SELECT status FROM facilities WHERE id='CS001'").get().status, "active");
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM facility_status_history WHERE facility_id='CS001'").get()
      .n,
    0,
  );
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM facility_violations WHERE facility_id='CS001'").get().n,
    0,
  );
});
