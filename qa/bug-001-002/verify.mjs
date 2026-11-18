import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { openDatabase } from "../../pccc-BE/src/core/database.js";

// The URL must point to the disposable database created by serve.mjs, never production.
assert.match(
  process.env.PCCC_QA_DATABASE_URL ?? "",
  /^postgresql:\/\/.*@127\.0\.0\.1:55432\/pccc_test_\d+_\d+$/,
);
const db = await openDatabase(process.env.PCCC_QA_DATABASE_URL, { migrations: false });
try {
  const version = await db
    .prepare("SELECT version() AS version,current_database() AS database")
    .get();
  const link = await db
    .prepare(
      `SELECT a.id AS account_id,a.username,a.officer_id,o.id AS profile_id,o.officer_code
    FROM accounts a JOIN officers o ON o.id=a.officer_id WHERE a.username='bug002.ui'`,
    )
    .get();
  assert.equal(link.officer_id, link.profile_id);
  assert.equal(link.officer_code, "BUG002-UI");
  assert.notEqual(link.officer_id, link.officer_code);
  const rejected = await db
    .prepare("SELECT count(*) AS n FROM accounts WHERE username='bug002.invalid'")
    .get();
  assert.equal(rejected.n, 0);
  const logs = await db
    .prepare(
      `SELECT action,feature,object_type,object_id FROM audit_logs
    WHERE action IN ('organization.officer_created','organization.unit_created') ORDER BY id`,
    )
    .all();
  assert.equal(logs.length, 2);
  assert.ok(logs.every((row) => row.feature === "M02"));
  assert.ok(logs.some((row) => row.object_type === "unit"));
  assert.ok(logs.some((row) => row.object_type === "officer"));
  const origin = "http://127.0.0.1:3100";
  const login = await fetch(origin + "/api/auth/login", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ username: "demo.admin", password: "Bug-regression-local-2026" }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const responses = [];
  for (const path of [
    "/api/authorization/accounts?search=BUG002-UI",
    `/api/officers/${link.profile_id}`,
    "/api/audit-logs?feature=M02",
  ]) {
    const response = await fetch(origin + path, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    const data = await response.json();
    if (path.startsWith("/api/officers/")) assert.equal(data.officer.linkedAccountCount, 1);
    responses.push({ path, status: response.status, data });
  }
  const proof = {
    checkedAt: new Date().toISOString(),
    ...version,
    link,
    rejectedAccounts: rejected.n,
    logs,
    responses,
  };
  writeFileSync(
    new URL("./api-database-evidence.json", import.meta.url),
    JSON.stringify(proof, null, 2) + "\n",
  );
  console.log(
    "PASS: UI fixture persisted in PostgreSQL; frontend proxy/API reads match database joins.",
  );
} finally {
  await db.close();
}
