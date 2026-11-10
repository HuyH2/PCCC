import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import {
  businessDate,
  businessPeriod,
  previousPeriod,
  periodRange,
} from "../src/core/time.js";
import { createApp } from "../src/app.js";

const password = "Work-kpi-test-2026";
const origin = "http://localhost:3000";

function nextPeriod(period) {
  const [year, month] = period.split("-").map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
}

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
  async function request(path, { method = "GET", cookie, body, headers = {} } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        ...headers,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return {
      status: response.status,
      data,
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  async function login(username) {
    const response = await request("/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    assert.equal(response.status, 200, `login failed for ${username}`);
    return response.cookie;
  }
  return { db, request, login };
}

test("TC-WRK-E2E-01: End-to-End task lifecycle from assignment to progress and completion", async (t) => {
  const { db, request, login } = await fixture(t);
  const commander = await login("demo.chi-huy");
  const officer = await login("demo.can-bo");
  const today = businessDate();

  // 1. A01 creates task and assigns to A03
  const created = await request("/api/tasks", {
    method: "POST",
    cookie: commander,
    body: {
      title: "Kiểm tra an toàn PCCC chung cư Sunshine",
      description: "Thực hiện rà soát hệ thống báo cháy tự động và lối thoát nạn tầng 1-15.",
      kind: "assigned",
      dueDate: today,
      assigneeId: "DEMO-A03",
    },
  });
  assert.equal(created.status, 201);
  const taskId = created.data.task.id;
  assert.equal(created.data.task.status, "open");
  assert.equal(created.data.task.progress, 0);
  assert.equal(created.data.task.assigned_by, "DEMO-A01");
  assert.equal(created.data.task.assigned_to, "DEMO-A03");

  // Check 1 active assignment row
  const assignmentCount = db
    .prepare("SELECT count(*) AS n FROM task_assignments WHERE task_id=? AND ended_at IS NULL")
    .get(taskId).n;
  assert.equal(assignmentCount, 1);

  // 2. A03 views task
  const taskView = await request(`/api/tasks/${taskId}`, { cookie: officer });
  assert.equal(taskView.status, 200);
  assert.equal(taskView.data.task.title, "Kiểm tra an toàn PCCC chung cư Sunshine");

  // 3. A03 updates progress: 30% -> 70% -> 100%
  const prog30 = await request(`/api/tasks/${taskId}/progress`, {
    method: "PUT",
    cookie: officer,
    body: { progress: 30, note: "Đã kiểm tra hệ thống báo cháy tầng 1 đến 5" },
  });
  assert.equal(prog30.status, 200);
  assert.equal(prog30.data.task.progress, 30);
  assert.equal(prog30.data.task.status, "open");

  const prog70 = await request(`/api/tasks/${taskId}/progress`, {
    method: "PUT",
    cookie: officer,
    body: { progress: 70, note: "Đã kiểm tra tiếp tầng 6 đến 12" },
  });
  assert.equal(prog70.status, 200);
  assert.equal(prog70.data.task.progress, 70);

  const prog100 = await request(`/api/tasks/${taskId}/progress`, {
    method: "PUT",
    cookie: officer,
    body: { progress: 100, note: "Đã hoàn tất kiểm tra thực địa, chuẩn bị biên bản" },
  });
  assert.equal(prog100.status, 200);
  assert.equal(prog100.data.task.progress, 100);
  // Rule verification: 100% does NOT auto-complete task
  assert.equal(prog100.data.task.status, "open");
  assert.equal(prog100.data.task.completed_at, null);

  // 4. A03 marks task completed
  const completed = await request(`/api/tasks/${taskId}/status`, {
    method: "PUT",
    cookie: officer,
    body: { status: "completed", note: "Đã ký biên bản nghiệm thu PCCC với ban quản trị" },
  });
  assert.equal(completed.status, 200);
  assert.equal(completed.data.task.status, "completed");
  assert.equal(completed.data.task.progress, 100);
  assert.ok(completed.data.task.completed_at);

  // 5. A01 verifies task completion and progress history
  const commanderCheck = await request(`/api/tasks/${taskId}`, { cookie: commander });
  assert.equal(commanderCheck.status, 200);
  assert.equal(commanderCheck.data.task.status, "completed");

  const history = await request(`/api/tasks/${taskId}/progress-history`, { cookie: commander });
  assert.equal(history.status, 200);
  // 3 progress updates + 1 completion entry = 4 history items
  assert.equal(history.data.total, 4);
  assert.equal(history.data.items[0].status, "completed");

  // 6. Verify audit records
  const audits = db
    .prepare("SELECT action FROM audit_logs WHERE object_id=? ORDER BY id ASC")
    .all(taskId)
    .map((r) => r.action);
  assert.ok(audits.includes("task.created"));
  assert.ok(audits.includes("task.progress_updated"));
  assert.ok(audits.includes("task.status_changed"));
});

test("TC-WRK-E2E-02: End-to-End KPI target configuration, multi-period debt and capping", async (t) => {
  const { db, request, login } = await fixture(t);
  const admin = await login("demo.admin");
  const commander = await login("demo.chi-huy");
  const officer = await login("demo.can-bo");
  const today = businessDate();
  const period = businessPeriod();
  const nextP = nextPeriod(period);

  // Clean demo seed KPI for DEMO-A03 to have a pure isolated test environment matching TC-02 spec
  db.prepare("DELETE FROM kpi_targets WHERE account_id='DEMO-A03'").run();

  // 1. Set KPI target = 5 for period
  const setTarget = await request("/api/kpi/targets", {
    method: "POST",
    cookie: admin,
    body: { accountId: "DEMO-A03", period, targetTasks: 5, note: "Chỉ tiêu tháng" },
  });
  assert.equal(setTarget.status, 201);

  // 2. Complete 3 tasks in period for A03
  for (let i = 1; i <= 3; i++) {
    const task = await request("/api/tasks", {
      method: "POST",
      cookie: commander,
      body: {
        title: `Nhiệm vụ KPI ${i}`,
        description: "Mô tả",
        kind: "assigned",
        dueDate: today,
        assigneeId: "DEMO-A03",
      },
    });
    assert.equal(task.status, 201);
    const complete = await request(`/api/tasks/${task.data.task.id}/status`, {
      method: "PUT",
      cookie: officer,
      body: { status: "completed" },
    });
    assert.equal(complete.status, 200);
  }

  // 3. Officer views KPI results: available=5, completed=3, debt=2, score=round(3/5*100)=60
  const kpiP1 = await request(`/api/kpi/results?period=${period}&accountId=DEMO-A03`, {
    cookie: officer,
  });
  assert.equal(kpiP1.status, 200);
  assert.equal(kpiP1.data.items[0].target_tasks, 5);
  assert.equal(kpiP1.data.items[0].completed_tasks, 3);
  assert.equal(kpiP1.data.items[0].previous_debt, 0);
  assert.equal(kpiP1.data.items[0].debt, 2);
  assert.equal(kpiP1.data.items[0].score, 60);

  // 4. Next period: target = 3 -> previous_debt carries over (2) -> available = 3 + 2 = 5
  const setNextTarget = await request("/api/kpi/targets", {
    method: "POST",
    cookie: admin,
    body: { accountId: "DEMO-A03", period: nextP, targetTasks: 3 },
  });
  assert.equal(setNextTarget.status, 201);

  const kpiP2 = await request(`/api/kpi/results?period=${nextP}&accountId=DEMO-A03`, {
    cookie: commander,
  });
  assert.equal(kpiP2.status, 200);
  assert.equal(kpiP2.data.items[0].target_tasks, 3);
  assert.equal(kpiP2.data.items[0].previous_debt, 2);
  assert.equal(kpiP2.data.items[0].debt, 5); // 0 completed yet in nextP -> debt = 5
  assert.equal(kpiP2.data.items[0].score, 0);

  // 5. Over-achievement branch: complete 6 tasks in next period (exceeds available 5)
  const rangeNext = periodRange(nextP);
  for (let i = 1; i <= 6; i++) {
    const id = `overachieve-${i}`;
    db.prepare(
      `INSERT INTO tasks (id,code,title,description,assigned_by,assigned_to,status,kind,due_at,progress,completed_at,created_at,updated_at)
       VALUES (?,?,?,?,'DEMO-A01','DEMO-A03','completed','assigned',?,100,?,?,?)`,
    ).run(id, `CV-${id}`, `Overachieve task ${i}`, "Desc", rangeNext.start, rangeNext.start + 1000, rangeNext.start, rangeNext.start);
  }

  const kpiOver = await request(`/api/kpi/results?period=${nextP}&accountId=DEMO-A03`, {
    cookie: commander,
  });
  assert.equal(kpiOver.status, 200);
  assert.equal(kpiOver.data.items[0].completed_tasks, 6);
  assert.equal(kpiOver.data.items[0].debt, 0);
  // Score capped at 100, no negative debt / credit carryover
  assert.equal(kpiOver.data.items[0].score, 100);
});

test("TC-WRK-E2E-03: End-to-End explanation lifecycle with period debt waiver vs task explanation", async (t) => {
  const { db, request, login } = await fixture(t);
  const commander = await login("demo.chi-huy");
  const officer = await login("demo.can-bo");
  const admin = await login("demo.admin");
  const period = businessPeriod();

  // Clean demo seed KPI for DEMO-A03
  db.prepare("DELETE FROM kpi_targets WHERE account_id='DEMO-A03'").run();

  // 1. Configure target = 4, complete 0 -> debt = 4
  await request("/api/kpi/targets", {
    method: "POST",
    cookie: admin,
    body: { accountId: "DEMO-A03", period, targetTasks: 4 },
  });

  // 2. A01 requests explanation for period
  const reqExplanation = await request("/api/explanations", {
    method: "POST",
    cookie: commander,
    body: {
      accountId: "DEMO-A03",
      period,
      reason: "Đề nghị giải trình nguyên nhân chưa đạt chỉ tiêu tháng.",
    },
  });
  assert.equal(reqExplanation.status, 201);
  const expId = reqExplanation.data.explanation.id;
  assert.equal(reqExplanation.data.explanation.status, "requested");

  // 3. A03 views requested explanation and responds
  const officerExps = await request("/api/explanations", { cookie: officer });
  assert.equal(officerExps.status, 200);
  assert.ok(officerExps.data.items.some((item) => item.id === expId));

  const submitted = await request(`/api/explanations/${expId}/response`, {
    method: "PUT",
    cookie: officer,
    body: { response: "Do hỗ trợ điều tra vụ cháy lớn tại Khu công nghiệp Tân Bình trong 2 tuần." },
  });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.data.explanation.status, "submitted");

  // 4. A01 approves explanation (accepted)
  const reviewed = await request(`/api/explanations/${expId}/review`, {
    method: "PUT",
    cookie: commander,
    body: { decision: "accepted", note: "Lý do chính đáng, chấp thuận miễn trừ nợ chỉ tiêu." },
  });
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.data.explanation.status, "accepted");
  assert.equal(reviewed.data.explanation.debt_waived, 1);

  // 5. Verify debt is waived in KPI calculation
  const kpiResult = await request(`/api/kpi/results?period=${period}&accountId=DEMO-A03`, {
    cookie: officer,
  });
  assert.equal(kpiResult.status, 200);
  assert.equal(kpiResult.data.items[0].debt, 0);
  assert.equal(kpiResult.data.items[0].waived_debt, 4);

  // 6. Test task-specific explanation does NOT waive KPI debt
  const task = await request("/api/tasks", {
    method: "POST",
    cookie: commander,
    body: {
      title: "Việc cần giải trình tiến độ",
      description: "Mô tả",
      kind: "assigned",
      dueDate: businessDate(),
      assigneeId: "DEMO-A03",
    },
  });
  const taskExp = await request("/api/explanations", {
    method: "POST",
    cookie: commander,
    body: {
      accountId: "DEMO-A03",
      taskId: task.data.task.id,
      reason: "Giải trình nguyên nhân chậm tiến độ kiểm tra",
    },
  });
  assert.equal(taskExp.status, 201);
  const taskExpId = taskExp.data.explanation.id;
  await request(`/api/explanations/${taskExpId}/response`, {
    method: "PUT",
    cookie: officer,
    body: { response: "Cơ sở chưa cung cấp đủ hồ sơ thiết kế ban đầu." },
  });
  const reviewedTaskExp = await request(`/api/explanations/${taskExpId}/review`, {
    method: "PUT",
    cookie: commander,
    body: { decision: "accepted", note: "Đã ghi nhận" },
  });
  assert.equal(reviewedTaskExp.status, 200);
  assert.equal(reviewedTaskExp.data.explanation.debt_waived, 0); // Must be 0 for task explanation

  // Note: Attachment upload in explanation is not supported in current schema/API
  assert.equal(db.prepare("PRAGMA table_info(explanations)").all().some(c => c.name === "attachment_url"), false);
});

