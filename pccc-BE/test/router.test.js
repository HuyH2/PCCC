import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { findRoute } from "../src/core/http.js";
import { createApp } from "../src/app.js";

const password = "Temporary-test-password-2026";
const origin = "http://localhost:3000";

test("findRoute matches method and exact or RegExp paths, first match wins", () => {
  const list = { method: "GET", path: "/api/items" };
  const detail = { method: "GET", path: /^\/api\/items\/([^/]+)$/ };
  const update = { method: "PUT", path: /^\/api\/items\/([^/]+)$/ };
  const routes = [list, detail, update];

  assert.equal(findRoute(routes, "GET", "/api/items").route, list);
  const found = findRoute(routes, "GET", "/api/items/CS%20001");
  assert.equal(found.route, detail);
  assert.equal(found.match[1], "CS%20001");
  assert.equal(findRoute(routes, "PUT", "/api/items/CS001").route, update);
  assert.equal(findRoute(routes, "POST", "/api/items"), null);
  assert.equal(findRoute(routes, "GET", "/api/items/CS001/extra"), null);
  assert.equal(findRoute(routes, "GET", "/api/items/"), null);
});

test("app dispatches public routes without session, protects the rest, 404 only after login", async (t) => {
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
  const get = async (path, cookie) => {
    const response = await fetch(base + path, { headers: cookie ? { Cookie: cookie } : {} });
    return { status: response.status, data: await response.json() };
  };

  assert.deepEqual(await get("/api/health"), { status: 200, data: { status: "ok" } });
  // Unknown paths must not reveal which APIs exist to anonymous callers.
  assert.equal((await get("/api/does-not-exist")).status, 401);
  assert.equal((await get("/api/dashboard")).status, 401);
  // Method mismatch on a public path is treated as an unknown, protected path.
  assert.equal((await get("/api/auth/login")).status, 401);

  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ username: "demo.admin", password }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];

  const missing = await get("/api/does-not-exist", cookie);
  assert.equal(missing.status, 404);
  assert.equal(missing.data.error.code, "NOT_FOUND");
  assert.equal((await get("/api/auth/me", cookie)).data.user.username, "demo.admin");
  assert.equal((await get("/api/facilities/CS001", cookie)).data.facility.id, "CS001");
});
