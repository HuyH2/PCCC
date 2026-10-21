import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";

const password = "Temporary-mobile-test-password-2026";
const appOrigin = "https://pccc.example.test";

test("mobile same-origin login keeps a secure session and APIs enforce scope", async (t) => {
  const db = openDatabase(":memory:");
  await seedDemo(db, password);
  db.exec("UPDATE accounts SET must_change_password=0");
  const server = createApp(db, { appOrigin, secureCookie: true });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const unauthenticated = await fetch(`${base}/api/facilities`);
  assert.equal(unauthenticated.status, 401);

  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { Origin: appOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({ username: "demo.can-bo", password }),
  });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Secure/i);

  const facilityResponse = await fetch(`${base}/api/facilities`, {
    headers: { Origin: appOrigin, Cookie: setCookie.split(";")[0] },
  });
  assert.equal(facilityResponse.status, 200);
  const facilities = await facilityResponse.json();
  assert.equal(facilities.total, 1);
  assert.equal(facilities.items[0].id, "CS001");

  const crossOriginMutation = await fetch(`${base}/api/auth/logout`, {
    method: "POST",
    headers: { Origin: "https://attacker.example.test", Cookie: setCookie.split(";")[0] },
  });
  assert.equal(crossOriginMutation.status, 403);
});
