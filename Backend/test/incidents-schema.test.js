import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openDatabase, transaction } from "../src/database.js";
import { seedDemo } from "../src/seed.js";
import { audit } from "../src/authentication.js";
import {
  runDemoSeed,
  seedIncidentsDemo,
  verifyDemoTarget,
} from "../scripts/seed-incidents-demo.js";

const password = "Isolated-schema-test-password-2026";
const now = Date.UTC(2026, 9, 14, 3);
const migrationDirectory = new URL("../migrations/", import.meta.url);

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
  const db = openDatabase(":memory:");
  t.after(() => db.close());
  await seedDemo(db, password);
  return db;
}

function incident(db, overrides = {}) {
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
  db.prepare(
    `INSERT INTO incidents
    (id,incident_code,incident_type,incident_subtype,occurred_at,reported_at,address,region_id,unit_id,
     facility_id,record_status,processing_status,deadline_at,completed_at,created_by,updated_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'DEMO-A04','DEMO-A04',?,?)`,
  ).run(
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

test("M09 upgrade preserves real shared tables, grants and audit; data survives reopening", async (t) => {
  const directory = temporaryDirectory(t);
  const databasePath = join(directory, "upgrade.sqlite");
  let db = new DatabaseSync(databasePath);
  try {
    db.exec(
      "PRAGMA foreign_keys=ON; CREATE TABLE schema_migrations(name TEXT PRIMARY KEY,applied_at INTEGER NOT NULL)",
    );
    for (const name of ["001-auth.sql", "002-organization.sql"]) {
      transaction(db, () => {
        db.exec(readFileSync(new URL(name, migrationDirectory), "utf8"));
        db.prepare("INSERT INTO schema_migrations VALUES (?,?)").run(name, now);
      });
    }
    await seedDemo(db, password);
    audit(db, "DEMO-A04", "synthetic.pre_existing", "synthetic", null, { synthetic: true }, "test");
    const tables = [
      "accounts",
      "roles",
      "permissions",
      "role_permissions",
      "account_scopes",
      "units",
      "regions",
      "officers",
      "facilities",
      "audit_logs",
    ];
    const snapshot = Object.fromEntries(
      tables.map((table) => [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]),
    );
    db.close();
    db = openDatabase(databasePath);
    for (const table of tables)
      assert.deepEqual(
        db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
        snapshot[table],
        table,
      );
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    assert.equal(
      db
        .prepare(
          "SELECT count(*) AS total FROM role_permissions WHERE permission_code LIKE 'M09.%'",
        )
        .get().total,
      0,
    );
    incident(db);
    db.close();
    db = openDatabase(databasePath);
    assert.equal(
      db.prepare("SELECT incident_code FROM incidents WHERE id='SCHEMA-INC-1'").get().incident_code,
      "SCHEMA-001",
    );
    assert.equal(
      db.prepare("SELECT count(*) AS total FROM schema_migrations").get().total,
      readdirSync(migrationDirectory).filter((name) => name.endsWith(".sql")).length,
    );
  } finally {
    db.close();
  }
});

test("M09 schema separates draft, processing and deadlines; enforces references, unique codes and numeric damage", async (t) => {
  const db = await fixture(t);
  incident(db);
  incident(db, {
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
    assert.throws(() => incident(db, { id: "INVALID", code: "INVALID", ...overrides }));
  db.prepare("INSERT INTO incident_subtypes VALUES ('FIRE','TEST','Phân loại giả lập',1)").run();
  incident(db, { id: "SUBTYPE", code: "SUBTYPE", subtype: "TEST" });
  assert.throws(() =>
    incident(db, { id: "WRONG-TYPE", code: "WRONG-TYPE", type: "EXPLOSION", subtype: "TEST" }),
  );
  incident(db, {
    id: "COMPLETE",
    code: "COMPLETE",
    status: "COMPLETED",
    completed: now,
    deadline: now - 1,
  });
  const damage = db.prepare(`INSERT INTO incident_damages
    (id,incident_id,damage_group,damage_type,quantity,property_value,updated_by,created_at,updated_at)
    VALUES (?,'SCHEMA-INC-1',?,'TEST',?,?,'DEMO-A04',?,?)`);
  damage.run("DAMAGE-1", "HUMAN", 2, 0, now, now);
  damage.run("DAMAGE-2", "PROPERTY", 1, 5000000, now, now);
  for (const [group, quantity, value] of [
    ["HUMAN", -1, 0],
    ["HUMAN", 0.5, 0],
    ["HUMAN", 1, 1],
    ["PROPERTY", 1, -1],
    ["PROPERTY", 1, 0.5],
    ["PROPERTY", 1, 9000000000000001],
    ["PROPERTY", 1000000001, 0],
  ])
    assert.throws(() => damage.run("INVALID-DAMAGE", group, quantity, value, now, now));
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("M09 business and history/audit transaction rolls back; status history is append-only", async (t) => {
  const db = await fixture(t);
  assert.throws(() =>
    transaction(db, () => {
      incident(db);
      audit(
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
  assert.equal(db.prepare("SELECT count(*) AS total FROM incidents").get().total, 0);
  incident(db);
  db.prepare(
    `INSERT INTO incident_status_history
    (incident_id,to_status,to_record_status,changed_by,changed_at,reason)
    VALUES ('SCHEMA-INC-1','NEW','OFFICIAL','DEMO-A04',?,'Khởi tạo giả lập')`,
  ).run(now);
  assert.throws(() => db.exec("UPDATE incident_status_history SET reason='changed'"));
  assert.throws(() => db.exec("DELETE FROM incident_status_history"));
  assert.throws(() => db.exec("DELETE FROM incidents WHERE id='SCHEMA-INC-1'"));
});

test("M09 demo seed requires explicit isolated paths and markers; rerun preserves rows and private file", async (t) => {
  const directory = temporaryDirectory(t);
  const databasePath = join(directory, "incidents-demo.sqlite");
  const uploadsDirectory = join(directory, "incidents-demo-uploads");
  const argv = ["--demo", "--database", databasePath, "--uploads", uploadsDirectory];
  await assert.rejects(runDemoSeed([], password));
  assert.throws(() => verifyDemoTarget(join(directory, "pccc.sqlite"), uploadsDirectory));
  const first = await runDemoSeed(argv, password);
  assert.equal(first.incidents, 5);
  assert.equal(first.assignments, 3);
  assert.equal(first.damages, 5);
  assert.equal(first.documents, 1);
  let db = new DatabaseSync(databasePath, { readOnly: true });
  let before;
  try {
    before = Object.fromEntries(
      [
        "incidents",
        "incident_damages",
        "incident_assignments",
        "incident_documents",
        "incident_status_history",
        "audit_logs",
        "accounts",
        "role_permissions",
      ].map((table) => [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]),
    );
    assert.equal(
      db
        .prepare(
          "SELECT count(*) AS total FROM role_permissions WHERE permission_code LIKE 'M09.%'",
        )
        .get().total,
      0,
    );
    assert.equal(
      db
        .prepare(
          "SELECT count(*) AS total FROM incident_assignments WHERE incident_id='DEMO-INC-FIRE'",
        )
        .get().total,
      2,
    );
    const doc = db.prepare("SELECT * FROM incident_documents WHERE id='DEMO-DOC-1'").get();
    assert.equal(readFileSync(join(uploadsDirectory, doc.storage_key)).length, doc.size_bytes);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
  }
  assert.deepEqual(await runDemoSeed(argv, password), first);
  db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    for (const [table, rows] of Object.entries(before))
      assert.deepEqual(db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(), rows, table);
  } finally {
    db.close();
  }
  assert.deepEqual(readdirSync(uploadsDirectory).sort(), [
    ".m09-demo-uploads",
    "00000000-0000-4000-8000-000000000009.txt",
  ]);
  const unknownDirectory = join(directory, "unknown");
  const unknownPath = join(unknownDirectory, "incidents-demo.sqlite");
  const unknown = openDatabase(unknownPath);
  unknown.close();
  assert.throws(() =>
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
  db.exec(
    "CREATE TRIGGER reject_demo_document BEFORE INSERT ON incident_documents BEGIN SELECT RAISE(ABORT,'synthetic failure'); END",
  );
  assert.throws(
    () => seedIncidentsDemo(db, { uploadsDirectory: directory, now }),
    /synthetic failure/,
  );
  assert.equal(db.prepare("SELECT count(*) AS total FROM incidents").get().total, 0);
  assert.equal(db.prepare("SELECT count(*) AS total FROM incident_status_history").get().total, 0);
  assert.equal(db.prepare("SELECT count(*) AS total FROM audit_logs").get().total, 0);
  assert.deepEqual(readdirSync(directory), []);
});
