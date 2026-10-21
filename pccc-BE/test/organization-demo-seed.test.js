import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";

test("organization demo seed creates directory records and remains idempotent", async () => {
  const db = await openDatabase(":memory:");
  try {
    await seedDemo(db, "Organization-demo-password-2026");
    assert.equal((await db.prepare("SELECT count(*) AS total FROM units").get()).total, 15);
    assert.equal((await db.prepare("SELECT count(*) AS total FROM officers").get()).total, 79);
    assert.equal(
      (await db.prepare("SELECT count(*) AS total FROM officers WHERE id LIKE 'DEMO-ORG-O%'").get())
        .total,
      72,
    );
    assert.equal(
      (await db.prepare("SELECT count(*) AS total FROM officers WHERE status='TRANSFERRED'").get())
        .total,
      4,
    );
    assert.equal(
      (await db.prepare("SELECT count(*) AS total FROM officers WHERE status='INACTIVE'").get())
        .total,
      6,
    );
    await db
      .prepare("UPDATE officers SET notes=? WHERE id=?")
      .run("Ghi chú do người dùng cập nhật", "DEMO-ORG-O001");
    await seedDemo(db, "Organization-demo-password-2026");
    assert.equal((await db.prepare("SELECT count(*) AS total FROM units").get()).total, 15);
    assert.equal((await db.prepare("SELECT count(*) AS total FROM officers").get()).total, 79);
    assert.equal(
      (await db.prepare("SELECT notes FROM officers WHERE id='DEMO-ORG-O001'").get()).notes,
      "Ghi chú do người dùng cập nhật",
    );
  } finally {
    await db.close();
  }
});
