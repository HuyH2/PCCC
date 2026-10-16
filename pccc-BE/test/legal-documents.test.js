import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";
import { writeAudit } from "../src/modules/audit/audit.service.js";
import { MAX_DOCUMENT_BYTES } from "../src/modules/legal-documents/legal-documents.service.js";

const password = "Documents-test-password-2026";
const origin = "http://localhost:3000";
const migrationCount = readdirSync(new URL("../migrations/", import.meta.url)).filter((f) =>
  f.endsWith(".sql"),
).length;
const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
const payload = (extra = {}) => ({
  category_id: "law",
  title: "Văn bản kiểm thử về phòng cháy",
  reference_number: "TEST-01/2026",
  issuing_authority: "Cơ quan mẫu",
  issued_date: "2026-01-01",
  effective_date: "2026-02-01",
  status: "effective",
  source_url: "https://example.org/document",
  notes: "Dữ liệu kiểm thử",
  ...extra,
});

test("forward migration preserves pre-existing audit content and remains idempotent", () => {
  const directory = mkdtempSync(join(tmpdir(), "pccc-document-migration-"));
  const path = join(directory, "upgrade.sqlite");
  let db;
  try {
    db = new DatabaseSync(path);
    db.exec(
      "PRAGMA foreign_keys=ON; CREATE TABLE schema_migrations(name TEXT PRIMARY KEY,applied_at INTEGER NOT NULL)",
    );
    for (const name of ["001-auth.sql", "003-search-dashboard.sql"]) {
      db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
      db.prepare("INSERT INTO schema_migrations VALUES (?,1)").run(name);
    }
    db.prepare(
      "INSERT INTO audit_logs(action,object_id,occurred_at,ip,before_json) VALUES ('auth.login','legacy',1,'local','{}')",
    ).run();
    db.close();
    db = openDatabase(path);
    const legacy = db.prepare("SELECT * FROM audit_logs WHERE object_id='legacy'").get();
    assert.equal(legacy.action, "auth.login");
    assert.equal(legacy.before_json, "{}");
    assert.equal(legacy.occurred_at, 1);
    assert.equal(legacy.feature, "system");
    assert.throws(() => db.exec("UPDATE audit_logs SET before_json='changed'"));
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare("SELECT count(*) AS n FROM schema_migrations").get().n, migrationCount);
    assert.equal(db.prepare("SELECT count(*) AS n FROM audit_logs").get().n, 1);
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
  async function request(path, { method = "GET", body, cookie, headers = {}, raw } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: raw ?? (body ? JSON.stringify(body) : undefined),
    });
    const data = response.headers.get("content-type")?.includes("application/json")
      ? await response.json()
      : Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      data,
      headers: response.headers,
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  async function login(username = "demo.admin") {
    const r = await request("/api/auth/login", { method: "POST", body: { username, password } });
    assert.equal(r.status, 200);
    return r.cookie;
  }
  return { db, request, login };
}

test("document access requires session, M05 permissions, nonempty scope; shared writes need all scope", async (t) => {
  const { db, request, login } = await fixture(t);
  assert.equal((await request("/api/legal-documents")).status, 401);
  const reader = await login("demo.can-bo");
  assert.equal((await request("/api/legal-documents", { cookie: reader })).status, 200);
  assert.equal(
    (await request("/api/legal-document-categories", { cookie: reader })).data.items.length,
    6,
  );
  assert.equal(
    (await request("/api/legal-documents", { method: "POST", cookie: reader, body: payload() }))
      .status,
    403,
  );
  db.prepare("INSERT INTO role_permissions VALUES ('A03','M05.create')").run();
  assert.equal(
    (await request("/api/legal-documents", { method: "POST", cookie: reader, body: payload() }))
      .status,
    403,
  );
  db.prepare("DELETE FROM account_scopes WHERE account_id='DEMO-A03'").run();
  for (const path of [
    "/api/legal-documents",
    "/api/legal-document-categories",
    "/api/legal-documents/DEMO-DOC-1",
    "/api/legal-documents/DEMO-DOC-1/history",
    "/api/legal-documents/DEMO-DOC-1/file",
  ])
    assert.equal((await request(path, { cookie: reader })).status, 403, path);
  const admin = await login();
  db.prepare(
    "DELETE FROM role_permissions WHERE role_code='A05' AND permission_code='M05.view'",
  ).run();
  assert.equal((await request("/api/legal-documents", { cookie: admin })).status, 403);
});

