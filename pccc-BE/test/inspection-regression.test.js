import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";

const password = "Inspection-regression-2026";
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
  async function request(path, { method = "GET", body, cookie } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = response.headers.get("content-type")?.includes("application/json");
    return {
      status: response.status,
      data: json ? await response.json() : null,
      headers: response.headers,
    };
  }
  async function login(username) {
    const response = await request("/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  }
  return { db, request, login };
}

const planBody = (code) => ({
  code,
  year: 2027,
  title: "Kế hoạch hồi quy",
  unit_id: "DV-KV10",
  annual_target: 12,
});

test("BUG-015: commander publishes plan, allocates targets and reschedules; summary officer creates notice", async (t) => {
  const { request, login } = await fixture(t);
  const commander = await login("demo.chi-huy");
  const officer = await login("demo.can-bo");
  const summary = await login("demo.tong-hop");
  const created = await request("/api/inspection-plans", {
    method: "POST",
    cookie: commander,
    body: planBody("KHKT-REG-A01"),
  });
  assert.equal(created.status, 201);
  const planId = created.data.plan.id;
  const published = await request(`/api/inspection-plans/${planId}`, {
    method: "PUT",
    cookie: commander,
    body: { version: 1, status: "published" },
  });
  assert.equal(published.status, 200);
  const target = await request(`/api/inspection-plans/${planId}/targets`, {
    method: "POST",
    cookie: commander,
    body: { period_type: "month", month: 3, target_count: 4 },
  });
  assert.equal(target.status, 201);
  const inspection = await request(`/api/inspection-plans/${planId}/inspections`, {
    method: "POST",
    cookie: officer,
    body: { facility_id: "CS001", lead_officer_id: "CB-A03", scheduled_date: "2027-03-08" },
  });
  assert.equal(inspection.status, 201);
  const { id, schedule_version: version } = inspection.data.inspection;
  const moved = await request(`/api/inspections/${id}/reschedules`, {
    method: "POST",
    cookie: commander,
    body: { version, new_date: "2027-03-12", reason: "Chỉ huy điều chỉnh lịch" },
  });
  assert.equal(moved.status, 201);
  const notice = await request(`/api/inspections/${id}/notice`, {
    method: "POST",
    cookie: summary,
    body: { recipient_name: "Đại diện cơ sở", inspection_date: "2027-03-12", status: "draft" },
  });
  assert.equal(notice.status, 200);
});

test("BUG-015: only the assigned lead officer (or deputy A02) may execute an inspection", async (t) => {
  const { request, login } = await fixture(t);
  const officer = await login("demo.can-bo");
  const deputy = await login("demo.to-truong");
  const commander = await login("demo.chi-huy");
  const created = await request("/api/inspections", {
    method: "POST",
    cookie: officer,
    body: {
      facility_id: "CS001",
      kind: "unscheduled",
      reason: "Phản ánh",
      scheduled_date: "2026-12-05",
      lead_officer_id: "CB-A01",
      checklist_id: "CL-CHUNG",
    },
  });
  assert.equal(created.status, 201);
  const id = created.data.inspection.id;
  const item = { item_id: "CL-CHUNG-1", status: "pass" };
  const results = (cookie, version) =>
    request(`/api/inspections/${id}/results`, {
      method: "PUT",
      cookie,
      body: { version, items: [item] },
    });
  // A03 holds M06.edit and scope but is not the lead officer.
  assert.equal((await results(officer, 1)).status, 403);
  assert.equal(
    (
      await request(`/api/inspections/${id}/conclusion`, {
        method: "PUT",
        cookie: officer,
        body: { version: 1, outcome: "pass", conclusion: "x" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/api/inspections/${id}/complete`, {
        method: "POST",
        cookie: officer,
        body: { version: 1 },
      })
    ).status,
    403,
  );
  // The assigned lead (A01, CB-A01) and the supervising deputy (A02) can proceed.
  const byLead = await results(commander, 1);
  assert.equal(byLead.status, 200);
  assert.equal((await results(deputy, byLead.data.inspection.version)).status, 200);
});

test("BUG-016/017: unscheduled inspections join the calendar and codes stay sequential", async (t) => {
  const { request, login } = await fixture(t);
  const deputy = await login("demo.to-truong");
  const officer = await login("demo.can-bo");
  const plan = await request("/api/inspection-plans", {
    method: "POST",
    cookie: deputy,
    body: planBody("KHKT-REG-CODE"),
  });
  const planId = plan.data.plan.id;
  await request(`/api/inspection-plans/${planId}`, {
    method: "PUT",
    cookie: deputy,
    body: { version: 1, status: "published" },
  });
  const periodic = [];
  for (const day of ["2027-04-01", "2027-04-02", "2027-04-03"]) {
    const response = await request(`/api/inspection-plans/${planId}/inspections`, {
      method: "POST",
      cookie: officer,
      body: { facility_id: "CS001", lead_officer_id: "CB-A03", scheduled_date: day },
    });
    assert.equal(response.status, 201);
    periodic.push(response.data.inspection.code);
  }
  assert.deepEqual(periodic, ["KT-2027-0001", "KT-2027-0002", "KT-2027-0003"]);

  const year = new Date().getFullYear();
  const unscheduled = [];
  for (const day of ["01", "02"]) {
    const response = await request("/api/inspections", {
      method: "POST",
      cookie: officer,
      body: {
        facility_id: "CS001",
        kind: "unscheduled",
        reason: "Hồi quy",
        scheduled_date: `${year}-12-${day}`,
      },
    });
    assert.equal(response.status, 201);
    unscheduled.push(response.data.inspection.code);
  }
  assert.deepEqual(unscheduled, [`KT-${year}-0001`, `KT-${year}-0002`]);

  const schedules = await request(
    `/api/inspection-schedules?kind=unscheduled&from=${year}-12-01&to=${year}-12-31`,
    { cookie: officer },
  );
  assert.equal(schedules.status, 200);
  assert.equal(schedules.data.total, 2);
});

test("BUG-016: rejects overlapping schedules for the same facility or lead officer", async (t) => {
  const { request, login } = await fixture(t);
  const deputy = await login("demo.to-truong");
  const officer = await login("demo.can-bo");
  const plan = await request("/api/inspection-plans", {
    method: "POST",
    cookie: deputy,
    body: planBody("KHKT-REG-CONFLICT"),
  });
  const planId = plan.data.plan.id;
  await request(`/api/inspection-plans/${planId}`, {
    method: "PUT",
    cookie: deputy,
    body: { version: 1, status: "published" },
  });

  const first = await request(`/api/inspection-plans/${planId}/inspections`, {
    method: "POST",
    cookie: officer,
    body: {
      facility_id: "CS001",
      lead_officer_id: "CB-A03",
      scheduled_date: "2027-05-10",
      start_time: "08:00",
      end_time: "10:00",
    },
  });
  assert.equal(first.status, 201);

  // Overlapping slot at the same facility / officer is rejected (409 SCHEDULE_CONFLICT).
  const overlap = await request(`/api/inspection-plans/${planId}/inspections`, {
    method: "POST",
    cookie: officer,
    body: {
      facility_id: "CS001",
      lead_officer_id: "CB-A03",
      scheduled_date: "2027-05-10",
      start_time: "09:30",
      end_time: "11:00",
    },
  });
  assert.equal(overlap.status, 409);
  assert.equal(overlap.data.error.code, "SCHEDULE_CONFLICT");

  // Unscheduled inspection on the same day/facility (no time = whole day) also conflicts.
  const unscheduledOverlap = await request("/api/inspections", {
    method: "POST",
    cookie: officer,
    body: {
      facility_id: "CS001",
      kind: "unscheduled",
      reason: "Kiểm tra trùng lịch",
      scheduled_date: "2027-05-10",
    },
  });
  assert.equal(unscheduledOverlap.status, 409);
  assert.equal(unscheduledOverlap.data.error.code, "SCHEDULE_CONFLICT");

  // Non-overlapping slot on the same day succeeds, and rescheduling onto the first slot fails.
  const second = await request(`/api/inspection-plans/${planId}/inspections`, {
    method: "POST",
    cookie: officer,
    body: {
      facility_id: "CS001",
      lead_officer_id: "CB-A03",
      scheduled_date: "2027-05-10",
      start_time: "14:00",
      end_time: "16:00",
    },
  });
  assert.equal(second.status, 201);

  const otherDay = await request(`/api/inspection-plans/${planId}/inspections`, {
    method: "POST",
    cookie: officer,
    body: {
      facility_id: "CS001",
      lead_officer_id: "CB-A03",
      scheduled_date: "2027-05-11",
      start_time: "09:00",
      end_time: "11:00",
    },
  });
  assert.equal(otherDay.status, 201);

  const rescheduleClash = await request(
    `/api/inspections/${otherDay.data.inspection.id}/reschedules`,
    {
      method: "POST",
      cookie: officer,
      body: {
        version: otherDay.data.inspection.schedule_version,
        new_date: "2027-05-10",
        start_time: "09:00",
        end_time: "11:00",
        reason: "Dời đè lên khung giờ đã có",
      },
    },
  );
  assert.equal(rescheduleClash.status, 409);
  assert.equal(rescheduleClash.data.error.code, "SCHEDULE_CONFLICT");
});
