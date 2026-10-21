import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";
import { permissionsFor, scopesFor } from "../src/modules/authorization/authorization.service.js";
import { businessDate } from "../src/core/time.js";
import {
  completeReport,
  createReportRequest,
  createReportSchedule,
  generateReportPeriod,
  listReportRequests,
  refreshReportReminders,
  submitReport,
  listReportAssignees,
} from "../src/modules/reports/reports.service.js";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../src/modules/notifications/notifications.service.js";

const password = "Report-test-password-2026";
async function fixture(t) {
  const db = await openDatabase(":memory:");
  await seedDemo(db, password);
  await db.exec("UPDATE accounts SET must_change_password=0");
  t.after(async () => await db.close());
  const user = async (role) => {
    const id = `DEMO-${role}`;
    return {
      id,
      role,
      permissions: await permissionsFor(db, role),
      scopes: await scopesFor(db, id),
      mustChangePassword: false,
    };
  };
  return { db, user };
}
test("seed tạo nhiều báo cáo và không ghi đè dữ liệu khi chạy lại", async (t) => {
  const { db } = await fixture(t);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM report_requests").get()).n, 48);
  await db.prepare("UPDATE report_requests SET title='Đã chỉnh sửa' WHERE id='BC-DEMO-001'").run();
  await seedDemo(db, password);
  assert.equal(
    (await db.prepare("SELECT title FROM report_requests WHERE id='BC-DEMO-001'").get()).title,
    "Đã chỉnh sửa",
  );
  assert.equal((await db.prepare("SELECT count(*) AS n FROM report_requests").get()).n, 48);
});

test("giao → cảnh báo → nộp file → hoàn thành, quyền và audit", async (t) => {
  const { db, user } = await fixture(t);
  const admin = await user("A05"),
    assignee = await user("A04"),
    outsider = await user("A06");
  const dueDate = businessDate();
  const created = await createReportRequest(
    db,
    admin,
    {
      reportTypeId: "BC-TYPE-ADHOC",
      title: "Báo cáo tích hợp",
      recipient: "PC07",
      assigneeId: assignee.id,
      dueDate,
    },
    "test",
  );
  const id = created.request.id;
  assert.equal(
    (
      await listReportRequests(
        db,
        assignee,
        new URL("http://localhost/api/reports/requests?q=tích%20hợp"),
      )
    ).total,
    1,
  );
  await assert.rejects(async () => await submitReport(db, outsider, id, {}, "test"), {
    code: "FORBIDDEN",
  });
  await refreshReportReminders(db, assignee);
  await refreshReportReminders(db, assignee);
  assert.equal(
    (
      await db
        .prepare("SELECT count(*) AS n FROM notifications WHERE object_id=? AND kind='due_soon'")
        .get(id)
    ).n,
    1,
  );
  const data = Buffer.from("%PDF-1.4\n%%EOF\n");
  await submitReport(
    db,
    assignee,
    id,
    { fileName: "report.pdf", contentType: "application/pdf", data, note: "Đã kiểm tra" },
    "test",
  );
  assert.equal(
    (await db.prepare("SELECT status FROM report_requests WHERE id=?").get(id)).status,
    "submitted",
  );
  await assert.rejects(
    async () =>
      await submitReport(
        db,
        assignee,
        id,
        { fileName: "report.pdf", contentType: "application/pdf", data },
        "test",
      ),
    { code: "INVALID_STATE" },
  );
  await assert.rejects(async () => await completeReport(db, assignee, id, "test"), {
    code: "FORBIDDEN",
  });
  await completeReport(db, admin, id, "test");
  await refreshReportReminders(db, assignee);
  assert.equal(
    (await db.prepare("SELECT status FROM report_requests WHERE id=?").get(id)).status,
    "completed",
  );
  assert.equal(
    (
      await db
        .prepare("SELECT count(*) AS n FROM audit_logs WHERE object_id=? AND feature='M08'")
        .get(id)
    ).n,
    3,
  );
});

test("lịch định kỳ sinh kỳ kế tiếp và chặn tạo trùng", async (t) => {
  const { db, user } = await fixture(t);
  const admin = await user("A05");
  const schedule = await createReportSchedule(
    db,
    admin,
    {
      reportTypeId: "BC-TYPE-WEEK",
      assigneeId: "DEMO-A04",
      recipient: "PC07",
      firstDueDate: "2026-11-05",
    },
    "test",
  );
  const generated = await generateReportPeriod(db, admin, schedule.id, "test");
  assert.equal(generated.dueDate, "2026-11-05");
  assert.equal(
    (await db.prepare("SELECT next_due_date FROM report_schedules WHERE id=?").get(schedule.id))
      .next_due_date,
    "2026-11-12",
  );
  assert.equal(
    (
      await db
        .prepare("SELECT count(*) AS n FROM report_requests WHERE schedule_id=?")
        .get(schedule.id)
    ).n,
    1,
  );
});

test("dropdown chỉ đưa người có quyền nộp; thông báo theo scope và đọc riêng", async (t) => {
  const { db, user } = await fixture(t);
  const admin = await user("A05"),
    viewer = await user("A06"),
    assignee = await user("A04");
  assert(!(await listReportAssignees(db, admin)).items.some((a) => a.id === viewer.id));
  const created = await createReportRequest(
    db,
    admin,
    {
      reportTypeId: "BC-TYPE-ADHOC",
      title: "Thông báo QA",
      recipient: "PC07",
      assigneeId: assignee.id,
      dueDate: businessDate(),
    },
    "test",
  );
  const url = new URL("http://localhost/api/notifications");
  const list = await listNotifications(db, assignee, url);
  const notification = list.items.find((n) => n.object_id === created.request.id);
  assert(notification);
  await assert.rejects(async () => await markNotificationRead(db, admin, notification.id), {
    code: "NOT_FOUND",
  });
  assert.equal((await markNotificationRead(db, assignee, notification.id)).read, true);
  assert((await markAllNotificationsRead(db, assignee)).updated >= 0);
  await db.prepare("DELETE FROM account_scopes WHERE account_id=?").run(assignee.id);
  assert(
    !(await listNotifications(db, { ...assignee, scopes: [] }, url)).items.some(
      (n) => n.object_id === created.request.id,
    ),
  );
});

test("API yêu cầu session và không lộ báo cáo ngoài phạm vi", async (t) => {
  const { db, user } = await fixture(t);
  const admin = await user("A05");
  const created = await createReportRequest(
    db,
    admin,
    {
      reportTypeId: "BC-TYPE-ADHOC",
      title: "Báo cáo riêng",
      recipient: "PC07",
      assigneeId: "DEMO-A04",
      dueDate: businessDate(),
    },
    "test",
  );
  const restricted = await user("A03");
  await assert.rejects(
    async () => {
      await db.prepare("DELETE FROM account_scopes WHERE account_id=?").run(restricted.id);
      await listReportRequests(
        db,
        { ...restricted, scopes: [] },
        new URL("http://localhost/api/reports/requests"),
      );
    },
    { code: "FORBIDDEN" },
  );
  const server = createApp(db, { appOrigin: "http://localhost:3000", logger: { error() {} } });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((done) => server.close(done)));
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/reports/requests/${created.request.id}`,
  );
  assert.equal(response.status, 401);
});