test("TC-WRK-E2E-04: End-to-End task conversation messaging across distinct user sessions", async (t) => {
  const { request, login } = await fixture(t);
  const commander = await login("demo.chi-huy");
  const officer = await login("demo.can-bo");
  const today = businessDate();

  // 1. Create task
  const created = await request("/api/tasks", {
    method: "POST",
    cookie: commander,
    body: {
      title: "Phối hợp kiểm tra PCCC chợ truyền thống",
      description: "Kiểm tra bình chữa cháy và nguồn nước",
      kind: "assigned",
      dueDate: today,
      assigneeId: "DEMO-A03",
    },
  });
  const taskId = created.data.task.id;

  // 2. A01 sends message
  const msg1 = await request(`/api/tasks/${taskId}/messages`, {
    method: "POST",
    cookie: commander,
    body: { body: "Đồng chí mang theo biên bản mẫu số 03 khi đi kiểm tra." },
  });
  assert.equal(msg1.status, 201);
  assert.equal(msg1.data.message.body, "Đồng chí mang theo biên bản mẫu số 03 khi đi kiểm tra.");
  const msg1Id = msg1.data.message.id;

  // 3. A03 logs in and reads conversation
  const list1 = await request(`/api/tasks/${taskId}/messages`, { cookie: officer });
  assert.equal(list1.status, 200);
  assert.equal(list1.data.items.length, 1);
  assert.equal(list1.data.items[0].sender_id, "DEMO-A01");

  // 4. A03 replies
  const msg2 = await request(`/api/tasks/${taskId}/messages`, {
    method: "POST",
    cookie: officer,
    body: { body: "Rõ, tôi đã chuẩn bị đầy đủ tài liệu và thiết bị đo." },
  });
  assert.equal(msg2.status, 201);

  // 5. A01 edits their message
  const edited = await request(`/api/tasks/${taskId}/messages/${msg1Id}`, {
    method: "PUT",
    cookie: commander,
    body: { body: "Đồng chí mang theo biên bản mẫu số 03 và kiểm tra cả họng nước chữa cháy." },
  });
  assert.equal(edited.status, 200);
  assert.ok(edited.data.message.edited_at);

  // 6. A01 soft-deletes their message
  const deleted = await request(`/api/tasks/${taskId}/messages/${msg1Id}`, {
    method: "DELETE",
    cookie: commander,
  });
  assert.equal(deleted.status, 200);

  // 7. A03 reads messages after reload: deleted message has null body
  const list2 = await request(`/api/tasks/${taskId}/messages`, { cookie: officer });
  assert.equal(list2.status, 200);
  const deletedItem = list2.data.items.find((m) => m.id === msg1Id);
  assert.ok(deletedItem.deleted_at);
  assert.equal(deletedItem.body, null);

  // 8. Close task and verify messages can no longer be sent
  await request(`/api/tasks/${taskId}/status`, {
    method: "PUT",
    cookie: commander,
    body: { status: "completed" },
  });
  const afterClosed = await request(`/api/tasks/${taskId}/messages`, {
    method: "POST",
    cookie: officer,
    body: { body: "Thử gửi tin sau khi hoàn thành" },
  });
  assert.equal(afterClosed.status, 409);
  assert.equal(afterClosed.data.error.code, "TASK_CLOSED");
});

