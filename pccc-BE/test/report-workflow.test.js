import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

import { businessDate } from "../src/core/time.js";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";

const password = "Report-workflow-test-2026";
const origin = "http://localhost:3000";

async function fixture(t) {
  const db = await openDatabase(":memory:");
  await seedDemo(db, password);
  await db.exec("UPDATE accounts SET must_change_password=0");
  const server = createApp(db, { appOrigin: origin, logger: { error() {} } });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { method = "GET", cookie, body, headers = {}, raw = false } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined || raw ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      headers: response.headers,
      data: contentType.includes("application/json") ? JSON.parse(buffer.toString("utf8")) : null,
      buffer,
      cookie: response.headers.get("set-cookie")?.split(";")[0],
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

  return { db, request, login };
}

test("HTTP report lifecycle covers validation, deadline reminder, scoped file access and audit", async (t) => {
  const { db, request, login } = await fixture(t);
  const requester = await login("demo.admin");
  const assignee = await login("demo.tong-hop");
  const otherAssignee = await login("demo.can-bo");
  const wrongAssignee = await login("demo.chi-huy");
  const viewer = await login("demo.nguoi-xem");
  const dueDate = businessDate();
  const payload = {
    reportTypeId: "BC-TYPE-ADHOC",
    title: "HTTP workflow verification",
    recipient: "PC07",
    assigneeId: "DEMO-A04",
    dueDate,
  };

  assert.equal((await request("/api/reports/types")).status, 401);
  assert.equal(
    (await request("/api/reports/requests", { method: "POST", body: payload })).status,
    401,
  );
  assert.equal(
    (await request("/api/reports/requests", { method: "POST", cookie: viewer, body: payload }))
      .status,
    403,
  );
  for (const invalid of [
    { ...payload, title: "" },
    { ...payload, dueDate: "2026-02-30" },
    { ...payload, dueDate: "2026-2-3" },
  ]) {
    const response = await request("/api/reports/requests", {
      method: "POST",
      cookie: requester,
      body: invalid,
    });
    assert.equal(response.status, 400);
  }

  const created = await request("/api/reports/requests", {
    method: "POST",
    cookie: requester,
    body: payload,
  });
  assert.equal(created.status, 201);
  const id = created.data.request.id;
  assert.equal(created.data.request.status, "open");
  assert.equal(
    (await request(`/api/reports/requests/${id}`, { cookie: otherAssignee })).status,
    404,
  );

  const assignedNotifications = await request("/api/notifications?unread=1", { cookie: assignee });
  const assigned = assignedNotifications.data.items.find((item) => item.object_id === id);
  assert.ok(assigned, "assignee should receive an assignment notification");
  assert.equal(assigned.target_path, `/bao-cao/${id}`);

  const dueSoon = await request("/api/reports/requests?bucket=due_soon", { cookie: assignee });
  assert.ok(dueSoon.data.items.some((item) => item.id === id));
  const beforeReminder = await request("/api/notifications?unread=1", { cookie: assignee });
  const reminders = beforeReminder.data.items.filter(
    (item) => item.object_id === id && ["due_soon", "overdue"].includes(item.kind),
  );
  assert.equal(reminders.length, 1, "deadline should create one reminder");
  const reminder = reminders[0];
  const afterSecondPoll = await request("/api/notifications?unread=1", { cookie: assignee });
  assert.equal(
    afterSecondPoll.data.items.filter(
      (item) => item.object_id === id && ["due_soon", "overdue"].includes(item.kind),
    ).length,
    1,
    "polling the notification endpoint must not duplicate a reminder for the same day",
  );
  assert.equal(
    (await request(`/api/notifications/${reminder.id}/read`, { method: "POST", cookie: requester }))
      .status,
    404,
  );
  assert.equal(
    (await request(`/api/notifications/${reminder.id}/read`, { method: "POST", cookie: assignee }))
      .status,
    200,
  );
  assert.equal(
    (await request("/api/notifications?unread=1", { cookie: assignee })).data.items.some(
      (item) => item.id === reminder.id,
    ),
    false,
  );

  const invalidFile = await request(`/api/reports/requests/${id}/submit`, {
    method: "POST",
    cookie: assignee,
    headers: {
      "Content-Type": "text/plain",
      "X-File-Name": encodeURIComponent("report.pdf"),
      "X-Report-Note": "",
    },
  });
  assert.equal(invalidFile.status, 415);
  const forbiddenSubmit = await request(`/api/reports/requests/${id}/submit`, {
    method: "POST",
    cookie: wrongAssignee,
    headers: {
      "Content-Type": "application/pdf",
      "X-File-Name": encodeURIComponent("report.pdf"),
      "X-Report-Note": "",
    },
    raw: true,
  });
  assert.equal(forbiddenSubmit.status, 403);
  const fakePdf = await request(`/api/reports/requests/${id}/submit`, {
    method: "POST",
    cookie: assignee,
    headers: {
      "Content-Type": "application/pdf",
      "X-File-Name": encodeURIComponent("fake.pdf"),
      "X-Report-Note": "",
    },
    body: Buffer.from("not a PDF"),
    raw: true,
  });
  assert.equal(fakePdf.status, 400);

  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type /Catalog>>endobj\n%%EOF\n");
  const submitted = await request(`/api/reports/requests/${id}/submit`, {
    method: "POST",
    cookie: assignee,
    headers: {
      "Content-Type": "application/pdf",
      "X-File-Name": encodeURIComponent("report.pdf"),
      "X-Report-Note": encodeURIComponent("API test evidence"),
    },
    body: pdf,
    raw: true,
  });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.data.request.status, "submitted");
  const submission = submitted.data.submissions.at(-1);
  assert.ok(submission);
  const downloaded = await request(
    `/api/reports/requests/${id}/submissions/${submission.id}/file`,
    { cookie: requester },
  );
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.headers.get("content-type"), "application/pdf");
  assert.deepEqual(downloaded.buffer, pdf);
  assert.equal(
    (await request(`/api/reports/requests/${id}/submissions/${submission.id}/file`)).status,
    401,
  );
  assert.equal(
    (
      await request(`/api/reports/requests/${id}/submissions/${submission.id}/file`, {
        cookie: otherAssignee,
      })
    ).status,
    404,
  );
  const completed = await request(`/api/reports/requests/${id}/complete`, {
    method: "POST",
    cookie: requester,
  });
  assert.equal(completed.status, 200);
  assert.equal(completed.data.request.status, "completed");
  assert.equal(completed.data.request.deadline_status, "closed");
  assert.equal(
    (
      await db
        .prepare("SELECT count(*) AS n FROM audit_logs WHERE object_id=? AND feature='M08'")
        .get(id)
    ).n,
    3,
  );
  assert.equal(
    (await db.prepare("SELECT count(*) AS n FROM report_submissions WHERE request_id=?").get(id)).n,
    1,
  );
  const finalNotifications = await request("/api/notifications", { cookie: assignee });
  assert.ok(
    finalNotifications.data.items.some(
      (item) => item.object_id === id && item.kind === "completed",
    ),
  );
  assert.equal(
    (await request("/api/reports/requests?bucket=overdue", { cookie: requester })).data.items.some(
      (item) => item.id === id,
    ),
    false,
  );
  assert.equal(
    (await request("/api/reports/requests?bucket=due_soon", { cookie: requester })).data.items.some(
      (item) => item.id === id,
    ),
    false,
  );
});

