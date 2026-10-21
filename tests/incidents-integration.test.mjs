import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../pccc-BE/src/core/database.js";
import { seedDemo } from "../pccc-BE/src/core/seed.js";
import { createApp } from "../pccc-BE/src/app.js";

const frontendDirectory = fileURLToPath(new URL("../pccc-FE/", import.meta.url));
const nextBinary = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));

test(
  "Next same-origin rewrite + M09: real SQLite workflow, private uploads, route guards and immediate grants",
  { timeout: 90000 },
  async (t) => {
    const directory = mkdtempSync(join(tmpdir(), "pccc-inc-next-test-"));
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    const databasePath = join(directory, "test.sqlite");
    const uploadDirectory = join(directory, "private-uploads");
    const db = openDatabase(databasePath);
    const password = "Incidents-next-integration-password";
    await seedDemo(db, password);
    // Only the isolated test fixture receives M09 grants. No account gets implicit access.
    for (const permission of ["view", "create", "edit", "approve", "export"])
      db.prepare("INSERT OR IGNORE INTO role_permissions VALUES (?,?)").run(
        "A04",
        `M09.${permission}`,
      );
    for (const permission of ["view", "edit"])
      db.prepare("INSERT OR IGNORE INTO role_permissions VALUES (?,?)").run(
        "A03",
        `M09.${permission}`,
      );
    const backendPort = Number(process.env.TEST_BACKEND_PORT || 4000);
    const frontendPort = Number(process.env.TEST_FRONTEND_PORT || 3100);
    const origin = `http://localhost:${frontendPort}`;
    const backend = createApp(db, { appOrigin: origin, uploadDirectory, logger: { error() {} } });
    let frontend;
    let logs = "";
    t.after(async () => {
      if (frontend?.exitCode === null && frontend.signalCode === null) {
        const ended = once(frontend, "exit");
        frontend.kill();
        await ended;
      }
      if (backend.listening) await new Promise((done) => backend.close(done));
      db.close();
      assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
      rmSync(directory, { recursive: true, force: true });
    });
    backend.listen(backendPort, "127.0.0.1");
    await once(backend, "listening");
    frontend = spawn(
      process.execPath,
      [
        nextBinary,
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(frontendPort),
      ],
      {
        cwd: frontendDirectory,
        env: { ...process.env, BACKEND_URL: `http://127.0.0.1:${backendPort}` },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    frontend.stdout.on("data", (chunk) => {
      logs = (logs + chunk).slice(-12000);
    });
    frontend.stderr.on("data", (chunk) => {
      logs = (logs + chunk).slice(-12000);
    });
    const base = `http://127.0.0.1:${frontendPort}`;
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (frontend.exitCode !== null || frontend.signalCode !== null)
        throw new Error(logs || "Next server stopped during startup.");
      try {
        if (
          (await fetch(base + "/dang-nhap", { signal: AbortSignal.timeout(1000) })).status === 200
        ) {
          ready = true;
          break;
        }
      } catch {
        /* The built frontend is still starting. */
      }
      await new Promise((done) => setTimeout(done, 200));
    }
    assert.ok(ready, logs);
    async function request(path, { cookie, method = "GET", body, form } = {}) {
      return fetch(base + path, {
        method,
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
        headers: {
          Origin: origin,
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
      });
    }
    async function api(path, options = {}, expected = 200) {
      const response = await request(path, options);
      const result = await response.json();
      assert.equal(response.status, expected, JSON.stringify({ path, result }));
      return result;
    }
    async function login(username) {
      const response = await request("/api/auth/login", {
        method: "POST",
        body: { username, password },
      });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.redirectTo, "/doi-mat-khau");
      const cookie = response.headers.get("set-cookie").split(";")[0];
      await api("/api/auth/skip-password-change", { method: "POST", cookie });
      return cookie;
    }
    async function denied(path, cookie, destination = "/khong-co-quyen") {
      const response = await request(path, { cookie });
      assert.equal(response.status, 307, path);
      assert.ok(response.headers.get("location").endsWith(destination), path);
    }
    async function page(path, cookie, pattern) {
      const response = await request(path, { cookie });
      assert.equal(response.status, 200, path);
      assert.match(await response.text(), pattern);
    }
    for (const path of ["/su-co", "/su-co/missing", "/su-co/thong-ke"])
      await denied(path, undefined, "/dang-nhap");
    const cookie = await login("demo.tong-hop");
    const officerCookie = await login("demo.can-bo");
    await page("/su-co", cookie, /Sự cố cháy, nổ và CNCH/);
    await denied("/su-co/thong-ke", officerCookie);
    assert.equal(
      (await request("/api/incidents/statistics", { cookie: officerCookie })).status,
      403,
    );
    const draft = (
      await api(
        "/api/incidents",
        {
          method: "POST",
          cookie,
          body: {
            title: "Sự cố tích hợp mẫu",
            recordStatus: "DRAFT",
            regionId: "KP01",
          },
        },
        201,
      )
    ).incident;
    assert.equal(draft.recordStatus, "DRAFT");
    assert.ok(draft.incidentCode);
    assert.equal(
      db.prepare("SELECT record_status FROM incidents WHERE id=?").get(draft.id).record_status,
      "DRAFT",
    );
    const path = `/api/incidents/${draft.id}`;
    const promoted = (
      await api(path, {
        method: "PATCH",
        cookie,
        body: {
          recordStatus: "OFFICIAL",
          incidentType: "FIRE",
          occurredAt: "2026-02-15T08:30:00+07:00",
          address: "Địa điểm mẫu phục vụ kiểm thử tích hợp",
          description: "Mô tả mẫu",
          facilityId: "CS001",
        },
      })
    ).incident;
    assert.equal(promoted.incidentCode, draft.incidentCode);
    await api(path, {
      method: "PATCH",
      cookie,
      body: {
        incidentType: "EXPLOSION",
        sceneDetails: "Thông tin hiện trường đã được lưu qua Next rewrite",
      },
    });
    const human = (
      await api(
        `${path}/damages`,
        {
          method: "POST",
          cookie,
          body: {
            damageGroup: "HUMAN",
            damageType: "INJURED",
            quantity: 2,
          },
        },
        201,
      )
    ).damage;
    await api(`${path}/damages/${human.id}`, { method: "PATCH", cookie, body: { quantity: 3 } });
    await api(
      `${path}/damages`,
      {
        method: "POST",
        cookie,
        body: {
          damageGroup: "PROPERTY",
          damageType: "LOSS",
          quantity: 1,
          propertyValue: 2000000,
        },
      },
      201,
    );
    const form = new FormData();
    form.set("permitted", "true");
    form.set(
      "file",
      new Blob(["Synthetic proof through the Next proxy."], { type: "text/plain" }),
      "next-proof.txt",
    );
    const doc = (await api(`${path}/documents`, { method: "POST", cookie, form }, 201)).document;
    assert.equal(readdirSync(uploadDirectory).length, 1);
    const downloadPath = `${path}/documents/${doc.id}/download`;
    const download = await request(downloadPath, { cookie });
    assert.equal(download.status, 200);
    assert.equal(await download.text(), "Synthetic proof through the Next proxy.");
    assert.equal((await request(downloadPath)).status, 401);
    const assignments = [];
    for (const [officerId, taskDescription] of [
      ["CB-A03", "Khảo sát mẫu"],
      ["CB-A04", "Tổng hợp mẫu"],
    ]) {
      assignments.push(
        (
          await api(
            `${path}/assignments`,
            {
              method: "POST",
              cookie,
              body: {
                officerId,
                taskDescription,
                deadlineAt: "2026-12-15T10:00:00+07:00",
              },
            },
            201,
          )
        ).assignment,
      );
    }
    await api(`${path}/assignments/${assignments[0].id}`, {
      method: "PATCH",
      cookie: officerCookie,
      body: {
        status: "IN_PROGRESS",
        notes: "Cán bộ xử lý nhiệm vụ của mình",
      },
    });
    await api(`${path}/assignments/${assignments[0].id}`, {
      method: "PATCH",
      cookie: officerCookie,
      body: { status: "COMPLETED" },
    });
    await api(`${path}/assignments/${assignments[1].id}`, {
      method: "PATCH",
      cookie,
      body: { status: "COMPLETED" },
    });
    const overdue = Date.now() - 3600000;
    await api(`${path}/deadline`, { method: "PATCH", cookie, body: { deadlineAt: overdue } });
    let detail = await api(path, { cookie });
    assert.equal(detail.incident.deadlineWarning, "OVERDUE");
    assert.equal(detail.assignments.length, 2);
    const future = Date.now() + 3600000;
    await api(`${path}/deadline`, { method: "PATCH", cookie, body: { deadlineAt: future } }, 400);
    await api(`${path}/deadline`, {
      method: "PATCH",
      cookie,
      body: {
        deadlineAt: future,
        reason: "Gia hạn có lý do trong test tích hợp",
      },
    });
    await api(`${path}/status`, {
      method: "PATCH",
      cookie,
      body: { processingStatus: "IN_PROGRESS" },
    });
    await page(`/su-co/${draft.id}`, cookie, /Chi tiết sự cố/);
    detail = await api(path, { cookie });
    assert.equal(detail.incident.processingStatus, "IN_PROGRESS");
    assert.equal(
      detail.incident.sceneDetails,
      "Thông tin hiện trường đã được lưu qua Next rewrite",
    );
    assert.equal(detail.damages.length, 2);
    assert.equal(detail.documents[0].id, doc.id);
    assert.equal(
      db.prepare("SELECT scene_details FROM incidents WHERE id=?").get(draft.id).scene_details,
      detail.incident.sceneDetails,
    );
    await api(`${path}/complete`, {
      method: "POST",
      cookie,
      body: { reason: "Đã hoàn thành hồ sơ mẫu" },
    });
    detail = await api(path, { cookie });
    assert.equal(detail.incident.processingStatus, "COMPLETED");
    assert.equal(detail.incident.deadlineWarning, "COMPLETED");
    assert.ok(detail.incident.completedAt);
    const history = await api(`${path}/history`, { cookie });
    assert.ok(history.history.some((row) => row.toStatus === "COMPLETED"));
    assert.ok(history.auditLogs.some((row) => row.action === "M09.document.upload"));
    const stats = await api("/api/incidents/statistics?from=2026-02-01&to=2026-02-28", { cookie });
    assert.equal(
      stats.total,
      db.prepare("SELECT count(*) AS n FROM incidents WHERE record_status='OFFICIAL'").get().n,
    );
    assert.equal(stats.total, 1);
    assert.equal(stats.byType.find((row) => row.key === "EXPLOSION").count, 1);
    assert.equal(stats.damages.human.find((row) => row.damageType === "INJURED").quantity, 3);
    assert.equal(
      stats.damages.propertyValue,
      db.prepare("SELECT sum(property_value) AS n FROM incident_damages").get().n,
    );
    assert.equal(stats.processing.completed, 1);
    assert.equal(stats.deadlines.overdue, 0);
    assert.equal(stats.deadlines.dueSoon, 0);
    await page("/su-co/thong-ke", cookie, /Thống kê sự cố/);
    // Re-fetch the rendered routes and records after the complete persisted workflow.
    await page("/su-co", cookie, /Sự cố cháy, nổ và CNCH/);
    await page(`/su-co/${draft.id}`, cookie, /Chi tiết sự cố/);
    assert.equal((await api(path, { cookie })).documents.length, 1);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    const reopened = openDatabase(databasePath);
    try {
      assert.equal(
        reopened.prepare("SELECT processing_status FROM incidents WHERE id=?").get(draft.id)
          .processing_status,
        "COMPLETED",
      );
      assert.equal(
        reopened
          .prepare("SELECT count(*) AS n FROM incident_assignments WHERE incident_id=?")
          .get(draft.id).n,
        2,
      );
    } finally {
      reopened.close();
    }
    db.exec("DELETE FROM role_permissions WHERE role_code='A04' AND permission_code='M09.view'");
    await denied("/su-co", cookie);
    await denied(`/su-co/${draft.id}`, cookie);
    assert.equal((await request(path, { cookie })).status, 403);
    assert.equal((await request(downloadPath, { cookie })).status, 403);
    // Statistics remains independently accessible without record-view permission.
    await page("/su-co/thong-ke", cookie, /Thống kê sự cố/);
    assert.equal((await request("/api/incidents/statistics", { cookie })).status, 200);
    db.exec("DELETE FROM role_permissions WHERE role_code='A04' AND permission_code='M09.export'");
    await denied("/su-co/thong-ke", cookie);
    assert.equal((await request("/api/incidents/statistics", { cookie })).status, 403);
    db.exec("INSERT INTO role_permissions VALUES ('A04','M09.view')");
    await page("/su-co", cookie, /Sự cố cháy, nổ và CNCH/);
    await api("/api/auth/logout", { method: "POST", cookie });
    await denied("/su-co", cookie, "/dang-nhap");
  },
);