test("TC-WRK-NEG: Negative tests for task assignment, progress, status and permissions", async (t) => {
  const { db, request, login } = await fixture(t);
  const commander = await login("demo.chi-huy");
  const officer = await login("demo.can-bo");
  const viewer = await login("demo.nguoi-xem");
  const today = businessDate();

  // NEG-01: Giao việc cho người không hợp lệ / ngoài scope / không tồn tại
  const negInvalidAssignee = await request("/api/tasks", {
    method: "POST",
    cookie: commander,
    body: {
      title: "Test invalid assignee",
      description: "Desc",
      kind: "assigned",
      dueDate: today,
      assigneeId: "NON-EXISTENT",
    },
  });
  assert.equal(negInvalidAssignee.status, 403);
  assert.equal(negInvalidAssignee.data.error.code, "FORBIDDEN");

  // NEG-02: Cập nhật việc ngoài quyền (A06 không có M07.edit)
  const validTask = await request("/api/tasks", {
    method: "POST",
    cookie: commander,
    body: {
      title: "Task bảo vệ quyền",
      description: "Desc",
      kind: "assigned",
      dueDate: today,
      assigneeId: "DEMO-A03",
    },
  });
  assert.equal(validTask.status, 201);
  const taskId = validTask.data.task.id;

  const viewerProgress = await request(`/api/tasks/${taskId}/progress`, {
    method: "PUT",
    cookie: viewer,
    body: { progress: 50 },
  });
  assert.equal(viewerProgress.status, 403);

  // A03 cancels task (forbidden: only assigner can cancel)
  const officerCancel = await request(`/api/tasks/${taskId}/status`, {
    method: "PUT",
    cookie: officer,
    body: { status: "cancelled" },
  });
  assert.equal(officerCancel.status, 403);

  // NEG-03: Tiến độ không hợp lệ: -1, 101, 50.5, chuỗi, NO_CHANGE
  for (const badProg of [-1, 101, 50.5, "fifty", null]) {
    const res = await request(`/api/tasks/${taskId}/progress`, {
      method: "PUT",
      cookie: officer,
      body: { progress: badProg },
    });
    assert.equal(res.status, 400, `Expected 400 for progress ${badProg}`);
    assert.equal(res.data.error.code, "INVALID_INPUT");
  }

  // Same progress without note -> 409 NO_CHANGE
  const noChange = await request(`/api/tasks/${taskId}/progress`, {
    method: "PUT",
    cookie: officer,
    body: { progress: 0 },
  });
  assert.equal(noChange.status, 409);
  assert.equal(noChange.data.error.code, "NO_CHANGE");

  // NEG-04: Hoàn thành khi đã đóng / hoàn thành lặp
  await request(`/api/tasks/${taskId}/status`, {
    method: "PUT",
    cookie: officer,
    body: { status: "completed" },
  });
  const completeAgain = await request(`/api/tasks/${taskId}/status`, {
    method: "PUT",
    cookie: officer,
    body: { status: "completed" },
  });
  assert.equal(completeAgain.status, 409);
  assert.equal(completeAgain.data.error.code, "NO_CHANGE");

  const progressOnClosed = await request(`/api/tasks/${taskId}/progress`, {
    method: "PUT",
    cookie: officer,
    body: { progress: 80, note: "Update on completed" },
  });
  assert.equal(progressOnClosed.status, 409);
  assert.equal(progressOnClosed.data.error.code, "TASK_CLOSED");
});

