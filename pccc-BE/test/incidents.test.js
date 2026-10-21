import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { request as httpRequest } from "node:http";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";

const password = "Incidents-test-password-2026";
const origin = "http://localhost:3000";
const m09Permissions = ["M09.view", "M09.create", "M09.edit", "M09.approve", "M09.export"];

/** Every test uses a new, real SQLite file and private files under an isolated temp directory. */
async function fixture(t, appOptions = {}) {
  const directory = mkdtempSync(join(tmpdir(), "pccc-inc-test-"));
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
  const databasePath = join(directory, "test.sqlite");
  const uploadDirectory = join(directory, "private-uploads");
  const db = openDatabase(databasePath);
  await seedDemo(db, password);
  // The M04 demo seed suspends CS002; M09 scope fixtures need three active facilities.
  db.prepare("UPDATE facilities SET status='active' WHERE id='CS002'").run();
  db.exec("UPDATE accounts SET must_change_password=0");
  // These explicit grants belong only to the synthetic test database.
  for (const role of ["A01", "A02", "A03", "A04", "A05", "A06"])
    for (const permission of m09Permissions)
      db.prepare("INSERT OR IGNORE INTO role_permissions VALUES (?,?)").run(role, permission);
  const server = createApp(db, {
    appOrigin: origin,
    uploadDirectory,
    logger: { error() {} },
    ...appOptions,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    await new Promise((done) => server.close(done));
    db.close();
  }
  t.after(async () => {
    await close();
    // Check the final absolute target before recursive cleanup.
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    rmSync(directory, { recursive: true, force: true });
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
  async function incident(overrides = {}, expected = 201, userCookie = cookie) {
    serial++;
    const { deadlineAt, ...metadata } = overrides;
    const result = await request("/api/incidents", {
      method: "POST",
      cookie: userCookie,
      body: {
        title: `Sự cố kiểm thử ${serial}`,
        incidentType: "FIRE",
        occurredAt: "2026-02-15T15:30:00+07:00",
        address: "Địa chỉ mẫu phục vụ kiểm thử",
        regionId: "KP01",
        unitId: "DV-KV10",
        recordStatus: "OFFICIAL",
        ...metadata,
      },
    });
    assert.equal(result.status, expected, JSON.stringify(result.data));
    if (expected === 201 && Object.hasOwn(overrides, "deadlineAt")) {
      const deadline = await request(`/api/incidents/${result.data.incident.id}/deadline`, {
        method: "PATCH",
        cookie: userCookie,
        body: { deadlineAt, reason: "Thiết lập hạn trong cấu hình kiểm thử" },
      });
      assert.equal(deadline.status, 200, JSON.stringify(deadline.data));
      return deadline.data.incident;
    }
    return result.data.incident;
  }
  async function upload(
    id,
    {
      filename = "proof.txt",
      bytes = "Synthetic incident evidence only.",
      type = "text/plain",
      permitted = "true",
      userCookie = cookie,
    } = {},
  ) {
    const form = new FormData();
    form.set("file", new Blob([bytes], { type }), filename);
    if (permitted !== undefined) form.set("permitted", permitted);
    const response = await fetch(`${base}/api/incidents/${id}/documents`, {
      method: "POST",
      headers: { Origin: origin, ...(userCookie ? { Cookie: userCookie } : {}) },
      body: form,
    });
    return { status: response.status, data: await response.json() };
  }
  return {
    db,
    server,
    base,
    directory,
    databasePath,
    uploadDirectory,
    request,
    login,
    cookie,
    incident,
    upload,
    close,
  };
}

function audits(db, objectId) {
  return db.prepare("SELECT * FROM audit_logs WHERE object_id=? ORDER BY id").all(objectId);
}

function files(directory) {
  return existsSync(directory) ? readdirSync(directory) : [];
}

test("INC-01 drafts and official records persist in real SQLite with unique automatic codes", async (t) => {
  const f = await fixture(t);
  const draft = await f.incident({
    recordStatus: "DRAFT",
    incidentType: null,
    occurredAt: null,
    address: "",
    title: "Nháp",
  });
  assert.equal(draft.recordStatus, "DRAFT");
  const official = await f.incident({ facilityId: "CS001" });
  assert.equal(official.recordStatus, "OFFICIAL");
  assert.equal(official.processingStatus, "NEW");
  assert.ok(official.incidentCode && draft.incidentCode !== official.incidentCode);
  const detail = await f.request(`/api/incidents/${official.id}`, { cookie: f.cookie });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.incident.incidentCode, official.incidentCode);
  const stored = f.db.prepare("SELECT * FROM incidents WHERE id=?").get(official.id);
  assert.equal(stored.incident_code, official.incidentCode);
  assert.equal(stored.occurred_at, Date.parse("2026-02-15T15:30:00+07:00"));
  assert.equal(stored.facility_id, "CS001");
  assert.equal(audits(f.db, official.id).at(-1).actor_id, "DEMO-A05");
  const another = openDatabase(f.databasePath);
  try {
    assert.equal(another.prepare("SELECT count(*) AS n FROM incidents").get().n, 2);
    assert.equal(another.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    assert.deepEqual(another.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    another.close();
  }
});

test("INC-01 official validation rejects missing required fields, impossible dates and invalid references", async (t) => {
  const f = await fixture(t);
  const invalid = [
    { incidentType: null },
    { occurredAt: null },
    { address: "" },
    { occurredAt: "not-a-date" },
    { occurredAt: "2026-02-30T12:00:00+07:00" },
    { occurredAt: "2026-02-15T12:00:00" },
    { occurredAt: -1 },
    { regionId: "missing" },
    { unitId: "missing" },
    { facilityId: "missing" },
    { facilityId: "CS003" },
    { unitId: "DV-KV11" },
    { incidentType: "UNCONFIGURED" },
  ];
  for (const value of invalid) {
    const result = await f.request("/api/incidents", {
      method: "POST",
      cookie: f.cookie,
      body: {
        incidentType: "FIRE",
        occurredAt: "2026-02-15T12:00:00+07:00",
        address: "Địa chỉ mẫu",
        regionId: "KP01",
        unitId: "DV-KV10",
        recordStatus: "OFFICIAL",
        ...value,
      },
    });
    const expected = value.regionId === "missing" || value.facilityId === "missing" ? 404 : 400;
    assert.equal(result.status, expected, JSON.stringify({ value, response: result.data }));
    assert.ok(result.data.error.message);
    assert.ok(!JSON.stringify(result.data).includes("SQLITE"));
  }
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM incidents").get().n, 0);
  assert.equal(
    (
      await f.request("/api/incidents/missing", {
        method: "PATCH",
        cookie: f.cookie,
        body: { title: "Sửa" },
      })
    ).status,
    404,
  );
});

test("INC-01/02 editing classification and scene retains omitted values and audit before/after", async (t) => {
  const f = await fixture(t);
  const item = await f.incident({
    description: "Mô tả ban đầu",
    sceneDetails: "Hiện trường ban đầu",
  });
  f.db.exec(
    "INSERT INTO incident_subtypes(type_code,code,name) VALUES ('EXPLOSION','TEST','Nhóm thử nghiệm')",
  );
  const result = await f.request(`/api/incidents/${item.id}`, {
    method: "PATCH",
    cookie: f.cookie,
    body: {
      incidentType: "EXPLOSION",
      incidentSubtype: "TEST",
      sceneDetails: "Hiện trường đã cập nhật",
    },
  });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.incident.incidentType, "EXPLOSION");
  assert.equal(result.data.incident.description, "Mô tả ban đầu");
  assert.equal(result.data.incident.sceneDetails, "Hiện trường đã cập nhật");
  const audit = audits(f.db, item.id).at(-1);
  assert.equal(JSON.parse(audit.before_json).incident_type, "FIRE");
  assert.equal(JSON.parse(audit.after_json).incident_type, "EXPLOSION");
  assert.equal(audit.actor_id, "DEMO-A05");
  const history = await f.request(`/api/incidents/${item.id}/history`, { cookie: f.cookie });
  assert.equal(history.status, 200);
  assert.ok(history.data.auditLogs.some((row) => row.id === audit.id));
  const list = await f.request(
    "/api/incidents?incidentType=EXPLOSION&search=ki%E1%BB%83m&pageSize=1",
    { cookie: f.cookie },
  );
  assert.equal(list.status, 200);
  assert.equal(list.data.total, 1);
  assert.equal(list.data.items[0].id, item.id);
});

test("INC-03 human and property damages update without double counting and validate nonnegative values", async (t) => {
  const f = await fixture(t);
  const item = await f.incident();
  const path = `/api/incidents/${item.id}/damages`;
  const human = await f.request(path, {
    method: "POST",
    cookie: f.cookie,
    body: {
      damageGroup: "HUMAN",
      damageType: "INJURED",
      quantity: 2,
      propertyValue: 0,
      description: "Số liệu mẫu",
    },
  });
  assert.equal(human.status, 201, JSON.stringify(human.data));
  const property = await f.request(path, {
    method: "POST",
    cookie: f.cookie,
    body: {
      damageGroup: "PROPERTY",
      damageType: "LOSS",
      quantity: 1,
      propertyValue: 1000000,
    },
  });
  assert.equal(property.status, 201, JSON.stringify(property.data));
  const edit = await f.request(`${path}/${human.data.damage.id}`, {
    method: "PATCH",
    cookie: f.cookie,
    body: { quantity: 3 },
  });
  assert.equal(edit.status, 200);
  assert.equal(edit.data.damage.quantity, 3);
  for (const body of [
    { damageGroup: "HUMAN", damageType: "INJURED", quantity: -1 },
    { damageGroup: "HUMAN", damageType: "INJURED", quantity: 1.5 },
    { damageGroup: "PROPERTY", damageType: "LOSS", quantity: 1, propertyValue: -1 },
    { damageGroup: "PROPERTY", damageType: "LOSS", quantity: 1, propertyValue: 1.5 },
    { damageGroup: "HUMAN", damageType: "INJURED", quantity: 1, propertyValue: 10 },
  ])
    assert.equal(
      (await f.request(path, { method: "POST", cookie: f.cookie, body })).status,
      400,
      JSON.stringify(body),
    );
  const records = f.db.prepare("SELECT * FROM incident_damages WHERE incident_id=?").all(item.id);
  assert.equal(records.length, 2);
  assert.equal(
    records
      .filter((row) => row.damage_group === "HUMAN")
      .reduce((sum, row) => sum + row.quantity, 0),
    3,
  );
  assert.equal(
    records.reduce((sum, row) => sum + row.property_value, 0),
    1000000,
  );
  assert.equal((await f.request(path, { cookie: f.cookie })).status, 200);
  const other = await f.incident();
  assert.equal(
    (
      await f.request(`/api/incidents/${other.id}/damages/${human.data.damage.id}`, {
        method: "PATCH",
        cookie: f.cookie,
        body: { quantity: 9 },
      })
    ).status,
    404,
  );
});

test("INC-04 multiple officers receive independent tasks, reassignment and progress retain audit", async (t) => {
  const f = await fixture(t);
  const item = await f.incident();
  const path = `/api/incidents/${item.id}/assignments`;
  const assignments = [];
  for (const [officerId, taskDescription] of [
    ["CB-A03", "Khảo sát hiện trường"],
    ["CB-A04", "Tổng hợp số liệu"],
  ]) {
    const created = await f.request(path, {
      method: "POST",
      cookie: f.cookie,
      body: {
        officerId,
        taskDescription,
        deadlineAt: "2026-12-20T10:00:00+07:00",
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    assignments.push(created.data.assignment);
  }
  const list = await f.request(path, { cookie: f.cookie });
  assert.equal(list.status, 200);
  assert.equal(list.data.assignments.length, 2);
  assert.notEqual(assignments[0].taskDescription, assignments[1].taskDescription);
  const duplicate = await f.request(path, {
    method: "POST",
    cookie: f.cookie,
    body: {
      officerId: "CB-A03",
      taskDescription: "Khảo sát hiện trường",
    },
  });
  assert.equal(duplicate.status, 409);
  const changed = await f.request(`${path}/${assignments[0].id}`, {
    method: "PATCH",
    cookie: f.cookie,
    body: { officerId: "CB-A02", status: "IN_PROGRESS", notes: "Bàn giao thử nghiệm" },
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.data));
  assert.equal(changed.data.assignment.officerId, "CB-A02");
  assert.equal(changed.data.assignment.taskDescription, assignments[0].taskDescription);
  const audit = audits(f.db, item.id).at(-1);
  assert.equal(JSON.parse(audit.before_json).assignment.officer_id, "CB-A03");
  assert.equal(JSON.parse(audit.after_json).assignment.officer_id, "CB-A02");
  assert.equal(
    (
      await f.request(path, {
        method: "POST",
        cookie: f.cookie,
        body: { officerId: "missing", taskDescription: "Không hợp lệ" },
      })
    ).status,
    404,
  );
  f.db.exec(
    "UPDATE officers SET status='INACTIVE',status_reason='Kiểm thử',status_effective_date='2026-01-01' WHERE id='CB-A01'",
  );
  assert.equal(
    (
      await f.request(path, {
        method: "POST",
        cookie: f.cookie,
        body: { officerId: "CB-A01", taskDescription: "Không phù hợp" },
      })
    ).status,
    404,
  );
});

test("INC-05 deadline extension requires reason, keeps previous/new deadline and completion stops warnings", async (t) => {
  const f = await fixture(t);
  const overdue = Date.now() - 3600000;
  const item = await f.incident({ deadlineAt: overdue });
  assert.equal(item.deadlineWarning, "OVERDUE");
  assert.equal(item.processingStatus, "NEW");
  const deadlinePath = `/api/incidents/${item.id}/deadline`;
  const newDeadline = Date.now() + 3600000;
  assert.equal(
    (
      await f.request(deadlinePath, {
        method: "PATCH",
        cookie: f.cookie,
        body: { deadlineAt: newDeadline },
      })
    ).status,
    400,
  );
  const extended = await f.request(deadlinePath, {
    method: "PATCH",
    cookie: f.cookie,
    body: {
      deadlineAt: newDeadline,
      reason: "Gia hạn phục vụ kiểm thử",
    },
  });
  assert.equal(extended.status, 200, JSON.stringify(extended.data));
  assert.equal(extended.data.incident.deadlineAt, newDeadline);
  assert.equal(extended.data.incident.deadlineWarning, "DUE_SOON");
  const audit = audits(f.db, item.id).at(-1);
  assert.equal(JSON.parse(audit.before_json).deadline_at, overdue);
  assert.equal(JSON.parse(audit.after_json).deadline_at, newDeadline);
  const inProgress = await f.request(`/api/incidents/${item.id}/status`, {
    method: "PATCH",
    cookie: f.cookie,
    body: { processingStatus: "IN_PROGRESS" },
  });
  assert.equal(inProgress.status, 200, JSON.stringify(inProgress.data));
  const complete = await f.request(`/api/incidents/${item.id}/complete`, {
    method: "POST",
    cookie: f.cookie,
    body: { reason: "Đã xử lý xong dữ liệu thử" },
  });
  assert.equal(complete.status, 200, JSON.stringify(complete.data));
  assert.equal(complete.data.incident.processingStatus, "COMPLETED");
  assert.ok(complete.data.incident.completedAt);
  f.db.prepare("UPDATE incidents SET deadline_at=? WHERE id=?").run(overdue, item.id);
  const detail = await f.request(`/api/incidents/${item.id}`, { cookie: f.cookie });
  assert.equal(detail.data.incident.deadlineWarning, "COMPLETED");
  assert.equal(
    (await f.request("/api/incidents?deadlineWarning=OVERDUE", { cookie: f.cookie })).data.total,
    0,
  );
  assert.equal(
    (
      await f.request(`/api/incidents/${item.id}/status`, {
        method: "PATCH",
        cookie: f.cookie,
        body: { processingStatus: "NEW" },
      })
    ).status,
    400,
  );
  const history = await f.request(`/api/incidents/${item.id}/history`, { cookie: f.cookie });
  assert.ok(history.data.history.length >= 3);
});

test("INC upload uses real private file, verifies permission and scoped download", async (t) => {
  const f = await fixture(t);
  const item = await f.incident();
  const result = await f.upload(item.id);
  assert.equal(result.status, 201, JSON.stringify(result.data));
  const doc = result.data.document;
  const records = f.db.prepare("SELECT * FROM incident_documents WHERE incident_id=?").all(item.id);
  assert.equal(records.length, 1);
  assert.equal(files(f.uploadDirectory).length, 1);
  assert.ok(!JSON.stringify(doc).includes(f.uploadDirectory));
  const download = `/api/incidents/${item.id}/documents/${doc.id}/download`;
  assert.equal((await fetch(f.base + download)).status, 401);
  const response = await fetch(f.base + download, { headers: { Cookie: f.cookie } });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "Synthetic incident evidence only.");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const restricted = await f.login("demo.can-bo");
  f.db.exec("UPDATE account_scopes SET region_id='KP02' WHERE account_id='DEMO-A03'");
  assert.equal((await fetch(f.base + download, { headers: { Cookie: restricted } })).status, 404);
  f.db.exec("DELETE FROM role_permissions WHERE role_code='A05' AND permission_code='M09.view'");
  assert.equal((await fetch(f.base + download, { headers: { Cookie: f.cookie } })).status, 403);
});

test("INC upload rejects unapproved, spoofed, oversized and unsafe-name files with no orphan metadata/files", async (t) => {
  const f = await fixture(t);
  const item = await f.incident();
  for (const options of [
    { permitted: "false" },
    {
      filename: "proof.pdf",
      type: "application/pdf",
      bytes: "MZ unsafe binary pretending to be PDF",
    },
    { filename: "proof.exe", type: "text/plain", bytes: "MZ executable content" },
    { filename: "../proof.txt" },
    { filename: "proof.txt", bytes: "x".repeat(5 * 1024 * 1024 + 1) },
  ]) {
    const result = await f.upload(item.id, options);
    assert.ok(
      [400, 413, 415].includes(result.status),
      JSON.stringify({ options: { ...options, bytes: undefined }, result }),
    );
    assert.equal(f.db.prepare("SELECT count(*) AS n FROM incident_documents").get().n, 0);
    assert.deepEqual(files(f.uploadDirectory), []);
  }
  const result = await f.upload(item.id, {
    filename: "recognized.txt",
    type: "application/octet-stream",
  });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.equal(result.data.document.mimeType, "text/plain");
});

test("INC writes and document storage rollback together when the shared audit insert fails", async (t) => {
  const f = await fixture(t);
  const item = await f.incident();
  const snapshot = f.db.prepare("SELECT * FROM incidents WHERE id=?").get(item.id);
  const auditCount = audits(f.db, item.id).length;
  const historyCount = f.db
    .prepare("SELECT count(*) AS n FROM incident_status_history WHERE incident_id=?")
    .get(item.id).n;
  f.db.exec(
    "CREATE TRIGGER test_inc_audit_fail BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'Synthetic rollback'); END",
  );
  const failures = [
    [`/api/incidents/${item.id}`, "PATCH", { sceneDetails: "Không được lưu" }],
    [
      `/api/incidents/${item.id}/damages`,
      "POST",
      { damageGroup: "HUMAN", damageType: "INJURED", quantity: 1 },
    ],
    [
      `/api/incidents/${item.id}/assignments`,
      "POST",
      { officerId: "CB-A03", taskDescription: "Không được giao" },
    ],
    [
      `/api/incidents/${item.id}/deadline`,
      "PATCH",
      { deadlineAt: Date.now() + 3600000, reason: "Thử rollback" },
    ],
    [`/api/incidents/${item.id}/status`, "PATCH", { processingStatus: "IN_PROGRESS" }],
  ];
  for (const [path, method, body] of failures) {
    const result = await f.request(path, { method, cookie: f.cookie, body });
    assert.equal(result.status, 500, JSON.stringify(result.data));
    assert.ok(!JSON.stringify(result.data).includes("Synthetic rollback"));
    assert.deepEqual(f.db.prepare("SELECT * FROM incidents WHERE id=?").get(item.id), snapshot);
  }
  assert.equal((await f.upload(item.id)).status, 500);
  for (const table of ["incident_damages", "incident_assignments", "incident_documents"])
    assert.equal(f.db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
  assert.equal(audits(f.db, item.id).length, auditCount);
  assert.equal(
    f.db
      .prepare("SELECT count(*) AS n FROM incident_status_history WHERE incident_id=?")
      .get(item.id).n,
    historyCount,
  );
  assert.deepEqual(files(f.uploadDirectory), []);
});

test("INC authentication, separated permissions, CSRF and forged actor are enforced by direct API requests", async (t) => {
  const f = await fixture(t);
  const item = await f.incident();
  assert.equal((await f.request("/api/incidents")).status, 401);
  assert.equal((await f.request("/api/incidents/statistics")).status, 401);
  f.db.exec("DELETE FROM role_permissions WHERE role_code='A03' AND permission_code LIKE 'M09.%'");
  const restricted = await f.login("demo.can-bo");
  for (const path of [
    "/api/incidents",
    `/api/incidents/${item.id}`,
    `/api/incidents/${item.id}/history`,
    "/api/incidents/statistics",
  ])
    assert.equal((await f.request(path, { cookie: restricted })).status, 403);
  assert.equal(
    (
      await f.request(`/api/incidents/${item.id}`, {
        method: "PATCH",
        cookie: f.cookie,
        body: { createdBy: "DEMO-A01" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.request(`/api/incidents/${item.id}`, {
        method: "PATCH",
        cookie: f.cookie,
        body: { title: "CSRF" },
        headers: { Origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  f.db.exec(
    "DELETE FROM role_permissions WHERE role_code='A05' AND permission_code IN ('M09.create','M09.edit','M09.approve')",
  );
  assert.equal((await f.request(`/api/incidents/${item.id}`, { cookie: f.cookie })).status, 200);
  assert.equal(
    (
      await f.request("/api/incidents", {
        method: "POST",
        cookie: f.cookie,
        body: { recordStatus: "DRAFT" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.request(`/api/incidents/${item.id}/complete`, {
        method: "POST",
        cookie: f.cookie,
        body: {},
      })
    ).status,
    403,
  );
});

test("INC region, unit, facility and empty scopes constrain lists, writes, child resources and statistics", async (t) => {
  const f = await fixture(t);
  const first = await f.incident({ facilityId: "CS001" });
  const second = await f.incident({ regionId: "KP02", facilityId: "CS002" });
  const third = await f.incident({ regionId: "KP03", unitId: "DV-KV11", facilityId: "CS003" });
  const scoped = await f.login("demo.can-bo");
  assert.equal((await f.request("/api/incidents", { cookie: scoped })).data.total, 1);
  for (const suffix of ["", "/damages", "/assignments", "/documents", "/history"])
    assert.equal(
      (await f.request(`/api/incidents/${second.id}${suffix}`, { cookie: scoped })).status,
      404,
    );
  assert.equal(
    (
      await f.request(`/api/incidents/${first.id}`, {
        method: "PATCH",
        cookie: scoped,
        body: { regionId: "KP02", facilityId: null },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await f.request(`/api/incidents/${first.id}/assignments`, {
        method: "POST",
        cookie: scoped,
        body: { officerId: "CB-OTHER", taskDescription: "Ngoài phạm vi" },
      })
    ).status,
    404,
  );
  f.db.exec(
    "DELETE FROM account_scopes WHERE account_id='DEMO-A03'; INSERT INTO account_scopes(account_id,kind,unit_id) VALUES ('DEMO-A03','unit','DV-KV10')",
  );
  assert.equal((await f.request("/api/incidents", { cookie: scoped })).data.total, 2);
  assert.equal((await f.request(`/api/incidents/${third.id}`, { cookie: scoped })).status, 404);
  f.db.exec(
    "DELETE FROM account_scopes WHERE account_id='DEMO-A03'; INSERT INTO account_scopes(account_id,kind,facility_id) VALUES ('DEMO-A03','facility','CS002')",
  );
  const facility = await f.request("/api/incidents", { cookie: scoped });
  assert.equal(facility.data.total, 1);
  assert.equal(facility.data.items[0].id, second.id);
  f.db.exec("DELETE FROM account_scopes WHERE account_id='DEMO-A03'");
  assert.equal((await f.request("/api/incidents", { cookie: scoped })).data.total, 0);
  assert.equal((await f.request(`/api/incidents/${first.id}`, { cookie: scoped })).status, 404);
});

test("INC revoked session while JSON body is streaming cannot commit an incident", async (t) => {
  const f = await fixture(t);
  const body = JSON.stringify({ recordStatus: "DRAFT", title: "Không được tạo sau thu hồi phiên" });
  let streaming;
  const done = new Promise((resolveRequest, reject) => {
    streaming = httpRequest(
      f.base + "/api/incidents",
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
        response.on("end", () => resolveRequest(response.statusCode));
      },
    );
    streaming.on("error", reject);
  });
  const split = body.indexOf(",");
  streaming.write(body.slice(0, split));
  await new Promise((resolveTimer) => setTimeout(resolveTimer, 30));
  f.db.exec("DELETE FROM sessions WHERE account_id='DEMO-A05'");
  streaming.end(body.slice(split));
  assert.equal(await done, 401);
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM incidents").get().n, 0);
});

test("INC-06 SQLite statistics reconcile with SQL and avoid multiplication from damages, documents and assignments", async (t) => {
  const now = Date.parse("2026-02-20T00:00:00+07:00");
  const f = await fixture(t, { incidentNow: () => now });
  const january = await f.incident({
    occurredAt: "2025-12-31T17:00:00Z",
    deadlineAt: now - 1,
  });
  const february = await f.incident({
    incidentType: "RESCUE",
    occurredAt: "2026-02-15T10:00:00+07:00",
    deadlineAt: now + 3600000,
  });
  const oldYear = await f.incident({
    incidentType: "MEDICAL",
    occurredAt: "2025-12-31T23:59:59+07:00",
    regionId: "KP03",
    unitId: "DV-KV11",
  });
  const draft = await f.incident({ recordStatus: "DRAFT" });
  for (const [id, body] of [
    [january.id, { damageGroup: "HUMAN", damageType: "INJURED", quantity: 2 }],
    [
      january.id,
      { damageGroup: "PROPERTY", damageType: "LOSS", quantity: 1, propertyValue: 1000000 },
    ],
    [february.id, { damageGroup: "HUMAN", damageType: "RESCUED", quantity: 1 }],
    [draft.id, { damageGroup: "HUMAN", damageType: "INJURED", quantity: 100 }],
  ])
    assert.equal(
      (await f.request(`/api/incidents/${id}/damages`, { method: "POST", cookie: f.cookie, body }))
        .status,
      201,
    );
  for (const officerId of ["CB-A01", "CB-A03", "CB-A04"])
    assert.equal(
      (
        await f.request(`/api/incidents/${january.id}/assignments`, {
          method: "POST",
          cookie: f.cookie,
          body: { officerId, taskDescription: `Nhiệm vụ mẫu ${officerId}` },
        })
      ).status,
      201,
    );
  assert.equal((await f.upload(january.id, { filename: "one.txt" })).status, 201);
  assert.equal((await f.upload(january.id, { filename: "two.txt" })).status, 201);
  const result = await f.request("/api/incidents/statistics", { cookie: f.cookie });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  const stats = result.data;
  const sqlTotal = f.db
    .prepare("SELECT count(*) AS n FROM incidents WHERE record_status='OFFICIAL'")
    .get().n;
  const sqlProperty = f.db
    .prepare(
      "SELECT coalesce(sum(d.property_value),0) AS n FROM incident_damages d JOIN incidents i ON i.id=d.incident_id WHERE i.record_status='OFFICIAL'",
    )
    .get().n;
  assert.equal(stats.total, sqlTotal);
  assert.equal(stats.total, 3);
  assert.equal(stats.draftsExcluded, 1);
  assert.equal(stats.damages.propertyValue, sqlProperty);
  assert.equal(stats.damages.propertyValue, 1000000);
  assert.equal(stats.damages.human.find((row) => row.damageType === "INJURED").quantity, 2);
  assert.equal(stats.damages.human.find((row) => row.damageType === "RESCUED").quantity, 1);
  assert.equal(stats.byDay.find((row) => row.key === "2026-01-01").count, 1);
  assert.equal(stats.byMonth.find((row) => row.key === "2026-01").count, 1);
  assert.equal(stats.byYear.find((row) => row.key === "2025").count, 1);
  assert.equal(stats.byYear.find((row) => row.key === "2026").count, 2);
  assert.equal(stats.deadlines.overdue, 1);
  assert.equal(stats.deadlines.dueSoon, 1);
  assert.equal(stats.byRegion.find((row) => row.key === "KP01").count, 2);
  const filtered = await f.request(
    "/api/incidents/statistics?from=2026-01-01&to=2026-02-28&regionId=KP01",
    { cookie: f.cookie },
  );
  assert.equal(filtered.status, 200);
  assert.equal(filtered.data.total, 2);
  const list = await f.request(
    "/api/incidents?recordStatus=OFFICIAL&from=2026-01-01&to=2026-02-28&regionId=KP01",
    { cookie: f.cookie },
  );
  assert.equal(list.data.total, filtered.data.total);
  assert.equal(
    (
      await f.request(`/api/incidents/${january.id}`, {
        method: "PATCH",
        cookie: f.cookie,
        body: { incidentType: "EXPLOSION" },
      })
    ).status,
    200,
  );
  const changed = await f.request("/api/incidents/statistics?from=2026-01-01&to=2026-01-01", {
    cookie: f.cookie,
  });
  assert.equal(changed.data.total, 1);
  assert.equal(changed.data.byType.find((row) => row.key === "EXPLOSION").count, 1);
  assert.equal(changed.data.byType.find((row) => row.key === "FIRE")?.count ?? 0, 0);
  const scoped = await f.login("demo.can-bo");
  const scopedStats = await f.request("/api/incidents/statistics", { cookie: scoped });
  assert.equal(scopedStats.data.total, 2);
  assert.ok(!JSON.stringify(scopedStats.data).includes(oldYear.incidentCode));
  f.db.exec("DELETE FROM account_scopes WHERE account_id='DEMO-A03'");
  const none = await f.request("/api/incidents/statistics", { cookie: scoped });
  assert.equal(none.data.total, 0);
  assert.equal(none.data.damages.propertyValue, 0);
});

test("INC statistics permission is separate from record viewing and rejects invalid period/filter input", async (t) => {
  const f = await fixture(t);
  await f.incident();
  const reader = await f.login("demo.nguoi-xem");
  f.db.exec(
    "DELETE FROM role_permissions WHERE role_code='A06' AND permission_code LIKE 'M09.%'; INSERT INTO role_permissions VALUES ('A06','M09.export')",
  );
  assert.equal((await f.request("/api/incidents/statistics", { cookie: reader })).status, 200);
  assert.equal((await f.request("/api/incidents", { cookie: reader })).status, 403);
  for (const query of [
    "from=2026-02-30",
    "to=invalid",
    "from=2026-12-31&to=2026-01-01",
    "page=0",
    "pageSize=100000",
    "deadlineWarning=INVALID",
    "processingStatus=OVERDUE",
  ]) {
    const path =
      query.startsWith("from=") || query.startsWith("to=")
        ? "/api/incidents/statistics"
        : "/api/incidents";
    const result = await f.request(`${path}?${query}`, { cookie: f.cookie });
    assert.equal(result.status, 400, JSON.stringify({ query, response: result.data }));
  }
});

test("INC-05 warning uses exact epoch boundaries and configured advance hours without changing processing status", async (t) => {
  const now = Date.parse("2026-01-01T00:00:00+07:00");
  const f = await fixture(t, { incidentNow: () => now });
  f.db.exec("UPDATE incident_policy SET warning_hours=2 WHERE id=1");
  const samples = [
    [null, "NONE"],
    [now - 1, "OVERDUE"],
    [now, "DUE_SOON"],
    [now + 2 * 3600000, "DUE_SOON"],
    [now + 2 * 3600000 + 1, "ON_TIME"],
  ];
  for (const [deadlineAt, warning] of samples) {
    const item = await f.incident({ deadlineAt, occurredAt: now - 86400000 });
    assert.equal(item.deadlineWarning, warning, String(deadlineAt));
    assert.equal(item.processingStatus, "NEW");
  }
  assert.equal(
    (await f.request("/api/incidents?deadlineWarning=OVERDUE", { cookie: f.cookie })).data.total,
    1,
  );
  assert.equal(
    (await f.request("/api/incidents?deadlineWarning=DUE_SOON", { cookie: f.cookie })).data.total,
    2,
  );
  const withoutDeadline = await f.incident();
  assert.equal(withoutDeadline.deadlineAt, null);
  f.db.exec("UPDATE incident_policy SET warning_hours=0 WHERE id=1");
  assert.equal(
    (await f.request("/api/incidents?deadlineWarning=DUE_SOON", { cookie: f.cookie })).data.total,
    1,
  );
});

test("INC completion evidence rule is configurable and drafts or illegal transitions cannot complete", async (t) => {
  const f = await fixture(t);
  f.db.exec("UPDATE incident_policy SET require_document_completion=1 WHERE id=1");
  const item = await f.incident();
  const draft = await f.incident({ recordStatus: "DRAFT" });
  assert.equal(
    (
      await f.request(`/api/incidents/${draft.id}/complete`, {
        method: "POST",
        cookie: f.cookie,
        body: {},
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.request(`/api/incidents/${item.id}/complete`, {
        method: "POST",
        cookie: f.cookie,
        body: {},
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.request(`/api/incidents/${item.id}/status`, {
        method: "PATCH",
        cookie: f.cookie,
        body: { processingStatus: "OVERDUE" },
      })
    ).status,
    400,
  );
  assert.equal((await f.upload(item.id)).status, 201);
  assert.equal(
    (
      await f.request(`/api/incidents/${item.id}/status`, {
        method: "PATCH",
        cookie: f.cookie,
        body: { processingStatus: "IN_PROGRESS" },
      })
    ).status,
    200,
  );
  const completed = await f.request(`/api/incidents/${item.id}/complete`, {
    method: "POST",
    cookie: f.cookie,
    body: { reason: "Đủ bằng chứng thử nghiệm" },
  });
  assert.equal(completed.status, 200, JSON.stringify(completed.data));
  const row = f.db.prepare("SELECT * FROM incidents WHERE id=?").get(item.id);
  assert.equal(row.processing_status, "COMPLETED");
  assert.ok(row.completed_at);
  assert.equal(
    f.db
      .prepare(
        "SELECT to_status FROM incident_status_history WHERE incident_id=? ORDER BY id DESC LIMIT 1",
      )
      .get(item.id).to_status,
    "COMPLETED",
  );
});

test("INC revoked permission while multipart upload is streaming leaves no file or metadata", async (t) => {
  const f = await fixture(t);
  const item = await f.incident();
  const boundary = "incident-test-boundary";
  const body = [
    `--${boundary}\r\nContent-Disposition: form-data; name="permitted"\r\n\r\ntrue\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="stream.txt"\r\nContent-Type: text/plain\r\n\r\n`,
    `Synthetic streaming proof.\r\n--${boundary}--\r\n`,
  ].join("");
  let streaming;
  const done = new Promise((resolveRequest, reject) => {
    streaming = httpRequest(
      `${f.base}/api/incidents/${item.id}/documents`,
      {
        method: "POST",
        headers: {
          Origin: origin,
          Cookie: f.cookie,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        response.resume();
        response.on("end", () => resolveRequest(response.statusCode));
      },
    );
    streaming.on("error", reject);
  });
  const split = body.indexOf("Synthetic streaming proof.");
  streaming.write(body.slice(0, split));
  await new Promise((resolveTimer) => setTimeout(resolveTimer, 30));
  f.db.exec("DELETE FROM role_permissions WHERE role_code='A05' AND permission_code='M09.edit'");
  streaming.end(body.slice(split));
  assert.equal(await done, 403);
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM incident_documents").get().n, 0);
  assert.deepEqual(files(f.uploadDirectory), []);
});

test("INC create, edit and assignment/completion permissions remain distinct", async (t) => {
  const f = await fixture(t);
  const item = await f.incident();
  const editor = await f.login("demo.can-bo");
  f.db.exec(
    "DELETE FROM role_permissions WHERE role_code='A03' AND permission_code LIKE 'M09.%'; INSERT INTO role_permissions VALUES ('A03','M09.view'),('A03','M09.edit')",
  );
  assert.equal(
    (
      await f.request(`/api/incidents/${item.id}`, {
        method: "PATCH",
        cookie: editor,
        body: { sceneDetails: "Sửa trong phạm vi" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await f.request(`/api/incidents/${item.id}/status`, {
        method: "PATCH",
        cookie: editor,
        body: { processingStatus: "IN_PROGRESS" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await f.request(`/api/incidents/${item.id}/assignments`, {
        method: "POST",
        cookie: editor,
        body: { officerId: "CB-A03", taskDescription: "Không đủ quyền giao" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.request(`/api/incidents/${item.id}/complete`, {
        method: "POST",
        cookie: editor,
        body: {},
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.request("/api/incidents", {
        method: "POST",
        cookie: editor,
        body: { recordStatus: "DRAFT" },
      })
    ).status,
    403,
  );
  const commander = await f.login("demo.chi-huy");
  f.db.exec(
    "DELETE FROM role_permissions WHERE role_code='A01' AND permission_code LIKE 'M09.%'; INSERT INTO role_permissions VALUES ('A01','M09.approve')",
  );
  assert.equal(
    (
      await f.request(`/api/incidents/${item.id}`, {
        method: "PATCH",
        cookie: commander,
        body: { sceneDetails: "Không đủ quyền sửa" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.request(`/api/incidents/${item.id}/deadline`, {
        method: "PATCH",
        cookie: commander,
        body: { deadlineAt: Date.now() + 3600000, reason: "Giao hạn thử nghiệm" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await f.request(`/api/incidents/${item.id}/complete`, {
        method: "POST",
        cookie: commander,
        body: { reason: "Đã xử lý" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await f.request(`/api/incidents/${item.id}/status`, {
        method: "PATCH",
        cookie: commander,
        body: { processingStatus: "CLOSED", reason: "Đóng hồ sơ" },
      })
    ).status,
    200,
  );
  const stored = f.db.prepare("SELECT * FROM incidents WHERE id=?").get(item.id);
  assert.equal(stored.processing_status, "CLOSED");
  assert.equal(stored.updated_by, "DEMO-A01");
});

test("INC assigned officer can update own task progress with edit permission but cannot reassign it", async (t) => {
  const f = await fixture(t);
  const item = await f.incident();
  const created = await f.request(`/api/incidents/${item.id}/assignments`, {
    method: "POST",
    cookie: f.cookie,
    body: { officerId: "CB-A03", taskDescription: "Cập nhật tiến độ mẫu" },
  });
  assert.equal(created.status, 201);
  const path = `/api/incidents/${item.id}/assignments/${created.data.assignment.id}`;
  const officer = await f.login("demo.can-bo");
  const other = await f.login("demo.tong-hop");
  f.db.exec(
    "DELETE FROM role_permissions WHERE role_code IN ('A03','A04') AND permission_code='M09.approve'",
  );
  const progress = await f.request(path, {
    method: "PATCH",
    cookie: officer,
    body: { status: "IN_PROGRESS", notes: "Đã bắt đầu xử lý" },
  });
  assert.equal(progress.status, 200, JSON.stringify(progress.data));
  assert.equal(progress.data.assignment.status, "IN_PROGRESS");
  assert.equal(
    (await f.request(path, { method: "PATCH", cookie: other, body: { status: "COMPLETED" } }))
      .status,
    403,
  );
  assert.equal(
    (await f.request(path, { method: "PATCH", cookie: officer, body: { officerId: "CB-A04" } }))
      .status,
    400,
  );
  assert.equal(
    f.db
      .prepare("SELECT officer_id FROM incident_assignments WHERE id=?")
      .get(created.data.assignment.id).officer_id,
    "CB-A03",
  );
  const complete = await f.request(path, {
    method: "PATCH",
    cookie: officer,
    body: { status: "COMPLETED", notes: "Hoàn thành nhiệm vụ thử nghiệm" },
  });
  assert.equal(complete.status, 200, JSON.stringify(complete.data));
  assert.ok(complete.data.assignment.completedAt);
  const audit = audits(f.db, item.id).at(-1);
  assert.equal(audit.actor_id, "DEMO-A03");
  assert.equal(JSON.parse(audit.before_json).assignment.status, "IN_PROGRESS");
  assert.equal(JSON.parse(audit.after_json).assignment.status, "COMPLETED");
});

test("INC optimistic version rejects stale metadata without losing another user's edit", async (t) => {
  const f = await fixture(t);
  const item = await f.incident();
  const first = await f.request(`/api/incidents/${item.id}`, {
    method: "PATCH",
    cookie: f.cookie,
    body: { version: item.version, description: "Thay đổi đã lưu" },
  });
  assert.equal(first.status, 200);
  const stale = await f.request(`/api/incidents/${item.id}`, {
    method: "PATCH",
    cookie: f.cookie,
    body: { version: item.version, description: "Thay đổi từ phiên cũ" },
  });
  assert.equal(stale.status, 409, JSON.stringify(stale.data));
  assert.equal(stale.data.error.code, "VERSION_CONFLICT");
  assert.equal(
    f.db.prepare("SELECT description FROM incidents WHERE id=?").get(item.id).description,
    "Thay đổi đã lưu",
  );
});

test("INC statistics rejects unsafe aggregate totals without rounded monetary values", async (t) => {
  const f = await fixture(t);
  const item = await f.incident();
  for (let index = 0; index < 2; index++) {
    assert.equal(
      (
        await f.request(`/api/incidents/${item.id}/damages`, {
          method: "POST",
          cookie: f.cookie,
          body: {
            damageGroup: "PROPERTY",
            damageType: "LOSS",
            quantity: 1,
            propertyValue: 9000000000000000,
          },
        })
      ).status,
      201,
    );
  }
  const result = await f.request("/api/incidents/statistics", { cookie: f.cookie });
  assert.equal(result.status, 422, JSON.stringify(result.data));
  assert.equal(result.data.error.code, "AGGREGATE_TOO_LARGE");
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM incident_damages").get().n, 2);
});

test("INC refuses upload storage in repository public without writing file or metadata", async (t) => {
  const publicDirectory = fileURLToPath(new URL("../../pccc-FE/public/", import.meta.url));
  const before = files(publicDirectory);
  const f = await fixture(t, { uploadDirectory: publicDirectory });
  const item = await f.incident();
  const result = await f.upload(item.id);
  assert.equal(result.status, 500, JSON.stringify(result.data));
  assert.equal(result.data.error.code, "STORAGE_ERROR");
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM incident_documents").get().n, 0);
  assert.deepEqual(files(publicDirectory), before);
});

test("INC administrator configures demo policy/catalog with audit, validation and no implicit role grants", async (t) => {
  const now = Date.parse("2026-03-01T00:00:00+07:00");
  const f = await fixture(t, { incidentNow: () => now });
  const permissionsBefore = f.db
    .prepare("SELECT * FROM role_permissions ORDER BY role_code,permission_code")
    .all();
  const policyBefore = f.db.prepare("SELECT * FROM incident_policy").get();
  assert.equal((await f.request("/api/incidents/configuration")).status, 401);
  const ordinary = await f.login("demo.tong-hop");
  assert.equal((await f.request("/api/incidents/configuration", { cookie: ordinary })).status, 403);
  assert.equal(
    (
      await f.request("/api/incidents/configuration", {
        method: "PATCH",
        cookie: ordinary,
        body: { warningHours: 1 },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.request("/api/incidents/configuration/types/TEST_CATALOG", {
        method: "PUT",
        cookie: ordinary,
        body: { name: "Không đủ quyền", enabled: true },
      })
    ).status,
    403,
  );
  const initial = await f.request("/api/incidents/configuration", { cookie: f.cookie });
  assert.equal(initial.status, 200);
  assert.equal(initial.data.policy.configurationLabel, "DEMO_UNCONFIRMED_Q11_Q12");
  for (const body of [
    { warningHours: -1 },
    { warningHours: 1.5 },
    { requireDocumentCompletion: "true" },
    { maxUploadBytes: 0 },
    { allowedExtensions: ["exe"] },
    { allowedExtensions: ["txt", "txt"] },
  ]) {
    assert.equal(
      (await f.request("/api/incidents/configuration", { method: "PATCH", cookie: f.cookie, body }))
        .status,
      400,
      JSON.stringify(body),
    );
    assert.deepEqual(f.db.prepare("SELECT * FROM incident_policy").get(), policyBefore);
  }
  const configured = await f.request("/api/incidents/configuration", {
    method: "PATCH",
    cookie: f.cookie,
    body: {
      warningHours: 3,
      requireDocumentCompletion: false,
      maxUploadBytes: 128,
      allowedExtensions: ["txt"],
      reason: "Cấu hình giả định chỉ trong kiểm thử",
    },
  });
  assert.equal(configured.status, 200);
  assert.equal(configured.data.policy.warningHours, 3);
  assert.equal(configured.data.policy.maxUploadBytes, 128);
  assert.deepEqual(configured.data.policy.allowedExtensions, ["txt"]);
  const policyAudit = audits(f.db, "M09.policy").at(-1);
  assert.equal(policyAudit.actor_id, "DEMO-A05");
  assert.equal(JSON.parse(policyAudit.before_json).warning_hours, 48);
  assert.equal(JSON.parse(policyAudit.after_json).warning_hours, 3);
  const persistedPolicy = f.db.prepare("SELECT * FROM incident_policy").get();
  assert.equal(JSON.parse(policyAudit.after_json).updated_by, persistedPolicy.updated_by);
  assert.equal(JSON.parse(policyAudit.after_json).updated_at, persistedPolicy.updated_at);
  const typePath = "/api/incidents/configuration/types/TEST_CATALOG";
  const catalog = await f.request(typePath, {
    method: "PUT",
    cookie: f.cookie,
    body: {
      name: "Loại sự cố thử nghiệm có cấu hình",
      enabled: true,
      subtypes: [{ code: "TEST_SHAPE", name: "Phân nhóm thử nghiệm", enabled: true }],
      reason: "Kiểm thử danh mục, không phải phân loại chính thức",
    },
  });
  assert.equal(catalog.status, 200, JSON.stringify(catalog.data));
  const options = await f.request("/api/incidents/options", { cookie: f.cookie });
  assert.equal(
    options.data.incidentTypes.find((type) => type.code === "TEST_CATALOG").subtypes[0].code,
    "TEST_SHAPE",
  );
  const item = await f.incident({
    incidentType: "TEST_CATALOG",
    incidentSubtype: "TEST_SHAPE",
    deadlineAt: now + 3 * 3600000 + 1,
  });
  assert.equal(item.deadlineWarning, "ON_TIME");
  const stats = await f.request("/api/incidents/statistics?incidentType=TEST_CATALOG", {
    cookie: f.cookie,
  });
  assert.equal(stats.data.total, 1);
  assert.equal(
    stats.data.byType.find((row) => row.key === "TEST_CATALOG").name,
    "Loại sự cố thử nghiệm có cấu hình",
  );
  const changed = await f.request(`/api/incidents/${item.id}`, {
    method: "PATCH",
    cookie: f.cookie,
    body: { incidentType: "FIRE", incidentSubtype: null },
  });
  assert.equal(changed.status, 200);
  assert.equal(
    (await f.request("/api/incidents/statistics?incidentType=TEST_CATALOG", { cookie: f.cookie }))
      .data.total,
    0,
  );
  assert.equal(JSON.parse(audits(f.db, item.id).at(-1).before_json).incident_type, "TEST_CATALOG");
  assert.equal(
    JSON.parse(audits(f.db, "M09.type:TEST_CATALOG").at(-1).after_json).type.code,
    "TEST_CATALOG",
  );
  assert.deepEqual(
    f.db.prepare("SELECT * FROM role_permissions ORDER BY role_code,permission_code").all(),
    permissionsBefore,
  );
});

test("INC-02 empty and configured subtype options enforce type ownership and persist classification history", async (t) => {
  const f = await fixture(t);
  const empty = await f.request("/api/incidents/options", { cookie: f.cookie });
  assert.equal(empty.status, 200);
  for (const type of empty.data.incidentTypes) assert.deepEqual(type.subtypes, [], type.code);

  const fireGroup = {
    code: "DEMO_FIRE_SCENE",
    name: "Nhóm hiện trường cháy giả lập",
    enabled: true,
  };
  const inactiveGroup = {
    code: "DEMO_FIRE_INACTIVE",
    name: "Nhóm cháy giả lập ngừng dùng",
    enabled: false,
  };
  const explosionGroup = {
    code: "DEMO_EXPLOSION_SCENE",
    name: "Nhóm hiện trường nổ giả lập",
    enabled: true,
  };
  for (const [code, subtypes] of [
    ["FIRE", [fireGroup, inactiveGroup]],
    ["EXPLOSION", [explosionGroup]],
  ]) {
    const type = empty.data.incidentTypes.find((entry) => entry.code === code);
    const configured = await f.request(`/api/incidents/configuration/types/${code}`, {
      method: "PUT",
      cookie: f.cookie,
      body: {
        name: type.name,
        enabled: true,
        subtypes,
        reason: "Nhóm demo chỉ phục vụ kiểm thử Q11",
      },
    });
    assert.equal(configured.status, 200, JSON.stringify(configured.data));
  }
  const grouped = await f.request("/api/incidents/options", { cookie: f.cookie });
  assert.deepEqual(
    grouped.data.incidentTypes
      .find((type) => type.code === "FIRE")
      .subtypes.map((group) => group.code),
    [fireGroup.code],
  );
  assert.deepEqual(
    grouped.data.incidentTypes
      .find((type) => type.code === "EXPLOSION")
      .subtypes.map((group) => group.code),
    [explosionGroup.code],
  );
  assert.deepEqual(grouped.data.incidentTypes.find((type) => type.code === "RESCUE").subtypes, []);
  assert.ok(!JSON.stringify(grouped.data).includes(inactiveGroup.code));

  const item = await f.incident();
  const path = `/api/incidents/${item.id}`;
  const before = f.db.prepare("SELECT * FROM incidents WHERE id=?").get(item.id);
  const auditBefore = audits(f.db, item.id).length;
  const crossType = await f.request(path, {
    method: "PATCH",
    cookie: f.cookie,
    body: { incidentSubtype: explosionGroup.code },
  });
  assert.equal(crossType.status, 400);
  assert.deepEqual(f.db.prepare("SELECT * FROM incidents WHERE id=?").get(item.id), before);
  assert.equal(audits(f.db, item.id).length, auditBefore);

  const saved = await f.request(path, {
    method: "PATCH",
    cookie: f.cookie,
    body: { incidentSubtype: fireGroup.code },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.equal(saved.data.incident.incidentSubtype, fireGroup.code);
  assert.equal(
    (await f.request(path, { cookie: f.cookie })).data.incident.incidentSubtype,
    fireGroup.code,
  );
  const classified = audits(f.db, item.id).at(-1);
  assert.equal(classified.action, "M09.classification.update");
  assert.equal(JSON.parse(classified.before_json).incident_subtype, null);
  assert.equal(JSON.parse(classified.after_json).incident_subtype, fireGroup.code);

  const disabled = await f.request("/api/incidents/configuration/types/FIRE", {
    method: "PUT",
    cookie: f.cookie,
    body: {
      name: empty.data.incidentTypes.find((type) => type.code === "FIRE").name,
      enabled: true,
      subtypes: [{ ...fireGroup, enabled: false }],
      reason: "Ngừng nhóm demo trong kiểm thử",
    },
  });
  assert.equal(disabled.status, 200);
  assert.deepEqual(
    (await f.request("/api/incidents/options", { cookie: f.cookie })).data.incidentTypes.find(
      (type) => type.code === "FIRE",
    ).subtypes,
    [],
  );
  assert.equal(
    (await f.request(path, { cookie: f.cookie })).data.incident.incidentSubtype,
    fireGroup.code,
  );
  await f.incident({ incidentSubtype: fireGroup.code }, 400);

  const reclassified = await f.request(path, {
    method: "PATCH",
    cookie: f.cookie,
    body: { incidentType: "EXPLOSION", incidentSubtype: null },
  });
  assert.equal(reclassified.status, 200);
  assert.equal(reclassified.data.incident.incidentSubtype, null);
  const cleared = audits(f.db, item.id).at(-1);
  assert.equal(JSON.parse(cleared.before_json).incident_subtype, fireGroup.code);
  assert.equal(JSON.parse(cleared.after_json).incident_type, "EXPLOSION");
  assert.equal(JSON.parse(cleared.after_json).incident_subtype, null);
  const final = await f.request(path, {
    method: "PATCH",
    cookie: f.cookie,
    body: { incidentSubtype: explosionGroup.code },
  });
  assert.equal(final.status, 200);
  assert.equal(
    (await f.request(path, { cookie: f.cookie })).data.incident.incidentSubtype,
    explosionGroup.code,
  );

  await f.close();
  const reopened = openDatabase(f.databasePath);
  try {
    const row = reopened.prepare("SELECT * FROM incidents WHERE id=?").get(item.id);
    assert.equal(row.incident_type, "EXPLOSION");
    assert.equal(row.incident_subtype, explosionGroup.code);
    assert.equal(
      JSON.parse(audits(reopened, item.id).at(-1).after_json).incident_subtype,
      explosionGroup.code,
    );
    assert.deepEqual(reopened.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    reopened.close();
  }
});
