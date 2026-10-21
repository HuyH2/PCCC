import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";

const password = "Temporary-test-password-2026";
const origin = "http://localhost:3000";

async function fixture(t) {
  const db = openDatabase(":memory:");
  await seedDemo(db, password);
  db.exec("UPDATE accounts SET must_change_password=0");
  const server = createApp(db, { appOrigin: origin });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function get(path, cookie) {
    const response = await fetch(base + path, { headers: cookie ? { Cookie: cookie } : {} });
    return { status: response.status, data: await response.json() };
  }
  async function login(username = "demo.admin") {
    const response = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  }
  return { db, get, login };
}

const sum = (items) => items.reduce((total, item) => total + item.facilityCount, 0);
const search = (get, cookie, q, extra = "") =>
  get(`/api/search?q=${encodeURIComponent(q)}${extra}`, cookie);

test("migration exposes read-only views joined to the shared catalog", async () => {
  const db = openDatabase(":memory:");
  try {
    await seedDemo(db, password);
    const row = db.prepare("SELECT * FROM facility_overview WHERE id='CS001'").get();
    assert.equal(row.region_name, "Khu phố 01 (mẫu)");
    assert.equal(row.unit_id, "DV-KV10");
    assert.equal(row.officer_name, "Cán bộ kiểm tra/Quản lý địa bàn (dữ liệu mẫu)");
    assert.equal(
      db.prepare("SELECT officer_name FROM facility_overview WHERE id='CS002'").get().officer_name,
      "Cán bộ khu vực 11 (dữ liệu mẫu)",
    );
  } finally {
    db.close();
  }
});

test("dashboard totals and breakdowns agree for system-wide scope", async (t) => {
  const { get, login } = await fixture(t);
  const cookie = await login();
  const summary = await get("/api/dashboard", cookie);
  assert.equal(summary.status, 200);
  assert.deepEqual(summary.data, { facilityCount: 3, officerCount: 2, regionCount: 3 });
  const byRegion = (await get("/api/dashboard/facilities-by-region", cookie)).data;
  assert.equal(byRegion.total, 3);
  assert.equal(sum(byRegion.items), 3);
  assert.equal(byRegion.items[0].unitName.length > 0, true);
  const byOfficer = (await get("/api/dashboard/facilities-by-officer", cookie)).data;
  assert.equal(byOfficer.total, 2);
  assert.equal(sum(byOfficer.items), 3);
  assert.deepEqual(byOfficer.items[0], {
    officerId: "CB-OTHER",
    officerName: "Cán bộ khu vực 11 (dữ liệu mẫu)",
    facilityCount: 2,
    regionCount: 2,
  });
  assert.equal(
    byOfficer.items.find((item) => item.officerId === "CB-A03").officerName,
    "Cán bộ kiểm tra/Quản lý địa bàn (dữ liệu mẫu)",
  );
});

test("dashboard follows unit, region, facility and empty scopes, including empty regions", async (t) => {
  const { db, get, login } = await fixture(t);
  db.exec(
    "INSERT INTO regions(id,name,unit_id,code) VALUES ('KP04','Khu phố 04 (mẫu)','DV-KV10','KP04')",
  );
  const commander = await login("demo.chi-huy");
  assert.deepEqual((await get("/api/dashboard", commander)).data, {
    facilityCount: 2,
    officerCount: 2,
    regionCount: 3,
  });
  const byRegion = (await get("/api/dashboard/facilities-by-region", commander)).data;
  assert.deepEqual(
    byRegion.items.map((item) => [item.regionId, item.facilityCount]),
    [
      ["KP01", 1],
      ["KP02", 1],
      ["KP04", 0],
    ],
  );
  const officer = await login("demo.can-bo");
  assert.deepEqual((await get("/api/dashboard", officer)).data, {
    facilityCount: 1,
    officerCount: 1,
    regionCount: 1,
  });
  db.exec(
    "DELETE FROM account_scopes WHERE account_id='DEMO-A01'; INSERT INTO account_scopes(account_id,kind,facility_id) VALUES ('DEMO-A01','facility','CS003')",
  );
  const facilityOnly = (await get("/api/dashboard/facilities-by-region", commander)).data;
  assert.deepEqual(
    facilityOnly.items.map((item) => [item.regionId, item.facilityCount]),
    [["KP03", 1]],
  );
  db.exec("DELETE FROM account_scopes WHERE account_id='DEMO-A01'");
  assert.deepEqual((await get("/api/dashboard", commander)).data, {
    facilityCount: 0,
    officerCount: 0,
    regionCount: 0,
  });
  assert.equal((await get("/api/dashboard/facilities-by-officer", commander)).data.total, 0);
});

