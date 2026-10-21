import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";

const password = "Temporary-test-password-2026";
const origin = "http://localhost:3000";

async function fixture(t) {
  const db = await openDatabase(":memory:");
  await seedDemo(db, password);
  await db.exec("UPDATE accounts SET must_change_password=0");
  const server = createApp(db, { appOrigin: origin });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { method = "GET", body, cookie, headers = {} } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      data: response.status === 204 ? null : await response.json(),
      cookie: response.headers.get("set-cookie"),
      headers: response.headers,
    };
  }
  async function login(username = "demo.admin") {
    const response = await request("/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return response.cookie.split(";")[0];
  }
  return { db, request, login, base };
}

test("data-transfer endpoints require authentication", async (t) => {
  const { request } = await fixture(t);
  assert.equal((await request("/api/data-transfers/datasets")).status, 401);
  assert.equal(
    (await request("/api/data-transfers/export", { method: "POST", body: {} })).status,
    401,
  );
  assert.equal((await request("/api/data-transfers")).status, 401);
  assert.equal((await request("/api/data-transfers/nonexistent-job")).status, 401);
});

test("data exports enforce grants and scope, write audit history, and provide stable CSV headers", async (t) => {
  const { db, request, login, base } = await fixture(t);
  await db.exec(
    "INSERT INTO role_permissions VALUES ('A03','M03.export'),('A03','M02.view'),('A03','M02.export')",
  );
  await db
    .prepare("UPDATE facilities SET address=? WHERE id='CS001'")
    .run('=HYPERLINK("https://invalid")');
  const cookie = await login("demo.can-bo");
  const datasets = await request("/api/data-transfers/datasets", { cookie });
  assert.equal(datasets.status, 200);
  assert.deepEqual(
    datasets.data.items.map((item) => item.id),
    ["facilities", "officers", "regions"],
  );

  const download = async (body) =>
    fetch(`${base}/api/data-transfers/export`, {
      method: "POST",
      headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const facilityResponse = await download({ dataset: "facilities", format: "csv", filters: {} });
  assert.equal(facilityResponse.status, 200);
  assert.match(facilityResponse.headers.get("content-type"), /text\/csv/);
  assert.match(facilityResponse.headers.get("content-disposition"), /attachment/);
  const facilityCsv = await facilityResponse.text();
  assert.ok(facilityCsv.startsWith('"'));
  const expectedHeader = facilityCsv.split("\r\n")[0];
  assert.equal(expectedHeader.split(",").length, 9);
  assert.match(facilityCsv, /CS001/);
  assert.match(facilityCsv, /'=?HYPERLINK/);
  assert.doesNotMatch(facilityCsv, /CS002|CS003/);

  const emptyResponse = await download({
    dataset: "facilities",
    format: "csv",
    filters: { regionId: "KP02" },
  });
  assert.equal(emptyResponse.status, 200);
  assert.equal((await emptyResponse.text()).split("\r\n")[0], expectedHeader);

  const officerResponse = await download({ dataset: "officers", format: "csv", filters: {} });
  assert.equal(officerResponse.status, 200);
  const officerCsv = await officerResponse.text();
  assert.match(officerCsv, /CB-A03/);
  assert.doesNotMatch(officerCsv, /CB-A01|CB-A02|CB-A04/);
  const regionResponse = await download({ dataset: "regions", format: "csv", filters: {} });
  assert.equal(regionResponse.status, 200);
  const regionCsv = await regionResponse.text();
  assert.match(regionCsv, /KP01/);
  assert.doesNotMatch(regionCsv, /KP02|KP03/);

  const history = await request("/api/data-transfers?direction=export", { cookie });
  assert.equal(history.status, 200);
  assert.equal(history.data.total, 4);
  assert.ok(history.data.items.every((job) => job.actor_id === "DEMO-A03"));
  const ownDetail = await request(`/api/data-transfers/${history.data.items[0].id}`, { cookie });
  assert.equal(ownDetail.status, 200);
  assert.equal(
    (
      await db
        .prepare(
          "SELECT count(*) AS n FROM audit_logs WHERE action='data_transfer.export.succeeded'",
        )
        .get()
    ).n,
    4,
  );

  const filteredOfficerResponse = await download({
    dataset: "officers",
    format: "csv",
    filters: { regionId: "KP01" },
  });
  assert.equal(filteredOfficerResponse.status, 200);
  const filteredOfficerCsv = await filteredOfficerResponse.text();
  assert.match(filteredOfficerCsv, /Khu phố 01/);
  assert.doesNotMatch(filteredOfficerCsv, /Khu phố 02/);

  assert.equal(
    (await download({ dataset: "facilities", format: "xlsx", filters: {} })).status,
    400,
  );
  assert.equal(
    (await download({ dataset: "facilities", format: "csv", filters: { unknown: "x" } })).status,
    400,
  );
  const ungranted = await login("demo.nguoi-xem");
  const denied = await fetch(`${base}/api/data-transfers/export`, {
    method: "POST",
    headers: { Origin: origin, Cookie: ungranted, "Content-Type": "application/json" },
    body: JSON.stringify({ dataset: "facilities", format: "csv", filters: {} }),
  });
  assert.equal(denied.status, 403);
});

test("officer export uses scoped personnel profiles, including staff without accounts", async (t) => {
  const { db, login, base } = await fixture(t);
  const cookie = await login();
  const unlinked = await db
    .prepare(
      "SELECT o.officer_code FROM officers o LEFT JOIN accounts a ON a.officer_id=o.id WHERE a.id IS NULL LIMIT 1",
    )
    .get();
  assert.ok(unlinked);
  const exportOfficers = (filters) =>
    fetch(`${base}/api/data-transfers/export`, {
      method: "POST",
      headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ dataset: "officers", format: "csv", filters }),
    });
  const response = await exportOfficers({});
  assert.equal(response.status, 200);
  const csv = await response.text();
  assert.match(csv, /"Chức vụ","Đơn vị","Vai trò","Trạng thái"/);
  assert.ok(csv.includes(unlinked.officer_code));
  assert.equal(
    csv.split("\r\n").length - 2,
    (await db.prepare("SELECT count(*) AS n FROM officers").get()).n,
  );

  const filtered = await exportOfficers({ search: unlinked.officer_code });
  assert.equal(filtered.status, 200);
  assert.equal((await filtered.text()).split("\r\n").length - 2, 1);
  const invalidStatus = await exportOfficers({ status: "locked" });
  assert.equal(invalidStatus.status, 400);
});

test("data transfer job history is owner-limited unless system admin has global scope", async (t) => {
  const { db, request, login, base } = await fixture(t);
  await db.exec("INSERT INTO role_permissions VALUES ('A03','M03.export')");
  const owner = await login("demo.can-bo");
  const exported = await fetch(`${base}/api/data-transfers/export`, {
    method: "POST",
    headers: { Origin: origin, Cookie: owner, "Content-Type": "application/json" },
    body: JSON.stringify({ dataset: "facilities", format: "csv", filters: {} }),
  });
  assert.equal(exported.status, 200);
  const outsider = await login("demo.tong-hop");
  assert.equal((await request("/api/data-transfers", { cookie: outsider })).status, 200);
  assert.equal((await request("/api/data-transfers", { cookie: outsider })).data.total, 0);
  const admin = await login("demo.admin");
  assert.equal((await request("/api/data-transfers", { cookie: admin })).status, 200);
  assert.equal((await request("/api/data-transfers", { cookie: admin })).data.total, 1);
  const jobId = (await db.prepare("SELECT id FROM data_transfer_jobs LIMIT 1").get()).id;
  await db
    .prepare(
      "INSERT INTO data_transfer_errors(job_id,row_number,message,created_at) VALUES (?,1,'sample',?)",
    )
    .run(jobId, Date.now());
  await assert.rejects(
    async () => await db.prepare("UPDATE data_transfer_errors SET message='changed'").run(),
  );
  await assert.rejects(async () => await db.prepare("DELETE FROM data_transfer_errors").run());
  await assert.rejects(async () => await db.prepare("DELETE FROM data_transfer_jobs").run());
});
