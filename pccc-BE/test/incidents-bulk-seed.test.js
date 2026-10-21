import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { seedIncidentsBulk } from "../scripts/seed-incidents-bulk.js";

test("bulk M09 demo seed covers statuses and related data without replacing edits", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "pccc-m09-bulk-"));
  const db = await openDatabase(":memory:");
  t.after(async () => {
    await db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  await seedDemo(db, "Isolated-bulk-seed-password-2026");

  const options = { now: Date.UTC(2026, 9, 21, 3), uploadDirectory: directory };
  assert.deepEqual(await seedIncidentsBulk(db, options), { inserted: 80, total: 80 });
  assert.deepEqual(
    (
      await db
        .prepare(
          "SELECT processing_status AS status,count(*) AS total FROM incidents GROUP BY processing_status ORDER BY status",
        )
        .all()
    ).map((row) => [row.status, row.total]),
    [
      ["CLOSED", 19],
      ["COMPLETED", 18],
      ["IN_PROGRESS", 18],
      ["NEW", 25],
    ],
  );
  assert.equal(
    (await db.prepare("SELECT count(*) AS total FROM incident_damages").get()).total > 80,
    true,
  );
  assert.equal(
    (await db.prepare("SELECT count(*) AS total FROM incident_assignments").get()).total > 30,
    true,
  );
  assert.equal(
    (await db.prepare("SELECT count(*) AS total FROM incident_documents").get()).total,
    4,
  );
  assert.equal(readdirSync(directory).length, 4);

  await db
    .prepare("UPDATE incidents SET title='Đã chỉnh sửa trên UI' WHERE id='DEMO-M09-001'")
    .run();
  assert.deepEqual(await seedIncidentsBulk(db, options), { inserted: 0, total: 80 });
  assert.equal(
    (await db.prepare("SELECT title FROM incidents WHERE id='DEMO-M09-001'").get()).title,
    "Đã chỉnh sửa trên UI",
  );
});