test("dashboard paginates breakdowns and validates paging input", async (t) => {
  const { get, login } = await fixture(t);
  const cookie = await login();
  const page = (await get("/api/dashboard/facilities-by-region?pageSize=1&page=2", cookie)).data;
  assert.equal(page.items.length, 1);
  assert.equal(page.total, 3);
  assert.equal(page.page, 2);
  for (const query of ["pageSize=101", "page=0", "page=abc"])
    assert.equal((await get(`/api/dashboard/facilities-by-officer?${query}`, cookie)).status, 400);
});

test("search is accent-insensitive and groups results by data type", async (t) => {
  const { db, get, login } = await fixture(t);
  db.exec(
    "INSERT INTO facilities(id,name,address,region_id,officer_id) VALUES ('CS900','Nhà hàng Đông Á (mẫu)','Đường Lê Lợi','KP01','CB-A03')",
  );
  const cookie = await login();
  for (const q of ["dong a", "ĐÔNG Á", "le loi", "cs900"]) {
    const result = await search(get, cookie, q);
    assert.equal(result.status, 200);
    assert.equal(result.data.groups.facilities.total, 1, q);
    assert.equal(result.data.groups.facilities.items[0].id, "CS900");
    assert.equal(result.data.groups.facilities.items[0].regionName, "Khu phố 01 (mẫu)");
  }
  const all = (await search(get, cookie, "mẫu")).data.groups;
  assert.equal(all.facilities.total, 4);
  assert.equal(all.regions.total, 3);
  assert.equal(all.units.total, 15);
  assert.equal(all.officers.total, 2);
  assert.equal(all.officers.items[0].facilityCount, 2);
  const limited = (await search(get, cookie, "mau", "&limit=1")).data.groups;
  assert.equal(limited.facilities.items.length, 1);
  assert.equal(limited.facilities.total, 4);
  const injection = await search(get, cookie, "' OR 1=1--");
  assert.equal(injection.status, 200);
  assert.equal(injection.data.groups.facilities.total, 0);
});

test("search never returns objects outside the caller's data scope", async (t) => {
  const { db, get, login } = await fixture(t);
  const officer = await login("demo.can-bo");
  let groups = (await search(get, officer, "CS00")).data.groups;
  assert.deepEqual(
    groups.facilities.items.map((item) => item.id),
    ["CS001"],
  );
  groups = (await search(get, officer, "mau")).data.groups;
  assert.deepEqual(
    groups.regions.items.map((item) => item.id),
    ["KP01"],
  );
  assert.equal(groups.units.total, 0);
  assert.equal((await search(get, officer, "CB-OTHER")).data.groups.officers.total, 0);
  assert.equal((await search(get, officer, "CB-A03")).data.groups.officers.total, 1);

  const commander = await login("demo.chi-huy");
  groups = (await search(get, commander, "mau")).data.groups;
  assert.deepEqual(groups.units.items.map((item) => item.id).sort(), [
    "DEMO-ORG-P01",
    "DEMO-ORG-P02",
    "DV-KV10",
  ]);
  assert.equal(groups.facilities.total, 2);

  db.exec("DELETE FROM account_scopes WHERE account_id='DEMO-A03'");
  groups = (await search(get, officer, "mau")).data.groups;
  for (const name of ["facilities", "officers", "regions", "units"])
    assert.equal(groups[name].total, 0, name);
});

test("search and dashboard enforce authentication, permissions and input limits", async (t) => {
  const { db, get, login } = await fixture(t);
  assert.equal((await search(get, null, "mau")).status, 401);
  assert.equal((await get("/api/dashboard", null)).status, 401);
  const cookie = await login("demo.to-truong");
  db.exec("DELETE FROM role_permissions WHERE role_code='A02' AND permission_code='M03.view'");
  const withoutFacilities = await search(get, cookie, "mau");
  assert.equal(withoutFacilities.status, 200);
  assert.deepEqual(Object.keys(withoutFacilities.data.groups).sort(), ["regions", "units"]);
  assert.equal((await get("/api/dashboard", cookie)).status, 403);
  assert.equal((await get("/api/dashboard/facilities-by-region", cookie)).status, 403);
  db.exec("DELETE FROM role_permissions WHERE role_code='A02' AND permission_code='M10.view'");
  const forbidden = await search(get, cookie, "x");
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.data.error.code, "FORBIDDEN");

  const admin = await login();
  for (const query of ["q=a", `q=${"x".repeat(101)}`, "q=", "q=mau&limit=0", "q=mau&limit=51"])
    assert.equal((await get(`/api/search?${query}`, admin)).status, 400, query);
});
