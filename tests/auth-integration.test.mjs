import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { openDatabase } from "../Backend/src/database.js";
import { seedDemo } from "../Backend/src/seed.js";
import { createApp } from "../Backend/src/app.js";

test(
  "Next frontend proxy + separate backend: login, first-password change, role navigation, scope and logout",
  { timeout: 60000 },
  async (t) => {
    const db = openDatabase(":memory:");
    const password = "Integration-only-password";
    await seedDemo(db, password);
    const origin = "http://localhost:3100";
    const backend = createApp(db, { appOrigin: origin });
    backend.listen(4000, "127.0.0.1");
    await once(backend, "listening");
    let logs = "";
    const frontend = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"],
      {
        cwd: process.cwd(),
        env: { ...process.env, BACKEND_URL: "http://127.0.0.1:4000" },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    frontend.stdout.on("data", (chunk) => {
      logs += chunk;
    });
    frontend.stderr.on("data", (chunk) => {
      logs += chunk;
    });
    t.after(async () => {
      if (frontend.exitCode === null) {
        const ended = once(frontend, "exit");
        frontend.kill();
        await ended;
      }
      await new Promise((resolve) => backend.close(resolve));
      db.close();
    });
    const base = "http://127.0.0.1:3100";
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (frontend.exitCode !== null) throw new Error(logs);
      try {
        if ((await fetch(base + "/dang-nhap")).status === 200) {
          ready = true;
          break;
        }
      } catch {
        /* Server is starting. */
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.ok(ready, logs);
    async function request(path, { cookie, method = "GET", body } = {}) {
      return fetch(base + path, {
        method,
        redirect: "manual",
        headers: {
          Origin: origin,
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    }
    const anonymous = await request("/tong-quan");
    assert.equal(anonymous.status, 307);
    assert.ok(anonymous.headers.get("location").endsWith("/dang-nhap"));
    assert.equal(
      (
        await request("/api/auth/login", {
          method: "POST",
          body: { username: "demo.admin", password: "wrong" },
        })
      ).status,
      401,
    );
    let login = await request("/api/auth/login", {
      method: "POST",
      body: { username: "demo.can-bo", password },
    });
    assert.equal(login.status, 200);
    let cookie = login.headers.get("set-cookie").split(";")[0];
    assert.equal((await login.json()).redirectTo, "/doi-mat-khau");
    assert.ok(
      (await request("/tong-quan", { cookie })).headers.get("location").endsWith("/doi-mat-khau"),
    );
    const firstPasswordPage = await request("/doi-mat-khau", { cookie });
    assert.equal(firstPasswordPage.status, 200);
    assert.match(await firstPasswordPage.text(), /Đổi mật khẩu/);
    const newPassword = "Changed-integration-password";
    assert.equal(
      (
        await request("/api/auth/change-password", {
          method: "POST",
          cookie,
          body: { currentPassword: password, newPassword },
        })
      ).status,
      200,
    );
    login = await request("/api/auth/login", {
      method: "POST",
      body: { username: "demo.can-bo", password: newPassword },
    });
    cookie = login.headers.get("set-cookie").split(";")[0];
    assert.equal((await login.json()).redirectTo, "/");
    const dashboard = await request("/", { cookie });
    assert.equal(dashboard.status, 200);
    const dashboardHtml = await dashboard.text();
    assert.match(dashboardHtml, /Tra cứu toàn hệ thống/);
    assert.match(dashboardHtml, /Vi phạm - Đình chỉ/);
    assert.match(dashboardHtml, /Báo cáo - Deadline/);
    const data = await (await request("/api/facilities", { cookie })).json();
    assert.equal(data.total, 1);
    assert.equal(data.items[0].id, "CS001");
    const facilities = await request("/co-so", { cookie });
    assert.equal(facilities.status, 200);
    assert.match(await facilities.text(), /Cơ sở/);
    assert.ok(
      (await request("/du-lieu/co-so", { cookie })).headers.get("location").endsWith("/co-so"),
    );
    assert.equal((await request("/api/facilities/CS002", { cookie })).status, 404);
    assert.ok(
      (await request("/quan-tri/vai-tro", { cookie })).headers
        .get("location")
        .endsWith("/khong-co-quyen"),
    );
    assert.equal((await request("/tra-cuu", { cookie })).status, 200);
    assert.equal((await request("/api/auth/logout", { method: "POST", cookie })).status, 200);
    assert.equal((await request("/api/auth/me", { cookie })).status, 401);
    assert.ok(
      (await request("/tong-quan", { cookie })).headers.get("location").endsWith("/dang-nhap"),
    );
    const adminLogin = await request("/api/auth/login", {
      method: "POST",
      body: { username: "demo.admin", password },
    });
    const adminCookie = adminLogin.headers.get("set-cookie").split(";")[0];
    assert.equal((await adminLogin.json()).redirectTo, "/doi-mat-khau");
    const skipPage = await request("/doi-mat-khau", { cookie: adminCookie });
    assert.match(await skipPage.text(), /Bỏ qua, đổi sau/);
    const skipped = await request("/api/auth/skip-password-change", {
      method: "POST",
      cookie: adminCookie,
    });
    assert.equal(skipped.status, 200);
    assert.equal((await skipped.json()).redirectTo, "/quan-tri/vai-tro");
    const adminPage = await request("/quan-tri/vai-tro", { cookie: adminCookie });
    assert.equal(adminPage.status, 200);
    assert.match(await adminPage.text(), /Vai trò &amp; phạm vi dữ liệu/);
  },
);
