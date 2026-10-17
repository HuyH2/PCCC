import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";

const password = "Planning-test-password-2026";
const origin = "http://localhost:3000";
const pdf = Buffer.from("%PDF-1.4\n%%EOF\n");
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);

async function fixture(t) {
  const db = openDatabase(":memory:");
  await seedDemo(db, password);
  db.exec("UPDATE accounts SET must_change_password=0");
  const server = createApp(db);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
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
    return {
      status: response.status,
      data: response.headers.get("content-type")?.includes("application/json")
        ? await response.json()
        : Buffer.from(await response.arrayBuffer()),
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

async function createPublishedPlan(request, cookie) {
  const created = await request("/api/inspection-plans", {
    method: "POST",
    cookie,
    body: {
      code: "KHKT-2027-KV10",
      year: 2027,
      title: "Kế hoạch kiểm tra PCCC năm 2027",
      facility_group: "Cơ sở thuộc diện quản lý",
      legal_basis: "Căn cứ kiểm thử",
      unit_id: "DV-KV10",
      annual_target: 12,
    },
  });
  assert.equal(created.status, 201);
  const published = await request(`/api/inspection-plans/${created.data.plan.id}`, {
    method: "PUT",
    cookie,
    body: { version: 1, status: "published" },
  });
  assert.equal(published.status, 200);
  return published.data.plan;
}

async function createDraftPlan(request, cookie, code = "KHKT-2027-DRAFT") {
  const created = await request("/api/inspection-plans", {
    method: "POST",
    cookie,
    body: {
      code,
      year: 2027,
      title: "Kế hoạch kiểm tra dự thảo năm 2027",
      facility_group: "Cơ sở thuộc diện quản lý",
      legal_basis: "Căn cứ kiểm thử",
      unit_id: "DV-KV10",
      annual_target: 10,
    },
  });
  assert.equal(created.status, 201);
  return created.data.plan;
}

async function createScheduledInspection(request, cookie, planId, overrides = {}) {
  const created = await request(`/api/inspection-plans/${planId}/inspections`, {
    method: "POST",
    cookie,
    body: {
      facility_id: "CS001",
      lead_officer_id: "CB-A03",
      scheduled_date: "2027-03-08",
      start_time: "19:00",
      end_time: "20:30",
      location: "Tại cơ sở",
      checklist_id: "CL-CHUNG",
      ...overrides,
    },
  });
  return created;
}

test("UC-INS-01/02: create, publish and allocate annual/month/week/officer targets", async (t) => {
  const { db, request, login } = await fixture(t);
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM inspection_plans WHERE id='DEMO-PLAN-2026'").get().n,
    1,
  );
  assert.equal(db.prepare("SELECT count(*) AS n FROM inspection_schedules").get().n, 2);
  const deputy = await login("demo.to-truong");
  const plan = await createPublishedPlan(request, deputy);

  const month = await request(`/api/inspection-plans/${plan.id}/targets`, {
    method: "POST",
    cookie: deputy,
    body: { period_type: "month", month: 3, target_count: 6 },
  });
  assert.equal(month.status, 201);

  const week = await request(`/api/inspection-plans/${plan.id}/targets`, {
    method: "POST",
    cookie: deputy,
    body: { period_type: "week", month: 3, week: 10, target_count: 4 },
  });
  assert.equal(week.status, 201);

  const officer = await request(`/api/inspection-plans/${plan.id}/targets`, {
    method: "POST",
    cookie: deputy,
    body: {
      period_type: "week",
      month: 3,
      week: 10,
      officer_id: "CB-A03",
      target_count: 3,
      parent_id: week.data.target.id,
    },
  });
  assert.equal(officer.status, 201);

  const overflow = await request(`/api/inspection-plans/${plan.id}/targets`, {
    method: "POST",
    cookie: deputy,
    body: { period_type: "month", month: 4, target_count: 7 },
  });
  assert.equal(overflow.status, 409);
  assert.equal(overflow.data.error.code, "TARGET_EXCEEDED");

  const detail = await request(`/api/inspection-plans/${plan.id}`, { cookie: deputy });
  assert.equal(detail.status, 200);
  assert.deepEqual(
    detail.data.targets.map((target) => target.period_type),
    ["year", "month", "week", "week"],
  );
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM audit_logs WHERE feature='M06.planning' AND action<>'inspection_plan.seeded'",
      )
      .get().n,
    5,
  );
});

