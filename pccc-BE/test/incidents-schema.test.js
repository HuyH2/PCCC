import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { openDatabase, transaction } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { audit } from "../src/modules/audit/audit.service.js";
import {
  runDemoSeed,
  seedIncidentsDemo,
  verifyDemoTarget,
} from "../scripts/seed-incidents-demo.js";

const password = "Isolated-schema-test-password-2026";
const now = Date.UTC(2026, 9, 14, 3);

function temporaryDirectory(t) {
  const directory = mkdtempSync(join(tmpdir(), "pccc-inc-schema-"));
  const absolute = resolve(directory);
  assert.ok(absolute.startsWith(resolve(tmpdir()) + sep));
  t.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

async function fixture(t) {
  const db = await openDatabase(":memory:");
  t.after(async () => await db.close());
  await seedDemo(db, password);
  return db;
}

async function incident(db, overrides = {}) {
  const values = {
    id: "SCHEMA-INC-1",
    code: "SCHEMA-001",
    type: "FIRE",
    subtype: null,
    occurred: now,
    address: "Địa chỉ giả lập",
    region: "KP01",
    unit: "DV-KV10",
    facility: "CS001",
    record: "OFFICIAL",
    status: "NEW",
    deadline: null,
    completed: null,
    ...overrides,
  };
  await db
    .prepare(
      `INSERT INTO incidents
    (id,incident_code,incident_type,incident_subtype,occurred_at,reported_at,address,region_id,unit_id,
     facility_id,record_status,processing_status,deadline_at,completed_at,created_by,updated_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'DEMO-A04','DEMO-A04',?,?)`,
    )
    .run(
      values.id,
      values.code,
      values.type,
      values.subtype,
      values.occurred,
      now,
      values.address,
      values.region,
      values.unit,
      values.facility,
      values.record,
      values.status,
      values.deadline,
      values.completed,
      now,
      now,
    );
}

test("M09 schema separates draft, processing and deadlines; enforces references, unique codes and numeric damage", async (t) => {
  const db = await fixture(t);
  await incident(db);
  await incident(db, {
    id: "DRAFT",
    code: "DRAFT",
    type: null,
    occurred: null,
    address: "",
    record: "DRAFT",
  });
  for (const overrides of [
    { code: "schema-001" },
    { type: "INVALID" },
    { subtype: "INVALID" },
    { region: "missing" },
    { unit: "missing" },
    { facility: "missing" },
    { type: null },
    { occurred: null },
    { address: " " },
    { occurred: "invalid" },
    { deadline: -1 },
    { status: "OVERDUE" },
    { status: "COMPLETED" },
    { completed: now },
  ])
    await assert.rejects(
      async () => await incident(db, { id: "INVALID", code: "INVALID", ...overrides }),
    );
  await db
    .prepare("INSERT INTO incident_subtypes VALUES ('FIRE','TEST','Phân loại giả lập',1)")
    .run();
  await incident(db, { id: "SUBTYPE", code: "SUBTYPE", subtype: "TEST" });
  await assert.rejects(
    async () =>
      await incident(db, {
        id: "WRONG-TYPE",
        code: "WRONG-TYPE",
        type: "EXPLOSION",
        subtype: "TEST",
      }),
  );
  await incident(db, {
    id: "COMPLETE",
    code: "COMPLETE",
    status: "COMPLETED",
    completed: now,
    deadline: now - 1,
  });
  const damage = db.prepare(`INSERT INTO incident_damages
    (id,incident_id,damage_group,damage_type,quantity,property_value,updated_by,created_at,updated_at)
    VALUES (?,'SCHEMA-INC-1',?,'TEST',?,?,'DEMO-A04',?,?)`);
  await damage.run("DAMAGE-1", "HUMAN", 2, 0, now, now);
  await damage.run("DAMAGE-2", "PROPERTY", 1, 5000000, now, now);
  for (const [group, quantity, value] of [
    ["HUMAN", -1, 0],
    ["HUMAN", 0.5, 0],
    ["HUMAN", 1, 1],
    ["PROPERTY", 1, -1],
    ["PROPERTY", 1, 0.5],
    ["PROPERTY", 1, 9000000000000001],
    ["PROPERTY", 1000000001, 0],
  ])
    await assert.rejects(
      async () => await damage.run("INVALID-DAMAGE", group, quantity, value, now, now),
    );
});

test("M09 business and history/audit transaction rolls back; status history is append-only", async (t) => {
  const db = await fixture(t);
  await assert.rejects(
    async () =>
      await transaction(db, async () => {
        await incident(db);
        await audit(
          db,
          "missing-account",
          "incident.created",
          "SCHEMA-INC-1",
          null,
          { synthetic: true },
          "test",
        );
      }),
  );
  assert.equal((await db.prepare("SELECT count(*) AS total FROM incidents").get()).total, 0);
  await incident(db);
  await db
    .prepare(
      `INSERT INTO incident_status_history
    (incident_id,to_status,to_record_status,changed_by,changed_at,reason)
    VALUES ('SCHEMA-INC-1','NEW','OFFICIAL','DEMO-A04',?,'Khởi tạo giả lập')`,
    )
    .run(now);
  await assert.rejects(
    async () => await db.exec("UPDATE incident_status_history SET reason='changed'"),
  );
  await assert.rejects(async () => await db.exec("DELETE FROM incident_status_history"));
  await assert.rejects(async () => await db.exec("DELETE FROM incidents WHERE id='SCHEMA-INC-1'"));
});

test("M09 demo seed requires explicit isolated paths and markers; rerun preserves rows and private file", async (t) => {
  const directory = temporaryDirectory(t);
  const databasePath = join(directory, "incidents-demo-db");
  const uploadsDirectory = join(directory, "incidents-demo-uploads");
  const argv = ["--demo", "--database", databasePath, "--uploads", uploadsDirectory];
  await assert.rejects(runDemoSeed([], password));
  await assert.rejects(verifyDemoTarget(join(directory, "pccc-pg"), uploadsDirectory));
  await assert.rejects(verifyDemoTarget("postgresql://localhost/pccc", uploadsDirectory));
  const first = await runDemoSeed(argv, password);
  assert.equal(first.incidents, 5);
  assert.equal(first.assignments, 3);
  assert.equal(first.damages, 5);
  assert.equal(first.documents, 1);
  const tables = [
    "incidents",
    "incident_damages",
    "incident_assignments",
    "incident_documents",
    "incident_status_history",
    "audit_logs",
    "accounts",
    "role_permissions",
  ];
  // Full-row ordering gives a stable snapshot to compare across reruns.
  const snapshot = async (db) =>
    Object.fromEntries(
      await Promise.all(
        tables.map(async (table) => [
          table,
          await db.prepare(`SELECT * FROM ${table} t ORDER BY t::text`).all(),
        ]),
      ),
    );
  let db = await openDatabase(databasePath, { migrations: false });
  let before;
  try {
    before = await snapshot(db);
    assert.equal(
      (
        await db
          .prepare(
            "SELECT count(*) AS total FROM role_permissions WHERE permission_code LIKE 'M09.%'",
          )
          .get()
      ).total,
      0,
    );
    assert.equal(
      (
        await db
          .prepare(
            "SELECT count(*) AS total FROM incident_assignments WHERE incident_id='DEMO-INC-FIRE'",
          )
          .get()
      ).total,
      2,
    );
    const doc = await db.prepare("SELECT * FROM incident_documents WHERE id='DEMO-DOC-1'").get();
    assert.equal(readFileSync(join(uploadsDirectory, doc.storage_key)).length, doc.size_bytes);
  } finally {
    await db.close();
  }
  assert.deepEqual(await runDemoSeed(argv, password), first);
  db = await openDatabase(databasePath, { migrations: false });
  try {
    const after = await snapshot(db);
    for (const table of tables) assert.deepEqual(after[table], before[table], table);
  } finally {
    await db.close();
  }
  assert.deepEqual(readdirSync(uploadsDirectory).sort(), [
    ".m09-demo-uploads",
    "00000000-0000-4000-8000-000000000009.txt",
  ]);
  const unknownDirectory = join(directory, "unknown");
  const unknownPath = join(unknownDirectory, "incidents-demo-db");
  const unknown = await openDatabase(unknownPath);
  await unknown.close();
  await assert.rejects(
    verifyDemoTarget(unknownPath, join(unknownDirectory, "incidents-demo-uploads")),
  );
  writeFileSync(
    join(uploadsDirectory, "00000000-0000-4000-8000-000000000009.txt"),
    "Changed synthetic document",
  );
  await assert.rejects(runDemoSeed(argv, password), /Refusing to overwrite/);
});

test("M09 demo seed cleans new private file when metadata transaction fails", async (t) => {
  const directory = temporaryDirectory(t);
  const db = await fixture(t);
  const existingAuditCount = (await db.prepare("SELECT count(*) AS total FROM audit_logs").get())
    .total;
  await db.exec(
    "CREATE TRIGGER reject_demo_document BEFORE INSERT ON incident_documents FOR EACH ROW EXECUTE FUNCTION raise_abort('synthetic failure')",
  );
  await assert.rejects(
    async () => await seedIncidentsDemo(db, { uploadsDirectory: directory, now }),
    /synthetic failure/,
  );
  assert.equal((await db.prepare("SELECT count(*) AS total FROM incidents").get()).total, 0);
  assert.equal(
    (await db.prepare("SELECT count(*) AS total FROM incident_status_history").get()).total,
    0,
  );
  assert.equal(
    (await db.prepare("SELECT count(*) AS total FROM audit_logs").get()).total,
    existingAuditCount,
  );
  assert.deepEqual(readdirSync(directory), []);
});