test("TC-WRK-NEG-05..10: Negative tests for KPI, messages, CSRF, explanations and security", async (t) => {
  const { db, request, login } = await fixture(t);
  const admin = await login("demo.admin");
  const commander = await login("demo.chi-huy");
  const officer = await login("demo.can-bo");
  const today = businessDate();

  // NEG-05: KPI kỳ sai định dạng và thiếu cấu hình
  const badPeriod = await request("/api/kpi/results?period=2026-13", { cookie: commander });
  assert.equal(badPeriod.status, 400);

  const unconfiguredKpi = await request("/api/kpi/results?period=2025-01&accountId=DEMO-A03", {
    cookie: commander,
  });
  assert.equal(unconfiguredKpi.status, 200);
  assert.equal(unconfiguredKpi.data.items[0].configured, false);
  assert.equal(unconfiguredKpi.data.items[0].score, 0);

  // NEG-06: Message rỗng, whitespace, quá 4000 ký tự
  const task = await request("/api/tasks", {
    method: "POST",
    cookie: commander,
    body: {
      title: "Task for message tests",
      description: "Desc",
      kind: "assigned",
      dueDate: today,
      assigneeId: "DEMO-A03",
    },
  });
  const taskId = task.data.task.id;

  const emptyMsg = await request(`/api/tasks/${taskId}/messages`, {
    method: "POST",
    cookie: commander,
    body: { body: "   " },
  });
  assert.equal(emptyMsg.status, 400);

  const longMsg = await request(`/api/tasks/${taskId}/messages`, {
    method: "POST",
    cookie: commander,
    body: { body: "A".repeat(4001) },
  });
  assert.equal(longMsg.status, 400);

  // NEG-07: Người ngoài công việc xem/gửi tin nhắn (A02 is not in this task)
  const deputy = await login("demo.to-truong");
  const outsiderView = await request(`/api/tasks/${taskId}/messages`, { cookie: deputy });
  assert.equal(outsiderView.status, 404);

  const outsiderSend = await request(`/api/tasks/${taskId}/messages`, {
    method: "POST",
    cookie: deputy,
    body: { body: "Tin nhắn từ người ngoài cuộc" },
  });
  assert.equal(outsiderSend.status, 404);

  // NEG-08: Thiếu Origin hoặc Origin sai khi ghi
  const badOrigin = await request("/api/tasks", {
    method: "POST",
    cookie: commander,
    headers: { Origin: "http://malicious-site.com" },
    body: {
      title: "CSRF task",
      description: "Desc",
      kind: "assigned",
      dueDate: today,
      assigneeId: "DEMO-A03",
    },
  });
  assert.equal(badOrigin.status, 403);

  // NEG-09: Xử lý giải trình khi chưa submitted hoặc duyệt 2 lần
  const exp = await request("/api/explanations", {
    method: "POST",
    cookie: commander,
    body: {
      accountId: "DEMO-A03",
      period: businessPeriod(),
      reason: "Lý do",
    },
  });
  const expId = exp.data.explanation.id;

  // Review directly while status is 'requested' -> 409 EXPLANATION_CLOSED
  const earlyReview = await request(`/api/explanations/${expId}/review`, {
    method: "PUT",
    cookie: commander,
    body: { decision: "accepted" },
  });
  assert.equal(earlyReview.status, 409);
  assert.equal(earlyReview.data.error.code, "EXPLANATION_CLOSED");

  // NEG-10: XSS and SQL injection payloads handled safely as raw text
  const xssTitle = "<script>alert('xss')</script> Kiểm tra ' OR '1'='1";
  const xssTask = await request("/api/tasks", {
    method: "POST",
    cookie: commander,
    body: {
      title: xssTitle,
      description: "Test XSS handling",
      kind: "assigned",
      dueDate: today,
      assigneeId: "DEMO-A03",
    },
  });
  assert.equal(xssTask.status, 201);
  assert.equal(xssTask.data.task.title, xssTitle);
  const fetchedTask = await request(`/api/tasks/${xssTask.data.task.id}`, { cookie: officer });
  assert.equal(fetchedTask.data.task.title, xssTitle);
});

