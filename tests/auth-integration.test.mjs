import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { openDatabase } from "../pccc-BE/src/core/database.js";
import { seedDemo } from "../pccc-BE/src/core/seed.js";
import { createApp } from "../pccc-BE/src/app.js";

const frontendDirectory = fileURLToPath(new URL("../pccc-FE/", import.meta.url));
const frontendRequire = createRequire(new URL("../pccc-FE/package.json", import.meta.url));
const nextBinary = frontendRequire.resolve("next/dist/bin/next");

test(
  "Next frontend proxy + separate backend: login, first-password change, role navigation, scope and logout",
  { timeout: 60000 },
  async (t) => {
    const db = openDatabase(":memory:");
    const password = "Integration-only-password";
    await seedDemo(db, password);
    const frontendPort = Number(process.env.PCCC_TEST_FRONTEND_PORT || 3100);
    const backendPort = Number(process.env.PCCC_TEST_BACKEND_PORT || 4000);
    const backendOrigin = `http://127.0.0.1:${backendPort}`;
    const origin = `http://127.0.0.1:${frontendPort}`;
    const backend = createApp(db, { appOrigin: origin });
    backend.listen(backendPort, "127.0.0.1");
    await once(backend, "listening");
    let logs = "";
    const frontend = spawn(
      process.execPath,
      [nextBinary, "start", "--hostname", "127.0.0.1", "--port", String(frontendPort)],
      {
        cwd: frontendDirectory,
        env: { ...process.env, BACKEND_URL: backendOrigin },
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
    const manifestResponse = await request("/manifest.webmanifest");
    assert.equal(manifestResponse.status, 200);
    const manifest = await manifestResponse.json();
    assert.equal(manifest.display, "standalone");
    assert.ok(manifest.icons.some((icon) => icon.src === "/icon.svg"));
    const iconResponse = await request("/icon.svg");
    assert.equal(iconResponse.status, 200);
    assert.match(iconResponse.headers.get("content-type"), /image\/svg\+xml/);
    assert.match(await iconResponse.text(), /<svg/);
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
    assert.match(dashboardHtml, /Cơ sở theo cán bộ phụ trách/);
    assert.match(dashboardHtml, /CB-A03/);
    assert.doesNotMatch(dashboardHtml, /CB-OTHER/);
    const search = await (await request("/api/search?q=mau", { cookie })).json();
    assert.deepEqual(
      search.groups.facilities.items.map((item) => item.id),
      ["CS001"],
    );
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
    assert.equal((await request("/van-ban", { cookie })).status, 200);
    assert.equal((await request("/van-ban/DEMO-DOC-1", { cookie })).status, 200);
    assert.ok(
      (await request("/van-ban/them", { cookie })).headers
        .get("location")
        .endsWith("/khong-co-quyen"),
    );
    assert.ok(
      (await request("/quan-tri/nhat-ky", { cookie })).headers
        .get("location")
        .endsWith("/khong-co-quyen"),
    );
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
    const reportExportPage = await request("/bao-cao/ket-xuat", { cookie: adminCookie });
    assert.equal(reportExportPage.status, 200);
    assert.match(await reportExportPage.text(), /Cấu hình kết xuất/);
    const m11ExportPage = await request("/tien-ich/export", { cookie: adminCookie });
    assert.equal(m11ExportPage.status, 200);
    assert.match(await m11ExportPage.text(), /Kết xuất dữ liệu nghiệp vụ/);
    const reportTypes = await (
      await request("/api/report-export/types", { cookie: adminCookie })
    ).json();
    assert.deepEqual(
      reportTypes.items.map((item) => item.code),
      ["R01", "R03", "R05", "R06"],
    );
    const documentBody = {
      category_id: "law",
      title: "Văn bản tích hợp (mẫu)",
      reference_number: "INTEGRATION-DOC",
      issuing_authority: "Cơ quan mẫu",
      effective_date: "2026-01-01",
      status: "effective",
      source_url: "https://example.org/",
      file: {
        name: "integration.pdf",
        contentBase64: Buffer.from("%PDF-1.4\n%%EOF\n").toString("base64"),
      },
    };
    const created = await request("/api/legal-documents", {
      method: "POST",
      cookie: adminCookie,
      body: documentBody,
    });
    assert.equal(created.status, 201);
    const document = (await created.json()).document;
    const downloaded = await request(`/api/legal-documents/${document.id}/file`, {
      cookie: adminCookie,
    });
    assert.equal(downloaded.status, 200);
    assert.match(downloaded.headers.get("content-disposition"), /^attachment;/);
    assert.equal(await downloaded.text(), "%PDF-1.4\n%%EOF\n");
    for (const route of [
      "/van-ban/them",
      `/van-ban/${document.id}/sua`,
      `/van-ban/${document.id}`,
      "/quan-tri/nhat-ky",
    ])
      assert.equal((await request(route, { cookie: adminCookie })).status, 200, route);
    const changed = await request(`/api/legal-documents/${document.id}`, {
      method: "PUT",
      cookie: adminCookie,
      body: { ...documentBody, status: "expired", version: 1 },
    });
    assert.equal(changed.status, 200);
    const history = await (
      await request(`/api/legal-documents/${document.id}/history`, { cookie: adminCookie })
    ).json();
    assert.equal(history.total, 2);
    const audit = await (
      await request(`/api/audit-logs?feature=M05&objectId=${document.id}`, { cookie: adminCookie })
    ).json();
    assert.equal(audit.total, 2);
    const commanderLogin = await request("/api/auth/login", {
      method: "POST",
      body: { username: "demo.chi-huy", password },
    });
    const commanderCookie = commanderLogin.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (await request("/api/auth/skip-password-change", { method: "POST", cookie: commanderCookie }))
        .status,
      200,
    );
    const commanderList = await request("/van-ban", { cookie: commanderCookie });
    assert.equal(commanderList.status, 200);
    assert.match(await commanderList.text(), /Thêm văn bản/);
    assert.equal((await request("/van-ban/them", { cookie: commanderCookie })).status, 200);
    const commanderCreated = await request("/api/legal-documents", {
      method: "POST",
      cookie: commanderCookie,
      body: { ...documentBody, reference_number: "INTEGRATION-COMMANDER" },
    });
    assert.equal(commanderCreated.status, 201);
    const commanderDocument = (await commanderCreated.json()).document;
    const commanderDetail = await request(`/van-ban/${commanderDocument.id}`, {
      cookie: commanderCookie,
    });
    assert.equal(commanderDetail.status, 200);
    assert.match(await commanderDetail.text(), /Sửa văn bản/);
    assert.equal(
      (await request(`/van-ban/${commanderDocument.id}/sua`, { cookie: commanderCookie })).status,
      200,
    );
    assert.equal(
      (
        await request(`/api/legal-documents/${commanderDocument.id}`, {
          method: "PUT",
          cookie: commanderCookie,
          body: {
            ...documentBody,
            reference_number: "INTEGRATION-COMMANDER",
            version: 1,
            status: "expired",
          },
        })
      ).status,
      200,
    );
    const commanderAssignPage = await request("/to-chuc/phan-cong", { cookie: commanderCookie });
    assert.equal(commanderAssignPage.status, 200);
    assert.match(await commanderAssignPage.text(), /Phân công/);
    const viewerLogin = await request("/api/auth/login", {
      method: "POST",
      body: { username: "demo.tong-hop", password },
    });
    const viewerCookie = viewerLogin.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (await request("/api/auth/skip-password-change", { method: "POST", cookie: viewerCookie }))
        .status,
      200,
    );
    assert.ok(
      (await request("/to-chuc/phan-cong", { cookie: viewerCookie })).headers
        .get("location")
        .endsWith("/khong-co-quyen"),
    );
    const accountPage = await request("/quan-tri/tai-khoan", { cookie: adminCookie });
    assert.equal(accountPage.status, 200);
    assert.match(await accountPage.text(), /Quản lý tài khoản người dùng/);
    const transferPage = await request("/to-chuc/phan-cong", { cookie: adminCookie });
    assert.equal(transferPage.status, 200);
    assert.match(await transferPage.text(), /Phân công và chuyển giao địa bàn/);
    const transferResult = await request("/api/account-transfers", {
      method: "POST",
      cookie: adminCookie,
      body: {
        sourceAccountId: "DEMO-A03",
        targetAccountId: "DEMO-A04",
        regionIds: ["KP01"],
        facilityIds: ["CS001"],
        reason: "Kiểm thử tích hợp (dữ liệu mẫu)",
      },
    });
    assert.equal(transferResult.status, 201);
    const transferHistory = await (
      await request("/api/account-transfers", { cookie: adminCookie })
    ).json();
    assert.equal(transferHistory.total, 1);
    assert.equal(transferHistory.items[0].items.length, 2);
  },
);