test("HTTP recurring report schedule creates one period and rejects invalid or duplicate generation", async (t) => {
  const { db, request, login } = await fixture(t);
  const admin = await login("demo.admin");
  const viewer = await login("demo.nguoi-xem");
  const nextDay = new Date(Date.parse(`${businessDate()}T12:00:00+07:00`) + 86400000);
  const firstDueDate = nextDay.toISOString().slice(0, 10);

  assert.equal(
    (await request("/api/reports/schedules", { method: "POST", cookie: viewer, body: {} })).status,
    403,
  );
  const invalid = await request("/api/reports/schedules", {
    method: "POST",
    cookie: admin,
    body: {
      reportTypeId: "BC-TYPE-WEEK",
      assigneeId: "DEMO-A04",
      recipient: "PC07",
      firstDueDate: "2026-02-30",
    },
  });
  assert.equal(invalid.status, 400);

  const created = await request("/api/reports/schedules", {
    method: "POST",
    cookie: admin,
    body: {
      reportTypeId: "BC-TYPE-WEEK",
      assigneeId: "DEMO-A04",
      recipient: "PC07",
      firstDueDate,
    },
  });
  assert.equal(created.status, 201);
  const generated = await request(`/api/reports/schedules/${created.data.id}/generate`, {
    method: "POST",
    cookie: admin,
  });
  assert.equal(generated.status, 200);
  assert.equal(generated.data.dueDate, firstDueDate);
  await db
    .prepare("UPDATE report_schedules SET next_due_date=? WHERE id=?")
    .run(firstDueDate, created.data.id);
  assert.equal(
    (
      await request(`/api/reports/schedules/${created.data.id}/generate`, {
        method: "POST",
        cookie: admin,
      })
    ).status,
    409,
  );
  const list = await request("/api/reports/requests?assigneeId=DEMO-A04", { cookie: admin });
  const generatedRequest = list.data.items.find((item) => item.id === generated.data.requestId);
  assert.ok(generatedRequest);
  assert.equal(generatedRequest.schedule_id, created.data.id);
  assert.equal(generatedRequest.due_date, firstDueDate);
});

test("dashboard API aggregates match canonical facility, officer and region rows", async (t) => {
  const { db, request, login } = await fixture(t);
  const admin = await login("demo.admin");
  await db
    .prepare("DELETE FROM role_permissions WHERE role_code='A06' AND permission_code='M10.view'")
    .run();
  const summary = await request("/api/dashboard", { cookie: admin });
  assert.equal(summary.status, 200);
  const facilityCount = (await db.prepare("SELECT count(*) AS n FROM facilities").get()).n;
  const officerCount = (
    await db
      .prepare(
        "SELECT count(DISTINCT officer_id) AS n FROM facility_overview WHERE officer_id IS NOT NULL",
      )
      .get()
  ).n;
  const regionCount = (await db.prepare("SELECT count(*) AS n FROM regions").get()).n;
  assert.deepEqual(summary.data, { facilityCount, officerCount, regionCount });

  const byRegion = await request("/api/dashboard/facilities-by-region", { cookie: admin });
  assert.equal(byRegion.status, 200);
  assert.equal(byRegion.data.total, regionCount);
  assert.equal(
    byRegion.data.items.reduce((sum, item) => sum + item.facilityCount, 0),
    facilityCount,
  );

  const byOfficer = await request("/api/dashboard/facilities-by-officer", { cookie: admin });
  assert.equal(byOfficer.status, 200);
  assert.equal(byOfficer.data.total, officerCount);
  assert.equal(
    byOfficer.data.items.reduce((sum, item) => sum + item.facilityCount, 0),
    facilityCount,
  );
  assert.equal((await request("/api/dashboard")).status, 401);
  assert.equal(
    (await request("/api/dashboard", { cookie: await login("demo.nguoi-xem") })).status,
    403,
  );
});