test("TC-WRK-INT-01..04: Integration tests for persistence, cross-module sync, audit and concurrency", async (t) => {
  const { db, request, login } = await fixture(t);
  const commander = await login("demo.chi-huy");
  const officer = await login("demo.can-bo");
  const today = businessDate();
  const period = businessPeriod();

  // Clean demo seed KPI for DEMO-A03
  db.prepare("DELETE FROM kpi_targets WHERE account_id='DEMO-A03'").run();

  // INT-01 & INT-02: Create, progress, complete task and verify cross-module KPI sync
  const target = await request("/api/kpi/targets", {
    method: "POST",
    cookie: commander,
    body: { accountId: "DEMO-A03", period, targetTasks: 1 },
  });
  assert.equal(target.status, 201);

  const task = await request("/api/tasks", {
    method: "POST",
    cookie: commander,
    body: {
      title: "Việc đồng bộ KPI",
      description: "Mô tả",
      kind: "assigned",
      dueDate: today,
      assigneeId: "DEMO-A03",
    },
  });
  const taskId = task.data.task.id;

  // Before completion: completed_tasks = 0, debt = 1, score = 0
  const kpiBefore = await request(`/api/kpi/results?period=${period}&accountId=DEMO-A03`, {
    cookie: officer,
  });
  assert.equal(kpiBefore.data.items[0].completed_tasks, 0);
  assert.equal(kpiBefore.data.items[0].debt, 1);

  // Complete task
  await request(`/api/tasks/${taskId}/status`, {
    method: "PUT",
    cookie: officer,
    body: { status: "completed" },
  });

  // After completion: completed_tasks = 1, debt = 0, score = 100
  const kpiAfter = await request(`/api/kpi/results?period=${period}&accountId=DEMO-A03`, {
    cookie: officer,
  });
  assert.equal(kpiAfter.data.items[0].completed_tasks, 1);
  assert.equal(kpiAfter.data.items[0].debt, 0);
  assert.equal(kpiAfter.data.items[0].score, 100);

  // INT-03: Verify audit logs
  const auditEntries = db
    .prepare("SELECT * FROM audit_logs WHERE feature='M07' AND object_id=?")
    .all(taskId);
  assert.ok(auditEntries.length >= 2);
  assert.ok(auditEntries.some((e) => e.action === "task.created"));
  assert.ok(auditEntries.some((e) => e.action === "task.status_changed"));

  // INT-04: Concurrency simulation (optimistic lock rejection on simultaneous mutation)
  const task2 = await request("/api/tasks", {
    method: "POST",
    cookie: commander,
    body: {
      title: "Việc thử nghiệm concurrency",
      description: "Mô tả",
      kind: "assigned",
      dueDate: today,
      assigneeId: "DEMO-A03",
    },
  });
  const taskId2 = task2.data.task.id;

  // Simultaneous status updates: one succeeds (200), the other gets rejected (409)
  const [stat1, stat2] = await Promise.all([
    request(`/api/tasks/${taskId2}/status`, {
      method: "PUT",
      cookie: commander,
      body: { status: "cancelled", note: "Hủy 1" },
    }),
    request(`/api/tasks/${taskId2}/status`, {
      method: "PUT",
      cookie: commander,
      body: { status: "cancelled", note: "Hủy 2" },
    }),
  ]);
  const taskStatuses = [stat1.status, stat2.status].sort();
  assert.deepEqual(taskStatuses, [200, 409]);
  const rejectedTaskStat = stat1.status === 409 ? stat1 : stat2;
  assert.ok(["TASK_CLOSED", "NO_CHANGE", "TASK_CHANGED"].includes(rejectedTaskStat.data?.error?.code));

  // Simultaneous explanation reviews: one succeeds (200), the other gets rejected (409)
  const expRes = await request("/api/explanations", {
    method: "POST",
    cookie: commander,
    body: { accountId: "DEMO-A03", period, reason: "Concurrent explanation test" },
  });
  const expId = expRes.data.explanation.id;
  await request(`/api/explanations/${expId}/response`, {
    method: "PUT",
    cookie: officer,
    body: { response: "Phản hồi thử nghiệm concurrency" },
  });

  const [rev1, rev2] = await Promise.all([
    request(`/api/explanations/${expId}/review`, {
      method: "PUT",
      cookie: commander,
      body: { decision: "accepted", note: "Duyệt 1" },
    }),
    request(`/api/explanations/${expId}/review`, {
      method: "PUT",
      cookie: commander,
      body: { decision: "rejected", note: "Duyệt 2" },
    }),
  ]);
  const expStatuses = [rev1.status, rev2.status].sort();
  assert.deepEqual(expStatuses, [200, 409]);
  const rejectedExp = rev1.status === 409 ? rev1 : rev2;
  assert.ok(["EXPLANATION_CLOSED", "EXPLANATION_CHANGED"].includes(rejectedExp.data?.error?.code));
});

