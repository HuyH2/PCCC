import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

import { openDatabase, transaction } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";

const password = "Report-export-test-2026";
const origin = "http://localhost:3000";

async function fixture(t) {
  const db = await openDatabase(":memory:");
  await seedDemo(db, password);
  await db.exec("UPDATE accounts SET must_change_password=0");
  const server = createApp(db);
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
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  async function binary(path, { cookie } = {}) {
    const response = await fetch(base + path, {
      headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
    });
    return {
      status: response.status,
      headers: response.headers,
      buffer: Buffer.from(await response.arrayBuffer()),
    };
  }
  async function login(username) {
    const response = await request("/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    assert.equal(response.status, 200);
    return response.cookie;
  }
  return { db, request, binary, login };
}

test("migration adds report tables and M08 report grants", async (t) => {
  const { db } = await fixture(t);
  const tables = (
    await db
      .prepare(
        "SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public'",
      )
      .all()
  ).map((row) => row.name);
  for (const table of [
    "report_export_types",
    "report_templates",
    "report_export_requests",
    "report_export_submissions",
    "report_export_history",
  ])
    assert.ok(tables.includes(table), `missing ${table}`);
  assert.equal(
    (await db.prepare("SELECT count(*) AS n FROM report_export_types WHERE is_active=1").get()).n,
    4,
  );
  assert.ok(
    await db
      .prepare(
        "SELECT 1 FROM role_permissions WHERE role_code='A06' AND permission_code='M08.view'",
      )
      .get(),
  );
  for (const permission of ["M08.export", "M08.create"])
    assert.equal(
      await db
        .prepare("SELECT 1 FROM role_permissions WHERE role_code='A06' AND permission_code=?")
        .get(permission),
      undefined,
    );
  for (const role of ["A01", "A04", "A05"])
    assert.ok(
      await db
        .prepare(
          "SELECT 1 FROM role_permissions WHERE role_code=? AND permission_code='M08.export'",
        )
        .get(role),
    );
});

test("types, options and previews enforce filters and data scope", async (t) => {
  const { request, login } = await fixture(t);
  const commander = await login("demo.chi-huy");
  const viewer = await login("demo.nguoi-xem");
  const officer = await login("demo.can-bo");

  const types = await request("/api/report-export/types", { cookie: commander });
  assert.equal(types.status, 200);
  assert.deepEqual(
    types.data.items.map((item) => item.code),
    ["R01", "R03", "R05", "R06"],
  );
  assert.equal(types.data.items.find((item) => item.code === "R01").supports_period, false);
  assert.equal(types.data.items.find((item) => item.code === "R06").scope_kind, "account");

  const options = await request("/api/report-export/options", { cookie: commander });
  assert.equal(options.status, 200);
  assert.deepEqual(
    options.data.regions.map((region) => region.id),
    ["KP01", "KP02"],
  );
  assert.equal(options.data.maxRows, 5000);
  assert.ok(options.data.facility_officers.some((person) => person.id === "CB-A03"));

  const facilities = await request("/api/report-export/preview?type=R01", { cookie: commander });
  assert.equal(facilities.status, 200);
  assert.equal(facilities.data.total, 2);
  assert.deepEqual(
    facilities.data.rows.map((row) => row.id),
    ["CS001", "CS002"],
  );
  assert.equal(facilities.data.summary.find((item) => item.label === "Đình chỉ").value, 1);

  const byRegion = await request("/api/report-export/preview?type=R01&regionId=KP01", {
    cookie: commander,
  });
  assert.equal(byRegion.status, 200);
  assert.equal(byRegion.data.total, 1);
  assert.equal(byRegion.data.rows[0].id, "CS001");
  assert.equal(
    (await request("/api/report-export/preview?type=R01&regionId=KP03", { cookie: commander }))
      .status,
    403,
  );
  assert.equal(
    (await request("/api/report-export/preview?type=R01&from=2026-10-01", { cookie: commander }))
      .status,
    400,
  );

  const violations = await request("/api/report-export/preview?type=R03", {
    cookie: commander,
  });
  assert.equal(violations.status, 200);
  assert.ok(violations.data.total >= 1);
  assert.ok(violations.data.columns.some((column) => column.key === "description"));

  const inspections = await request(
    "/api/report-export/preview?type=R05&from=2026-10-01&to=2026-10-31",
    {
      cookie: commander,
    },
  );
  assert.equal(inspections.status, 200);
  assert.equal(inspections.data.total, 2);
  assert.ok(
    inspections.data.rows.every((row) => row.facility_name !== "Cơ sở CS003 (dữ liệu mẫu)"),
  );

  const tasks = await request("/api/report-export/preview?type=R06&from=2026-10-01&to=2026-10-31", {
    cookie: commander,
  });
  assert.equal(tasks.status, 200);
  assert.ok(tasks.data.total >= 1);
  assert.ok(tasks.data.columns.some((column) => column.key === "completion_rate"));
  assert.ok(tasks.data.rows.every((row) => row.full_name));

  const allFacilities = await request("/api/report-export/preview?type=R01", { cookie: viewer });
  assert.equal(allFacilities.status, 200);
  assert.equal(allFacilities.data.total, 3);
  const regionFacilities = await request("/api/report-export/preview?type=R01", {
    cookie: officer,
  });
  assert.equal(regionFacilities.status, 200);
  assert.equal(regionFacilities.data.total, 1);
  assert.ok(regionFacilities.data.rows.every((row) => row.region_name.includes("01")));
  assert.equal(
    (await request("/api/report-export/preview?type=R01&regionId=KP02", { cookie: officer }))
      .status,
    403,
  );
  assert.equal((await request("/api/report-export/preview?type=R01")).status, 401);
  assert.equal(
    (
      await request("/api/report-export/preview?type=R05&from=2026-13-01&to=2026-12-31", {
        cookie: commander,
      })
    ).status,
    400,
  );
});

test("exports XLSX/PDF, stores history and protects download", async (t) => {
  const { db, request, binary, login } = await fixture(t);
  const commander = await login("demo.chi-huy");
  const admin = await login("demo.admin");
  const other = await login("demo.tong-hop");
  const viewer = await login("demo.nguoi-xem");

  assert.equal(
    (
      await request("/api/report-export/exports", {
        method: "POST",
        cookie: viewer,
        body: { reportTypeId: "R01", format: "xlsx" },
      })
    ).status,
    403,
  );

  const xlsx = await request("/api/report-export/exports", {
    method: "POST",
    cookie: commander,
    body: { reportTypeId: "R01", format: "xlsx" },
  });
  assert.equal(xlsx.status, 201);
  assert.equal(xlsx.data.item.status, "completed");
  assert.equal(xlsx.data.item.row_count, 2);
  assert.match(xlsx.data.item.file_name, /^BC-R01-\d{8}-[A-F0-9]+\.xlsx$/);
  assert.ok(xlsx.data.item.download_url);

  const xlsxFile = await binary(xlsx.data.item.download_url, { cookie: commander });
  assert.equal(xlsxFile.status, 200);
  assert.match(xlsxFile.headers.get("content-type"), /spreadsheetml/);
  assert.equal(xlsxFile.buffer.subarray(0, 2).toString(), "PK");
  assert.ok(xlsxFile.buffer.length > 2000);
  assert.equal((await binary(xlsx.data.item.download_url)).status, 401);
  assert.equal((await binary(xlsx.data.item.download_url, { cookie: other })).status, 403);
  assert.equal((await binary(xlsx.data.item.download_url, { cookie: admin })).status, 200);

  const pdf = await request("/api/report-export/exports", {
    method: "POST",
    cookie: commander,
    body: { reportTypeId: "R05", from: "2026-10-01", to: "2026-10-31", format: "pdf" },
  });
  assert.equal(pdf.status, 201);
  assert.equal(pdf.data.item.row_count, 2);
  const pdfFile = await binary(pdf.data.item.download_url, { cookie: commander });
  assert.equal(pdfFile.status, 200);
  assert.equal(pdfFile.headers.get("content-type"), "application/pdf");
  assert.equal(pdfFile.buffer.subarray(0, 8).toString(), "%PDF-1.7");
  assert.ok(pdfFile.buffer.length > 100_000);
  assert.ok(await db.prepare("SELECT 1 FROM report_export_submissions WHERE file_size > 0").get());
  assert.ok(
    await db
      .prepare("SELECT 1 FROM audit_logs WHERE action='report.exported' AND feature='M08'")
      .get(),
  );

  const empty = await request("/api/report-export/exports", {
    method: "POST",
    cookie: commander,
    body: { reportTypeId: "R05", from: "2026-01-01", to: "2026-01-02", format: "xlsx" },
  });
  assert.equal(empty.status, 409);
  assert.equal(empty.data.error.code, "EMPTY_REPORT");

  const history = await request("/api/report-export/exports", { cookie: commander });
  assert.equal(history.status, 200);
  assert.equal(history.data.total, 2);
  assert.ok(history.data.items.every((item) => item.status === "completed"));
  assert.ok(history.data.items.every((item) => item.download_url));
  assert.equal((await request("/api/report-export/exports", { cookie: admin })).data.total, 2);
  assert.equal((await request("/api/report-export/exports", { cookie: other })).data.total, 0);
});

test("templates override labels/title and are validated", async (t) => {
  const { request, login } = await fixture(t);
  const commander = await login("demo.chi-huy");
  const viewer = await login("demo.nguoi-xem");

  const created = await request("/api/report-export/templates", {
    method: "POST",
    cookie: commander,
    body: {
      reportTypeId: "R01",
      name: "Mẫu thử cơ sở",
      format: "xlsx",
      title: "Báo cáo cơ sở thử nghiệm",
      headerNote: "Dữ liệu phục vụ kiểm thử.",
      columnLabels: { name: "Tên cơ sở (mẫu)" },
      isOfficial: false,
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.item.report_type_code, "R01");
  assert.equal(created.data.item.column_labels.name, "Tên cơ sở (mẫu)");
  assert.equal((await request("/api/report-export/templates", { cookie: viewer })).status, 200);
  assert.equal(
    (
      await request("/api/report-export/templates", {
        method: "POST",
        cookie: viewer,
        body: created.data.item,
      })
    ).status,
    403,
  );

  const templateId = created.data.item.id;
  const preview = await request(`/api/report-export/preview?type=R01&templateId=${templateId}`, {
    cookie: commander,
  });
  assert.equal(preview.status, 200);
  assert.equal(
    preview.data.columns.find((column) => column.key === "name").label,
    "Tên cơ sở (mẫu)",
  );
  const exported = await request("/api/report-export/exports", {
    method: "POST",
    cookie: commander,
    body: { reportTypeId: "R01", format: "xlsx", templateId },
  });
  assert.equal(exported.status, 201);
  assert.equal(exported.data.item.template_name, "Mẫu thử cơ sở");
  assert.equal(
    (
      await request("/api/report-export/exports", {
        method: "POST",
        cookie: commander,
        body: { reportTypeId: "R01", format: "pdf", templateId },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/api/report-export/templates", {
        method: "POST",
        cookie: commander,
        body: { reportTypeId: "R01", name: "Sai cột", format: "xlsx", columnLabels: { nope: "x" } },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/report-export/exports", {
        method: "POST",
        cookie: commander,
        body: { reportTypeId: "R01", format: "xlsx", notAField: true },
      })
    ).status,
    400,
  );
});

test("date range and row caps reject oversized exports before writing history", async (t) => {
  const { db, request, login } = await fixture(t);
  const commander = await login("demo.chi-huy");

  assert.equal(
    (
      await request("/api/report-export/preview?type=R05&from=2020-01-01&to=2026-10-21", {
        cookie: commander,
      })
    ).status,
    400,
  );

  const insert = db.prepare(
    "INSERT INTO facilities(id,name,address,region_id,officer_id,status) VALUES (?,?,?,?,?,'active')",
  );
  const load = async () =>
    await transaction(db, async () => {
      for (let index = 0; index <= 5000; index++)
        await insert.run(
          `CS-BULK-${index}`,
          `Cơ sở bulk ${index}`,
          "Địa chỉ bulk",
          "KP01",
          "CB-A03",
        );
    });
  await load();

  assert.equal(
    (await request("/api/report-export/preview?type=R01", { cookie: commander })).status,
    413,
  );
  assert.equal(
    (
      await request("/api/report-export/exports", {
        method: "POST",
        cookie: commander,
        body: { reportTypeId: "R01", format: "xlsx" },
      })
    ).status,
    413,
  );
  assert.equal((await db.prepare("SELECT count(*) AS n FROM report_export_history").get()).n, 0);
});
