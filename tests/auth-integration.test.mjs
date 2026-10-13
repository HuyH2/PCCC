import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { openDatabase } from "../Backend/src/database.js";
import { seedDemo } from "../Backend/src/seed.js";
import { createApp } from "../Backend/src/app.js";

test(
  "Next frontend proxy + backend: auth regression and persisted ORG workflows",
  { timeout: 60000 },
  async (t) => {
    const db = openDatabase(":memory:");
    const password = "Integration-only-password";
    await seedDemo(db, password);
    const backendPort = Number(process.env.TEST_BACKEND_PORT || 4000);
    const frontendPort = Number(process.env.TEST_FRONTEND_PORT || 3100);
    const origin = `http://localhost:${frontendPort}`;
    const backend = createApp(db, { appOrigin: origin });
    backend.listen(backendPort, "127.0.0.1");
    await once(backend, "listening");
    let logs = "";
    const frontend = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(frontendPort),
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, BACKEND_URL: `http://127.0.0.1:${backendPort}` },
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
    const base = `http://127.0.0.1:${frontendPort}`;
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
    for (const path of ["/to-chuc/don-vi", "/to-chuc/can-bo"]) {
      const denied = await request(path, { cookie });
      assert.ok(denied.headers.get("location").endsWith("/dang-nhap"));
      assert.equal((await request(path, { cookie: adminCookie })).status, 200);
    }
    const tree = await request("/api/organization/tree", { cookie: adminCookie });
    assert.equal(tree.status, 200);
    assert.ok((await tree.json()).items.some((node) => node.id === "DV-KV10"));
    const payload = {
      officerCode: "INTEGRATION-ORG",
      fullName: "Cán bộ tích hợp giả lập",
      rank: "Đại úy",
      position: "Cán bộ",
      phone: "0900000001",
      email: "integration-org@example.test",
      unitId: "DV-KV10",
      businessRole: "A03",
      notes: "Ghi chú tùy chọn",
    };
    const created = await request("/api/officers", {
      method: "POST",
      cookie: adminCookie,
      body: payload,
    });
    assert.equal(created.status, 201);
    const officer = (await created.json()).officer;
    assert.equal(
      (await request("/api/officers", { method: "POST", cookie: adminCookie, body: payload }))
        .status,
      409,
    );
    const edited = await request(`/api/officers/${officer.id}`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { notes: "Đã cập nhật qua Next rewrite" },
    });
    assert.equal(edited.status, 200);
    const status = await request(`/api/officers/${officer.id}/status`, {
      method: "PATCH",
      cookie: adminCookie,
      body: {
        status: "TRANSFERRED",
        reason: "Chuyển công tác kiểm thử",
        effectiveDate: "2026-10-13",
      },
    });
    assert.equal(status.status, 200);
    const detail = await (
      await request(`/api/officers/${officer.id}`, { cookie: adminCookie })
    ).json();
    assert.equal(detail.officer.status, "TRANSFERRED");
    assert.equal(detail.officer.notes, "Đã cập nhật qua Next rewrite");
    assert.ok(
      db
        .prepare("SELECT 1 FROM audit_logs WHERE object_id=? AND after_json LIKE '%TRANSFERRED%'")
        .get(officer.id),
    );
    const wardResponse = await request("/api/units", {
      method: "POST",
      cookie: adminCookie,
      body: {
        code: "INTEGRATION-WARD",
        name: "Phường tích hợp",
        level: "WARD",
        parentId: "DV-KV10",
      },
    });
    assert.equal(wardResponse.status, 201);
    const ward = (await wardResponse.json()).unit;
    assert.equal(
      (
        await request(`/api/units/${ward.id}/status`, {
          method: "PATCH",
          cookie: adminCookie,
          body: { status: "INACTIVE" },
        })
      ).status,
      200,
    );
    const noPermissionLogin = await request("/api/auth/login", {
      method: "POST",
      body: { username: "demo.can-bo", password: newPassword },
    });
    const noPermissionCookie = noPermissionLogin.headers.get("set-cookie").split(";")[0];
    assert.ok(
      (await request("/to-chuc/can-bo", { cookie: noPermissionCookie })).headers
        .get("location")
        .endsWith("/khong-co-quyen"),
    );
    assert.equal((await request("/api/officers", { cookie: noPermissionCookie })).status, 403);
  },
);