test("TC-WRK-01-01: Work schedule filtering, overdue calculation and Vietnam timezone boundaries", async (t) => {
  const { db, request, login } = await fixture(t);
  const commander = await login("demo.chi-huy");
  const officer = await login("demo.can-bo");
  const today = businessDate();

  // Create tasks with different due dates:
  // 1. Task due today -> NOT overdue today
  const dueToday = await request("/api/tasks", {
    method: "POST",
    cookie: commander,
    body: {
      title: "Việc đến hạn hôm nay",
      description: "Desc",
      kind: "assigned",
      dueDate: today,
      assigneeId: "DEMO-A03",
    },
  });
  assert.equal(dueToday.status, 201);

  // 2. Task due yesterday (insert directly into DB to simulate past due date)
  const yesterdayEpoch = Date.parse(`${today}T00:00:00+07:00`) - 86400000;
  const yesterdayStr = businessDate(yesterdayEpoch);
  const overdueId = "task-overdue-past";
  db.prepare(
    `INSERT INTO tasks (id,code,title,description,assigned_by,assigned_to,status,kind,due_at,progress,created_at,updated_at)
     VALUES (?,?,?,?,'DEMO-A01','DEMO-A03','open','assigned',?,0,?,?)`,
  ).run(overdueId, "CV-OVERDUE", "Việc quá hạn hôm qua", "Desc", yesterdayEpoch + 86399999, yesterdayEpoch, yesterdayEpoch);

  // 3. Completed task due yesterday -> should NOT be included in overdue
  const completedPastId = "task-completed-past";
  db.prepare(
    `INSERT INTO tasks (id,code,title,description,assigned_by,assigned_to,status,kind,due_at,progress,completed_at,created_at,updated_at)
     VALUES (?,?,?,?,'DEMO-A01','DEMO-A03','completed','assigned',?,100,?,?,?)`,
  ).run(completedPastId, "CV-COMP-PAST", "Việc quá hạn nhưng đã xong", "Desc", yesterdayEpoch + 86399999, yesterdayEpoch, yesterdayEpoch, yesterdayEpoch);

  // Check overdue filter for A03
  const overdueList = await request("/api/tasks?deadline=overdue", { cookie: officer });
  assert.equal(overdueList.status, 200);
  assert.ok(overdueList.data.items.some((item) => item.id === overdueId));
  // Task due today must NOT be in overdue
  assert.equal(overdueList.data.items.some((item) => item.id === dueToday.data.task.id), false);
  // Completed task must NOT be in overdue
  assert.equal(overdueList.data.items.some((item) => item.id === completedPastId), false);

  // Check 7-day schedule filter
  const scheduleList = await request(`/api/tasks?from=${today}&to=${today}&sort=due`, {
    cookie: officer,
  });
  assert.equal(scheduleList.status, 200);
  assert.ok(scheduleList.data.items.some((item) => item.id === dueToday.data.task.id));
});