test("UC-INS-03..05: select scoped facility, create case, notify and keep reschedule history", async (t) => {
  const { request, login } = await fixture(t);
  const deputy = await login("demo.to-truong");
  const plan = await createPublishedPlan(request, deputy);
  const month = await request(`/api/inspection-plans/${plan.id}/targets`, {
    method: "POST",
    cookie: deputy,
    body: { period_type: "month", month: 3, target_count: 6 },
  });
  const week = await request(`/api/inspection-plans/${plan.id}/targets`, {
    method: "POST",
    cookie: deputy,
    body: { period_type: "week", month: 3, week: 10, target_count: 4 },
  });
  const target = await request(`/api/inspection-plans/${plan.id}/targets`, {
    method: "POST",
    cookie: deputy,
    body: {
      period_type: "week",
      month: 3,
      week: 10,
      officer_id: "CB-A03",
      target_count: 3,
      parent_id: week.data.target.id,
    },
  });
  assert.equal(month.status, 201);

  const officer = await login("demo.can-bo");
  const facilities = await request(`/api/inspection-plans/${plan.id}/facilities`, {
    cookie: officer,
  });
  assert.equal(facilities.status, 200);
  assert.deepEqual(
    facilities.data.items.map((item) => item.id),
    ["CS001"],
  );

  const outOfScope = await request(`/api/inspection-plans/${plan.id}/inspections`, {
    method: "POST",
    cookie: officer,
    body: {
      facility_id: "CS002",
      lead_officer_id: "CB-A03",
      scheduled_date: "2027-03-08",
    },
  });
  assert.equal(outOfScope.status, 404);

  const created = await request(`/api/inspection-plans/${plan.id}/inspections`, {
    method: "POST",
    cookie: officer,
    body: {
      facility_id: "CS001",
      target_id: target.data.target.id,
      lead_officer_id: "CB-A03",
      scheduled_date: "2027-03-08",
      start_time: "08:00",
      end_time: "10:00",
      location: "Tại cơ sở",
      checklist_id: "CL-CHUNG",
      team_decision: {
        name: "quyet-dinh.pdf",
        content_type: "application/pdf",
        content_base64: pdf.toString("base64"),
      },
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.inspection.status, "planned");
  const inspection = created.data.inspection;

  const bypassReason = await request(`/api/inspections/${inspection.id}/schedule`, {
    method: "PUT",
    cookie: officer,
    body: {
      version: inspection.schedule_version,
      scheduled_date: "2027-03-09",
      start_time: "08:00",
      end_time: "10:00",
      location: "Tại cơ sở",
    },
  });
  assert.equal(bypassReason.status, 400);
  assert.equal(bypassReason.data.error.code, "RESCHEDULE_REASON_REQUIRED");

  const planProgress = await request(`/api/inspection-plans/${plan.id}`, { cookie: officer });
  const yearProgress = planProgress.data.targets.find((item) => item.period_type === "year");
  const officerProgress = planProgress.data.targets.find(
    (item) => item.id === target.data.target.id,
  );
  assert.equal(yearProgress.actual_count, 1);
  assert.equal(officerProgress.actual_count, 1);

  const notice = await request(`/api/inspections/${inspection.id}/notice`, {
    method: "POST",
    cookie: officer,
    body: {
      notice_number: "TB-01/2027",
      recipient_name: "Người đại diện cơ sở",
      recipient_contact: "Dữ liệu kiểm thử",
      inspection_date: "2027-03-08",
      sent_date: "2027-03-01",
      status: "sent",
      file: {
        name: "thong-bao.pdf",
        content_type: "application/pdf",
        content_base64: pdf.toString("base64"),
      },
    },
  });
  assert.equal(notice.status, 200);
  assert.equal(notice.data.notice.status, "sent");
  const noticeFile = await request(`/api/inspections/${inspection.id}/notice/file`, {
    cookie: officer,
  });
  assert.equal(noticeFile.status, 200);
  assert.deepEqual(noticeFile.data, pdf);

  const missingReason = await request(`/api/inspections/${inspection.id}/reschedules`, {
    method: "POST",
    cookie: officer,
    body: { version: inspection.schedule_version, new_date: "2027-03-12", reason: "" },
  });
  assert.equal(missingReason.status, 400);

  const moved = await request(`/api/inspections/${inspection.id}/reschedules`, {
    method: "POST",
    cookie: officer,
    body: {
      version: inspection.schedule_version,
      new_date: "2027-03-12",
      reason: "Cơ sở đề nghị đổi lịch vì người đại diện đi công tác",
      attachment: {
        name: "de-nghi-doi-lich.png",
        content_type: "image/png",
        content_base64: png.toString("base64"),
      },
    },
  });
  assert.equal(moved.status, 201);
  assert.equal(moved.data.reschedule.old_date, "2027-03-08");
  assert.equal(moved.data.reschedule.new_date, "2027-03-12");

  const detail = await request(`/api/inspections/${inspection.id}/planning`, {
    cookie: officer,
  });
  assert.equal(detail.data.inspection.scheduled_date, "2027-03-12");
  assert.equal(detail.data.notice.status, "draft");
  assert.equal(detail.data.notice.sent_date, null);
  assert.equal(detail.data.reschedules.length, 1);
  assert.equal(detail.data.documents[0].file_name, "quyet-dinh.pdf");
  assert.match(detail.data.reschedules[0].reason, /đổi lịch/);

  const decisionFile = await request(
    `/api/inspections/${inspection.id}/planning-documents/${detail.data.documents[0].id}/file`,
    { cookie: officer },
  );
  assert.deepEqual(decisionFile.data, pdf);
  const rescheduleFile = await request(
    `/api/inspections/${inspection.id}/reschedules/${detail.data.reschedules[0].id}/file`,
    { cookie: officer },
  );
  assert.deepEqual(rescheduleFile.data, png);

  const history = await request(`/api/inspections/${inspection.id}/reschedules`, {
    cookie: officer,
  });
  assert.equal(history.data.items.length, 1);
  const schedules = await request("/api/inspection-schedules?from=2027-03-01&to=2027-03-31", {
    cookie: officer,
  });
  assert.equal(schedules.data.items[0].scheduled_date, "2027-03-12");
});

test("planning APIs require authentication, permission, actor role and data scope", async (t) => {
  const { request, login } = await fixture(t);
  assert.equal((await request("/api/inspection-plans")).status, 401);

  const viewer = await login("demo.nguoi-xem");
  const denied = await request("/api/inspection-plans", {
    method: "POST",
    cookie: viewer,
    body: {
      year: 2027,
      title: "Không được tạo",
      unit_id: "DV-KV10",
      annual_target: 1,
    },
  });
  assert.equal(denied.status, 403);

  const deputy = await login("demo.to-truong");
  const wrongUnit = await request("/api/inspection-plans", {
    method: "POST",
    cookie: deputy,
    body: {
      year: 2027,
      title: "Ngoài phạm vi",
      unit_id: "DV-KV11",
      annual_target: 1,
    },
  });
  assert.equal(wrongUnit.status, 403);
});

test("UC-INS-01: plan lifecycle rejects duplicates, stale writes and edits after closing", async (t) => {
  const { db, request, login } = await fixture(t);
  const deputy = await login("demo.to-truong");
  const plan = await createDraftPlan(request, deputy);

  const duplicate = await request("/api/inspection-plans", {
    method: "POST",
    cookie: deputy,
    body: {
      code: plan.code.toLowerCase(),
      year: 2027,
      title: "Mã kế hoạch bị trùng",
      unit_id: "DV-KV10",
      annual_target: 1,
    },
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.data.error.code, "DUPLICATE");

  const stale = await request(`/api/inspection-plans/${plan.id}`, {
    method: "PUT",
    cookie: deputy,
    body: { version: 99, title: "Ghi đè bằng phiên bản cũ" },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.data.error.code, "VERSION_CONFLICT");

  const published = await request(`/api/inspection-plans/${plan.id}`, {
    method: "PUT",
    cookie: deputy,
    body: { version: 1, status: "published" },
  });
  assert.equal(published.status, 200);
  assert.equal(published.data.plan.version, 2);

  const missingReason = await request(`/api/inspection-plans/${plan.id}`, {
    method: "PUT",
    cookie: deputy,
    body: { version: 2, title: "Điều chỉnh sau công bố" },
  });
  assert.equal(missingReason.status, 400);

  const adjusted = await request(`/api/inspection-plans/${plan.id}`, {
    method: "PUT",
    cookie: deputy,
    body: {
      version: 2,
      title: "Điều chỉnh sau công bố",
      change_reason: "Điều chỉnh theo yêu cầu kiểm thử",
    },
  });
  assert.equal(adjusted.status, 200);
  assert.equal(adjusted.data.plan.version, 3);

  const closed = await request(`/api/inspection-plans/${plan.id}`, {
    method: "PUT",
    cookie: deputy,
    body: { version: 3, status: "closed" },
  });
  assert.equal(closed.status, 200);
  assert.equal(closed.data.plan.status, "closed");

  const editClosed = await request(`/api/inspection-plans/${plan.id}`, {
    method: "PUT",
    cookie: deputy,
    body: { version: 4, title: "Không được sửa" },
  });
  assert.equal(editClosed.status, 409);
  assert.equal(editClosed.data.error.code, "INVALID_STATE");

  const allocateClosed = await request(`/api/inspection-plans/${plan.id}/targets`, {
    method: "POST",
    cookie: deputy,
    body: { period_type: "month", month: 1, target_count: 1 },
  });
  assert.equal(allocateClosed.status, 409);
  assert.equal(allocateClosed.data.error.code, "INVALID_STATE");
  assert.equal(
    db
      .prepare("SELECT count(*) AS n FROM audit_logs WHERE feature='M06.planning' AND object_id=?")
      .get(plan.id).n,
    4,
  );
});

test("UC-INS-02: allocation enforces parent hierarchy, uniqueness and parent totals", async (t) => {
  const { db, request, login } = await fixture(t);
  const deputy = await login("demo.to-truong");
  const plan = await createPublishedPlan(request, deputy);

  const weekWithoutMonth = await request(`/api/inspection-plans/${plan.id}/targets`, {
    method: "POST",
    cookie: deputy,
    body: { period_type: "week", month: 3, week: 10, target_count: 2 },
  });
  assert.equal(weekWithoutMonth.status, 409);
  assert.equal(weekWithoutMonth.data.error.code, "MISSING_PARENT_TARGET");

  const month = await request(`/api/inspection-plans/${plan.id}/targets`, {
    method: "POST",
    cookie: deputy,
    body: { period_type: "month", month: 3, target_count: 4 },
  });
  assert.equal(month.status, 201);

  const duplicateMonth = await request(`/api/inspection-plans/${plan.id}/targets`, {
    method: "POST",
    cookie: deputy,
    body: { period_type: "month", month: 3, target_count: 1 },
  });
  assert.equal(duplicateMonth.status, 409);
  assert.equal(duplicateMonth.data.error.code, "DUPLICATE");

  const weekOverflow = await request(`/api/inspection-plans/${plan.id}/targets`, {
    method: "POST",
    cookie: deputy,
    body: { period_type: "week", month: 3, week: 10, target_count: 5 },
  });
  assert.equal(weekOverflow.status, 409);
  assert.equal(weekOverflow.data.error.code, "TARGET_EXCEEDED");

  const week = await request(`/api/inspection-plans/${plan.id}/targets`, {
    method: "POST",
    cookie: deputy,
    body: { period_type: "week", month: 3, week: 10, target_count: 3 },
  });
  assert.equal(week.status, 201);

  const officerWithoutParent = await request(`/api/inspection-plans/${plan.id}/targets`, {
    method: "POST",
    cookie: deputy,
    body: {
      period_type: "week",
      month: 3,
      week: 10,
      officer_id: "CB-A03",
      target_count: 1,
    },
  });
  assert.equal(officerWithoutParent.status, 400);
  assert.equal(officerWithoutParent.data.error.code, "INVALID_INPUT");

  const wrongParent = await request(`/api/inspection-plans/${plan.id}/targets`, {
    method: "POST",
    cookie: deputy,
    body: {
      period_type: "month",
      month: 3,
      officer_id: "CB-A03",
      target_count: 1,
      parent_id: week.data.target.id,
    },
  });
  assert.equal(wrongParent.status, 400);
  assert.equal(wrongParent.data.error.code, "INVALID_INPUT");

  const officer = await request(`/api/inspection-plans/${plan.id}/targets`, {
    method: "POST",
    cookie: deputy,
    body: {
      period_type: "week",
      month: 3,
      week: 10,
      officer_id: "CB-A03",
      target_count: 2,
      parent_id: week.data.target.id,
    },
  });
  assert.equal(officer.status, 201);

  const childOverflow = await request(`/api/inspection-plans/${plan.id}/targets`, {
    method: "POST",
    cookie: deputy,
    body: {
      period_type: "week",
      month: 3,
      week: 10,
      region_id: "KP01",
      target_count: 2,
      parent_id: week.data.target.id,
    },
  });
  assert.equal(childOverflow.status, 409);
  assert.equal(childOverflow.data.error.code, "TARGET_EXCEEDED");
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM inspection_targets WHERE plan_id=?").get(plan.id).n,
    4,
  );
});

test("UC-INS-03: periodic case validates plan state, plan year and 24-hour time values", async (t) => {
  const { request, login } = await fixture(t);
  const deputy = await login("demo.to-truong");
  const officer = await login("demo.can-bo");
  const plan = await createDraftPlan(request, deputy);

  const whileDraft = await createScheduledInspection(request, officer, plan.id);
  assert.equal(whileDraft.status, 409);
  assert.equal(whileDraft.data.error.code, "INVALID_STATE");

  const published = await request(`/api/inspection-plans/${plan.id}`, {
    method: "PUT",
    cookie: deputy,
    body: { version: 1, status: "published" },
  });
  assert.equal(published.status, 200);

  const outsideYear = await createScheduledInspection(request, officer, plan.id, {
    scheduled_date: "2028-03-08",
  });
  assert.equal(outsideYear.status, 400);

  for (const times of [
    { start_time: "7:00", end_time: "08:00" },
    { start_time: "24:00", end_time: "25:00" },
    { start_time: "20:30", end_time: "19:00" },
  ]) {
    const invalid = await createScheduledInspection(request, officer, plan.id, times);
    assert.equal(invalid.status, 400, JSON.stringify(times));
    assert.equal(invalid.data.error.code, "INVALID_INPUT");
  }

  const valid = await createScheduledInspection(request, officer, plan.id);
  assert.equal(valid.status, 201);
  assert.equal(valid.data.inspection.start_time, "19:00");
  assert.equal(valid.data.inspection.end_time, "20:30");

  const reversedUpdate = await request(`/api/inspections/${valid.data.inspection.id}/schedule`, {
    method: "PUT",
    cookie: officer,
    body: {
      version: valid.data.inspection.schedule_version,
      scheduled_date: "2027-03-08",
      start_time: "21:00",
      end_time: "20:00",
      location: "Tại cơ sở",
    },
  });
  assert.equal(reversedUpdate.status, 400);

  const updated = await request(`/api/inspections/${valid.data.inspection.id}/schedule`, {
    method: "PUT",
    cookie: officer,
    body: {
      version: valid.data.inspection.schedule_version,
      scheduled_date: "2027-03-08",
      start_time: "20:00",
      end_time: "21:00",
      location: "Phòng họp cơ sở",
    },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.inspection.start_time, "20:00");
  assert.equal(updated.data.inspection.end_time, "21:00");
});

test("UC-INS-04/05: notice and reschedule validation preserve versions and append-only history", async (t) => {
  const { db, request, login } = await fixture(t);
  const deputy = await login("demo.to-truong");
  const officer = await login("demo.can-bo");
  const plan = await createPublishedPlan(request, deputy);
  const created = await createScheduledInspection(request, officer, plan.id);
  assert.equal(created.status, 201);
  const inspection = created.data.inspection;

  const missingSentDate = await request(`/api/inspections/${inspection.id}/notice`, {
    method: "POST",
    cookie: officer,
    body: {
      recipient_name: "Người đại diện cơ sở",
      inspection_date: inspection.scheduled_date,
      status: "sent",
    },
  });
  assert.equal(missingSentDate.status, 400);

  const mismatchedDate = await request(`/api/inspections/${inspection.id}/notice`, {
    method: "POST",
    cookie: officer,
    body: {
      recipient_name: "Người đại diện cơ sở",
      inspection_date: "2027-03-09",
      status: "draft",
    },
  });
  assert.equal(mismatchedDate.status, 409);
  assert.equal(mismatchedDate.data.error.code, "SCHEDULE_MISMATCH");

  const forgedPdf = await request(`/api/inspections/${inspection.id}/notice`, {
    method: "POST",
    cookie: officer,
    body: {
      recipient_name: "Người đại diện cơ sở",
      inspection_date: inspection.scheduled_date,
      status: "draft",
      file: {
        name: "khong-phai-pdf.pdf",
        content_type: "application/pdf",
        content_base64: Buffer.from("not a PDF").toString("base64"),
      },
    },
  });
  assert.equal(forgedPdf.status, 400);
  assert.equal(forgedPdf.data.error.code, "INVALID_INPUT");

  const draft = await request(`/api/inspections/${inspection.id}/notice`, {
    method: "POST",
    cookie: officer,
    body: {
      notice_number: "TB-REGRESSION-01",
      recipient_name: "Người đại diện cơ sở",
      inspection_date: inspection.scheduled_date,
      status: "draft",
    },
  });
  assert.equal(draft.status, 200);
  assert.equal(draft.data.notice.version, 1);

  const staleNotice = await request(`/api/inspections/${inspection.id}/notice`, {
    method: "POST",
    cookie: officer,
    body: {
      version: 99,
      recipient_name: "Người đại diện cơ sở",
      inspection_date: inspection.scheduled_date,
      status: "draft",
    },
  });
  assert.equal(staleNotice.status, 409);
  assert.equal(staleNotice.data.error.code, "VERSION_CONFLICT");

  const sent = await request(`/api/inspections/${inspection.id}/notice`, {
    method: "POST",
    cookie: officer,
    body: {
      version: 1,
      notice_number: "TB-REGRESSION-01",
      recipient_name: "Người đại diện cơ sở",
      inspection_date: inspection.scheduled_date,
      sent_date: "2027-03-01",
      status: "sent",
    },
  });
  assert.equal(sent.status, 200);
  assert.equal(sent.data.notice.version, 2);

  const sameDate = await request(`/api/inspections/${inspection.id}/reschedules`, {
    method: "POST",
    cookie: officer,
    body: {
      version: inspection.schedule_version,
      new_date: inspection.scheduled_date,
      reason: "Ngày không thay đổi",
    },
  });
  assert.equal(sameDate.status, 400);

  const invalidTimes = await request(`/api/inspections/${inspection.id}/reschedules`, {
    method: "POST",
    cookie: officer,
    body: {
      version: inspection.schedule_version,
      new_date: "2027-03-09",
      start_time: "22:00",
      end_time: "21:00",
      reason: "Kiểm tra thứ tự giờ",
    },
  });
  assert.equal(invalidTimes.status, 400);

  const moved = await request(`/api/inspections/${inspection.id}/reschedules`, {
    method: "POST",
    cookie: officer,
    body: {
      version: inspection.schedule_version,
      new_date: "2028-01-02",
      start_time: "08:00",
      end_time: "09:30",
      reason: "Cơ sở đề nghị chuyển sang đầu năm sau",
    },
  });
  assert.equal(moved.status, 201);
  assert.match(moved.data.warning, /ngoài năm kế hoạch/i);
  assert.equal(moved.data.reschedule.old_start_time, "19:00");
  assert.equal(moved.data.reschedule.new_start_time, "08:00");

  const staleReschedule = await request(`/api/inspections/${inspection.id}/reschedules`, {
    method: "POST",
    cookie: officer,
    body: {
      version: inspection.schedule_version,
      new_date: "2028-01-03",
      reason: "Phiên bản lịch đã cũ",
    },
  });
  assert.equal(staleReschedule.status, 409);
  assert.equal(staleReschedule.data.error.code, "VERSION_CONFLICT");

  const detail = await request(`/api/inspections/${inspection.id}/planning`, { cookie: officer });
  assert.equal(detail.data.notice.status, "draft");
  assert.equal(detail.data.notice.sent_date, null);
  assert.equal(detail.data.notice.version, 3);
  assert.equal(detail.data.reschedules.length, 1);
  const historyId = detail.data.reschedules[0].id;
  assert.throws(
    () =>
      db.prepare("UPDATE inspection_reschedules SET reason='tampered' WHERE id=?").run(historyId),
    /append-only/,
  );
  assert.throws(
    () => db.prepare("DELETE FROM inspection_reschedules WHERE id=?").run(historyId),
    /append-only/,
  );
});

test("planning actor roles cannot cross plan, case, notice and reschedule responsibilities", async (t) => {
  const { request, login } = await fixture(t);
  const deputy = await login("demo.to-truong");
  const officer = await login("demo.can-bo");
  const summaryOfficer = await login("demo.tong-hop");
  const plan = await createPublishedPlan(request, deputy);

  const officerPlan = await request("/api/inspection-plans", {
    method: "POST",
    cookie: officer,
    body: {
      code: "KHKT-OFFICER-DENIED",
      year: 2027,
      title: "Cán bộ không được lập kế hoạch",
      unit_id: "DV-KV10",
      annual_target: 1,
    },
  });
  assert.equal(officerPlan.status, 403);

  const deputyCase = await createScheduledInspection(request, deputy, plan.id);
  assert.equal(deputyCase.status, 403);

  const created = await createScheduledInspection(request, officer, plan.id);
  assert.equal(created.status, 201);
  const inspection = created.data.inspection;

  const summaryReschedule = await request(`/api/inspections/${inspection.id}/reschedules`, {
    method: "POST",
    cookie: summaryOfficer,
    body: {
      version: inspection.schedule_version,
      new_date: "2027-03-09",
      reason: "Vai trò tổng hợp không được dời lịch",
    },
  });
  assert.equal(summaryReschedule.status, 403);

  const deputyNotice = await request(`/api/inspections/${inspection.id}/notice`, {
    method: "POST",
    cookie: deputy,
    body: {
      recipient_name: "Người đại diện cơ sở",
      inspection_date: inspection.scheduled_date,
      status: "draft",
    },
  });
  assert.equal(deputyNotice.status, 403);
});