test("create, detail, accent search, combined filters, pagination and versioned update with history", async (t) => {
  const { db, request, login } = await fixture(t);
  const cookie = await login();
  const created = await request("/api/legal-documents", {
    method: "POST",
    cookie,
    body: payload(),
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const doc = created.data.document;
  assert.equal(
    (await request(`/api/legal-documents/${doc.id}`, { cookie })).data.document.reference_number,
    "TEST-01/2026",
  );
  const list = await request(
    "/api/legal-documents?q=phong%20chay&categoryId=law&status=effective&pageSize=1",
    { cookie },
  );
  assert.equal(list.data.total, 1);
  assert.equal(list.data.items[0].id, doc.id);
  assert.equal((await request("/api/legal-documents?q=test-01", { cookie })).data.total, 1);
  assert.equal((await request("/api/legal-documents?q=does-not-exist", { cookie })).data.total, 0);
  const changed = await request(`/api/legal-documents/${doc.id}`, {
    method: "PUT",
    cookie,
    body: payload({ status: "expired", category_id: "decree", version: 1 }),
  });
  assert.equal(changed.status, 200);
  assert.equal(changed.data.document.version, 2);
  const stale = await request(`/api/legal-documents/${doc.id}`, {
    method: "PUT",
    cookie,
    body: payload({ version: 1 }),
  });
  assert.equal(stale.status, 409);
  const reader = await login("demo.can-bo");
  const history = await request(`/api/legal-documents/${doc.id}/history`, { cookie: reader });
  assert.equal(history.data.total, 2);
  assert.equal(JSON.parse(history.data.items[0].before_json).status, "effective");
  assert.equal(JSON.parse(history.data.items[0].after_json).status, "expired");
  assert.ok(history.data.items[0].actor_name);
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM audit_logs WHERE object_id=?").get(doc.id).n,
    2,
  );
});

test("document validation rejects duplicates, unknown fields, dates, URLs and invalid filters", async (t) => {
  const { request, login } = await fixture(t);
  const cookie = await login();
  assert.equal(
    (await request("/api/legal-documents", { method: "POST", cookie, body: payload() })).status,
    201,
  );
  assert.equal(
    (await request("/api/legal-documents", { method: "POST", cookie, body: payload() })).status,
    409,
  );
  for (const extra of [
    { title: " " },
    { category_id: "missing" },
    { effective_date: "2026-02-30" },
    { effective_date: "nonsense" },
    { status: "bad" },
    { source_url: "javascript:alert(1)" },
    { source_url: "https://user:pass@example.org" },
    { source_url: "" },
    { role: "A05" },
  ])
    assert.equal(
      (
        await request("/api/legal-documents", {
          method: "POST",
          cookie,
          body: payload({ reference_number: crypto.randomUUID(), ...extra }),
        })
      ).status,
      400,
      JSON.stringify(extra),
    );
  for (const query of ["status=bad", "page=0", "pageSize=101"])
    assert.equal((await request(`/api/legal-documents?${query}`, { cookie })).status, 400);
  assert.equal((await request("/api/legal-documents/missing", { cookie })).status, 404);
  assert.equal(
    (
      await request("/api/legal-documents", {
        method: "POST",
        cookie,
        body: payload(),
        headers: { Origin: "http://evil.example" },
      })
    ).status,
    403,
  );
});

test("PDF create/upload/download enforce authorization, content, size, filename and concurrency", async (t) => {
  const { request, login } = await fixture(t);
  const cookie = await login();
  const created = await request("/api/legal-documents", {
    method: "POST",
    cookie,
    body: payload({
      source_url: "",
      file: { name: "Văn bản.pdf", contentBase64: pdf.toString("base64") },
    }),
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const id = created.data.document.id;
  const path = `/api/legal-documents/${id}/file`;
  assert.equal((await request(path)).status, 401);
  const reader = await login("demo.can-bo");
  const download = await request(path, { cookie: reader });
  assert.equal(download.status, 200);
  assert.deepEqual(download.data, pdf);
  assert.match(download.headers.get("content-disposition"), /^attachment;/);
  const upload = (file, version = "1", name = "updated.pdf") =>
    request(path, {
      method: "POST",
      cookie,
      raw: file,
      headers: {
        "Content-Type": "application/pdf",
        "X-File-Name": encodeURIComponent(name),
        "X-Document-Version": version,
      },
    });
  assert.equal((await upload(Buffer.from("not a pdf"))).status, 400);
  assert.equal((await upload(pdf, "1", "../bad.pdf")).status, 400);
  assert.equal((await upload(Buffer.alloc(MAX_DOCUMENT_BYTES + 1))).status, 413);
  assert.equal((await upload(pdf)).status, 200);
  assert.equal((await upload(pdf)).status, 409);
  assert.equal(
    (
      await request(path, {
        method: "POST",
        cookie: reader,
        raw: pdf,
        headers: { "Content-Type": "application/pdf" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(path, {
        method: "POST",
        cookie,
        raw: pdf,
        headers: { "Content-Type": "text/html" },
      })
    ).status,
    415,
  );
  const history = await request(`/api/legal-documents/${id}/history`, { cookie });
  assert.equal(history.data.items[0].action, "legal_document.file_uploaded");
  assert.ok(!JSON.stringify(history.data).includes(pdf.toString("base64")));
  const invalid = await request("/api/legal-documents", {
    method: "POST",
    cookie,
    body: payload({ file: { name: "bad.pdf", contentBase64: "NOT-BASE64" } }),
  });
  assert.equal(invalid.status, 400);
});

test("audit failure rolls back document mutation; seed preserves existing edits and append-only log", async (t) => {
  const { db, request, login } = await fixture(t);
  const cookie = await login();
  db.exec(
    "CREATE TRIGGER test_audit_failure BEFORE INSERT ON audit_logs WHEN NEW.feature='M05' BEGIN SELECT RAISE(ABORT,'test failure'); END",
  );
  const result = await request("/api/legal-documents", { method: "POST", cookie, body: payload() });
  assert.equal(result.status, 500);
  assert.equal(
    db
      .prepare("SELECT count(*) AS n FROM legal_documents WHERE reference_number='TEST-01/2026'")
      .get().n,
    0,
  );
  db.exec("DROP TRIGGER test_audit_failure");
  db.prepare("UPDATE legal_documents SET title='Edited sample' WHERE id='DEMO-DOC-1'").run();
  const count = db.prepare("SELECT count(*) AS n FROM audit_logs WHERE feature='M05'").get().n;
  await seedDemo(db, password);
  assert.equal(
    db.prepare("SELECT title FROM legal_documents WHERE id='DEMO-DOC-1'").get().title,
    "Edited sample",
  );
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM audit_logs WHERE feature='M05'").get().n,
    count,
  );
  assert.throws(() => db.exec("DELETE FROM audit_logs"));
  assert.throws(() => db.exec("UPDATE audit_logs SET feature='changed'"));
});

test("system audit filters actor/time/feature/action/object and protects snapshots from ordinary users", async (t) => {
  const { db, request, login } = await fixture(t);
  const cookie = await login();
  const start = new Date(Date.now() - 1000).toISOString();
  writeAudit(db, {
    actorId: "DEMO-A05",
    feature: "TEST",
    objectType: "test",
    objectId: "obj-1",
    action: "test.changed",
    before: { title: "old", password: "private" },
    after: { title: "new", nested: { token: "private", valid: true } },
  });
  const end = new Date(Date.now() + 1000).toISOString();
  const query = new URLSearchParams({
    actorId: "DEMO-A05",
    feature: "TEST",
    action: "test.changed",
    objectId: "obj-1",
    objectType: "test",
    from: start,
    to: end,
  });
  const logs = await request(`/api/audit-logs?${query}`, { cookie });
  assert.equal(logs.data.total, 1);
  assert.ok(logs.data.items[0].actor_name);
  assert.ok(!JSON.stringify(logs.data).includes("private"));
  assert.equal(
    (await request("/api/audit-logs?feature=M05&pageSize=1", { cookie })).data.items.length,
    1,
  );
  assert.equal((await request("/api/audit-logs?feature=none", { cookie })).data.total, 0);
  const reader = await login("demo.can-bo");
  assert.equal((await request("/api/audit-logs", { cookie: reader })).status, 403);
  assert.equal((await request("/api/audit-logs")).status, 401);
  for (const suffix of ["from=bad", "from=2026-10-16", `from=${end}&to=${start}`, "page=0"])
    assert.equal((await request(`/api/audit-logs?${suffix}`, { cookie })).status, 400);
});
