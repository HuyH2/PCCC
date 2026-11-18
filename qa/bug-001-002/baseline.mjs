import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { openDatabase } from "../../pccc-BE/src/core/database.js";
import { seedDemo } from "../../pccc-BE/src/core/seed.js";
import { principalFor } from "../../pccc-BE/src/modules/auth/auth.service.js";
import { createOfficer } from "../../pccc-BE/src/core/organization.js";

assert.ok(process.env.PCCC_TEST_DATABASE_URL, "A dedicated PostgreSQL test server is required.");
const baseline = "efcebe7";
async function originalModule(path) {
  const location = new URL(`../../${path}`, import.meta.url);
  const source = execFileSync("git", ["show", `${baseline}:${path}`], { encoding: "utf8" }).replace(
    /from "(\.[^"]+)"/g,
    (_, relative) => `from "${new URL(relative, location).href}"`,
  );
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}
const oldAudit = await originalModule("pccc-BE/src/modules/audit/audit.service.js");
const oldAdministration = await originalModule(
  "pccc-BE/src/modules/administration/administration.service.js",
);
const db = await openDatabase(":memory:");
try {
  const password = "Baseline-only-test-2026";
  await seedDemo(db, password);
  await db.exec("UPDATE accounts SET must_change_password=0");
  await db
    .prepare("INSERT INTO role_permissions VALUES ('A05','M02.create') ON CONFLICT DO NOTHING")
    .run();
  const admin = await principalFor(
    db,
    await db.prepare("SELECT * FROM accounts WHERE id='DEMO-A05'").get(),
  );
  const officer = await createOfficer(
    db,
    admin,
    {
      officerCode: "BUG002-BASELINE",
      fullName: "Cán bộ kiểm thử baseline",
      rank: "Đại úy",
      position: "Cán bộ",
      phone: "0900000098",
      email: "baseline@example.test",
      unitId: "DV-KV10",
      businessRole: "A03",
    },
    "127.0.0.1",
  );
  await oldAudit.audit(
    db,
    admin.id,
    "organization.officer_updated",
    officer.id,
    null,
    { fullName: officer.fullName },
    "127.0.0.1",
  );
  const audit = await db
    .prepare(
      "SELECT feature,object_type,action FROM audit_logs WHERE action='organization.officer_updated'",
    )
    .get();
  assert.equal(audit.feature, "M01.authorization");
  assert.equal(audit.object_type, "account");
  const result = await oldAdministration.createAccount(
    db,
    admin,
    {
      username: "bug002.baseline",
      fullName: officer.fullName,
      officerId: officer.officerCode,
      role: "A03",
      password,
      scopes: [{ kind: "unit", targetId: "DV-KV10" }],
    },
    "127.0.0.1",
  );
  assert.equal(result.account.officer_id, officer.officerCode);
  assert.notEqual(result.account.officer_id, officer.id);
  const links = await db
    .prepare("SELECT count(*) AS n FROM accounts WHERE officer_id=?")
    .get(officer.id);
  assert.equal(links.n, 0);
  const proof = {
    baseline,
    database: await db.prepare("SELECT version() AS version").get(),
    audit,
    account: { officer_id: result.account.officer_id },
    profile: { id: officer.id, officerCode: officer.officerCode },
    linkedAccountCount: links.n,
  };
  writeFileSync(
    new URL("./baseline-evidence.json", import.meta.url),
    JSON.stringify(proof, null, 2) + "\n",
  );
  console.log("REPRODUCED on main efcebe7 + PostgreSQL: BUG-001 and BUG-002.");
} finally {
  await db.close();
}
