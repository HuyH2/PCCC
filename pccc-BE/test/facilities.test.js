import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";

const password = "Facility-management-test-2026";
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
  async function request(path, { method = "GET", cookie, body } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  }
  async function login(username) {
    const response = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  }
  return { db, request, login };
}

const facilityInput = {
  name: "Cơ sở kiểm thử",
  address: "Địa chỉ kiểm thử, Khu phố 01",
  regionId: "KP01",
  officerId: "CB-A03",
};

test("facility create validates fields, scope and duplicates, then writes an audit record", async (t) => {
  const { db, request, login } = await fixture(t);
  const officer = await login("demo.can-bo");

  const created = await request("/api/facilities", {
    method: "POST",
    cookie: officer,
    body: facilityInput,
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.facility.name, facilityInput.name);
  assert.equal(created.data.facility.region_id, "KP01");
  assert.equal(created.data.facility.officer_id, "CB-A03");
  assert.equal(created.data.facility.status, "active");
  assert.equal(
    (
      await db
        .prepare("SELECT action FROM audit_logs WHERE object_id=?")
        .get(created.data.facility.id)
    ).action,
    "facility.created",
  );

  assert.equal(
    (
      await request("/api/facilities", {
        method: "POST",
        cookie: officer,
        body: { ...facilityInput, name: "  " },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/facilities", {
        method: "POST",
        cookie: officer,
        body: { ...facilityInput, regionId: "KP02" },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request("/api/facilities", {
        method: "POST",
        cookie: officer,
        body: {
          ...facilityInput,
          name: "Cơ Sở CS001 (Dữ Liệu Mẫu)",
          address: "ĐỊA CHỈ GIẢ LẬP",
        },
      })
    ).status,
    409,
  );
});

test("facility update rejects a duplicate name and address pair", async (t) => {
  const { request, login } = await fixture(t);
  const officer = await login("demo.can-bo");
  const response = await request("/api/facilities/CS001", {
    method: "PUT",
    cookie: officer,
    body: { name: "Cơ sở CS003 (dữ liệu mẫu)", address: "Địa chỉ giả lập" },
  });
  assert.equal(response.status, 409);
  assert.equal(response.data.error.code, "DUPLICATE_FACILITY");
});

test("facility listing filters within scope before pagination and options stay scoped", async (t) => {
  const { request, login } = await fixture(t);
  const officer = await login("demo.can-bo");
  const filtered = await request("/api/facilities?regionId=KP01&status=active", {
    cookie: officer,
  });
  assert.equal(filtered.status, 200);
  assert.equal(filtered.data.total, 1);
  assert.equal(filtered.data.items[0].region_name, "Khu phố 01 (mẫu)");
  assert.equal((await request("/api/facilities?regionId=KP02", { cookie: officer })).data.total, 0);
  assert.equal(
    (await request("/api/facilities?officerId=CB-OTHER", { cookie: officer })).data.total,
    0,
  );
  assert.equal((await request("/api/facilities?officerId=", { cookie: officer })).data.total, 1);
  assert.equal((await request("/api/facilities?status=invalid", { cookie: officer })).status, 400);
  const options = await request("/api/facilities/options", { cookie: officer });
  assert.deepEqual(
    options.data.regions.map((region) => region.id),
    ["KP01"],
  );
  assert(options.data.officers.some((item) => item.id === "CB-A03"));
});

test("facility mutations require authentication and the create grant", async (t) => {
  const { request, login } = await fixture(t);
  assert.equal((await request("/api/facilities/options")).status, 401);
  assert.equal(
    (await request("/api/facilities", { method: "POST", body: facilityInput })).status,
    401,
  );
  const viewer = await login("demo.nguoi-xem");
  assert.equal(
    (await request("/api/facilities", { method: "POST", cookie: viewer, body: facilityInput }))
      .status,
    403,
  );
});
