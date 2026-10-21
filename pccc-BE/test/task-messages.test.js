import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { createApp } from "../src/app.js";

const password = "Task-messages-test-2026";
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

test("seed creates real tasks and a message once without replacing a conversation", async (t) => {
  const { db, request, login } = await fixture(t);
  const commander = await login("demo.chi-huy");
  assert.equal((await request("/api/tasks")).status, 401);
  const tasks = await request("/api/tasks", { cookie: commander });
  assert.equal(tasks.status, 200);
  assert.deepEqual(
    tasks.data.items.map((task) => task.id),
    ["CV-DEMO-07", "CV-DEMO-06", "CV-DEMO-01"],
  );
  const messages = await request("/api/tasks/CV-DEMO-01/messages", { cookie: commander });
  assert.equal(messages.data.total, 1);
  assert.equal(messages.data.items[0].sender_username, "demo.chi-huy");
  const admin = await login("demo.admin");
  const sampleConversation = await request("/api/tasks/CV-DEMO-02/messages", { cookie: admin });
  assert.equal(sampleConversation.status, 200);
  assert.equal(sampleConversation.data.total, 2);
  assert.deepEqual(
    sampleConversation.data.items.map((message) => message.sender_username),
    ["demo.admin", "demo.tong-hop"],
  );
  await seedDemo(db, password);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM tasks").get()).n, 7);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM task_messages").get()).n, 13);
  await db
    .prepare("DELETE FROM role_permissions WHERE role_code='A03' AND permission_code='M07.edit'")
    .run();
  await seedDemo(db, password);
  assert.equal(
    (
      await db
        .prepare(
          "SELECT count(*) AS n FROM role_permissions WHERE role_code='A03' AND permission_code='M07.edit'",
        )
        .get()
    ).n,
    0,
  );
});

test("re-seed backfills only untouched pre-progress demo tasks", async (t) => {
  const { db } = await fixture(t);
  await db
    .prepare("UPDATE tasks SET progress=0,due_at=NULL,updated_at=NULL WHERE id='CV-DEMO-02'")
    .run();
  await db
    .prepare("UPDATE tasks SET progress=0,due_at=NULL,updated_at=123 WHERE id='CV-DEMO-01'")
    .run();
  await seedDemo(db, password);
  const legacy = await db
    .prepare("SELECT progress,due_at,updated_at FROM tasks WHERE id='CV-DEMO-02'")
    .get();
  assert.equal(legacy.progress, 60);
  assert.ok(legacy.due_at > Date.now());
  assert.ok(legacy.updated_at > 123);
  const edited = await db
    .prepare("SELECT progress,due_at,updated_at FROM tasks WHERE id='CV-DEMO-01'")
    .get();
  assert.equal(edited.progress, 0);
  assert.equal(edited.due_at, null);
  assert.equal(edited.updated_at, 123);
});

test("only task participants can read and exchange messages; input and paging are bounded", async (t) => {
  const { db, request, login } = await fixture(t);
  const commander = await login("demo.chi-huy");
  const officer = await login("demo.can-bo");
  const admin = await login("demo.admin");
  const viewer = await login("demo.nguoi-xem");
  const path = "/api/tasks/CV-DEMO-01/messages";
  assert.equal((await request("/api/tasks", { cookie: viewer })).status, 403);
  assert.equal((await request(path, { cookie: admin })).status, 404);
  assert.equal(
    (await request(path, { method: "POST", cookie: admin, body: { body: "Ngoài phạm vi" } }))
      .status,
    404,
  );
  assert.equal(
    (await request(path, { method: "POST", cookie: officer, body: { body: "   " } })).status,
    400,
  );
  assert.equal(
    (await request(path, { method: "POST", cookie: officer, body: { body: "x".repeat(2001) } }))
      .status,
    400,
  );
  assert.equal((await request(`${path}?page=0`, { cookie: officer })).status, 400);
  const sent = await request(path, {
    method: "POST",
    cookie: officer,
    body: { body: "  Đã tiếp nhận công việc  " },
  });
  assert.equal(sent.status, 201);
  assert.equal(sent.data.message.body, "Đã tiếp nhận công việc");
  assert.equal(sent.data.message.sender_name, "Cán bộ kiểm tra/Quản lý địa bàn (mẫu)");
  const received = await request(path, { cookie: commander });
  assert.equal(received.data.total, 2);
  assert.equal(received.data.items.at(-1).id, sent.data.message.id);
  for (let i = 0; i < 22; i++)
    await db
      .prepare("INSERT INTO task_messages(task_id,sender_id,body,created_at) VALUES (?,?,?,?)")
      .run("CV-DEMO-01", "DEMO-A03", `Tin mẫu ${i}`, Date.now() + i);
  const newest = await request(`${path}?page=1&pageSize=20`, { cookie: officer });
  const older = await request(`${path}?page=2&pageSize=20`, { cookie: officer });
  assert.equal(newest.data.total, 24);
  assert.equal(newest.data.items.length, 20);
  assert.equal(older.data.items.length, 4);
  assert.equal(newest.data.items.at(-1).body, "Tin mẫu 21");
  assert.equal(older.data.items[0].sender_username, "demo.chi-huy");
});

test("author can edit and soft-delete, others cannot; closed tasks reject mutations", async (t) => {
  const { db, request, login } = await fixture(t);
  const officer = await login("demo.can-bo");
  const commander = await login("demo.chi-huy");
  const path = "/api/tasks/CV-DEMO-01/messages";
  const sent = await request(path, { method: "POST", cookie: officer, body: { body: "Bản đầu" } });
  const id = sent.data.message.id;
  assert.equal(
    (
      await request(`${path}/${id}`, {
        method: "PUT",
        cookie: commander,
        body: { body: "Sửa trái phép" },
      })
    ).status,
    403,
  );
  const edited = await request(`${path}/${id}`, {
    method: "PUT",
    cookie: officer,
    body: { body: "Bản đã sửa" },
  });
  assert.equal(edited.status, 200);
  assert(edited.data.message.edited_at);
  assert.equal(
    (await request(`${path}/${id}`, { method: "DELETE", cookie: commander })).status,
    403,
  );
  assert.equal((await request(`${path}/${id}`, { method: "DELETE", cookie: officer })).status, 200);
  const visible = await request(path, { cookie: commander });
  const deleted = visible.data.items.find((message) => message.id === id);
  assert.equal(deleted.body, null);
  assert(deleted.deleted_at);
  assert.equal(
    (await db.prepare("SELECT body FROM task_messages WHERE id=?").get(id)).body,
    "Bản đã sửa",
  );
  assert.equal(
    (await request(`${path}/${id}`, { method: "PUT", cookie: officer, body: { body: "Sửa lại" } }))
      .status,
    409,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT count(*) AS n FROM audit_logs WHERE action LIKE 'task_message.%'")
        .get()
    ).n,
    3,
  );
  await db.prepare("UPDATE tasks SET status='completed' WHERE id='CV-DEMO-01'").run();
  assert.equal(
    (await request(path, { method: "POST", cookie: officer, body: { body: "Sau đóng" } })).status,
    409,
  );
  assert.equal((await request(path, { cookie: officer })).status, 200);
});

test("audit failure rolls back message creation", async (t) => {
  const { db, request, login } = await fixture(t);
  const officer = await login("demo.can-bo");
  const previous = (await db.prepare("SELECT count(*) AS n FROM task_messages").get()).n;
  await db.exec(
    `CREATE TRIGGER reject_task_audit BEFORE INSERT ON audit_logs FOR EACH ROW WHEN (NEW.action='task_message.sent') EXECUTE FUNCTION raise_abort('audit unavailable')`,
  );
  const result = await request("/api/tasks/CV-DEMO-01/messages", {
    method: "POST",
    cookie: officer,
    body: { body: "Không lưu dở dang" },
  });
  assert.equal(result.status, 500);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM task_messages").get()).n, previous);
});

test("an assigned account with no active data scope cannot read its task", async (t) => {
  const { db, request, login } = await fixture(t);
  const officer = await login("demo.can-bo");
  await db.prepare("DELETE FROM account_scopes WHERE account_id='DEMO-A03'").run();
  assert.equal((await request("/api/tasks", { cookie: officer })).status, 403);
  assert.equal((await request("/api/tasks/CV-DEMO-01/messages", { cookie: officer })).status, 403);
});

test("commander assigns a scoped task; assignee updates durable progress and history", async (t) => {
  const { db, request, login } = await fixture(t);
  const commander = await login("demo.chi-huy");
  const officer = await login("demo.can-bo");
  const admin = await login("demo.admin");
  assert.equal((await request("/api/tasks/assignees")).status, 401);
  const assignees = await request("/api/tasks/assignees", { cookie: commander });
  assert.equal(assignees.status, 200);
  assert.ok(assignees.data.items.some((person) => person.id === "DEMO-A03"));
  const created = await request("/api/tasks", {
    method: "POST",
    cookie: commander,
    body: {
      title: "Rà soát công việc",
      description: "Kiểm tra hồ sơ",
      kind: "assigned",
      dueDate: "2027-03-15",
      assigneeId: "DEMO-A03",
    },
  });
  assert.equal(created.status, 201);
  const id = created.data.task.id;
  assert.equal(created.data.task.progress, 0);
  assert.equal((await request(`/api/tasks/${id}`, { cookie: officer })).status, 200);
  assert.equal((await request(`/api/tasks/${id}`, { cookie: admin })).status, 404);
  assert.equal(
    (
      await request(`/api/tasks/${id}/progress`, {
        method: "PUT",
        cookie: commander,
        body: { progress: 50 },
      })
    ).status,
    403,
  );
  const updated = await request(`/api/tasks/${id}/progress`, {
    method: "PUT",
    cookie: officer,
    body: { progress: 50, note: "Đã rà soát một nửa" },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.task.progress, 50);
  assert.equal((await db.prepare("SELECT progress FROM tasks WHERE id=?").get(id)).progress, 50);
  const history = await request(`/api/tasks/${id}/progress-history`, { cookie: commander });
  assert.equal(history.data.total, 1);
  assert.equal(history.data.items[0].after.note, "Đã rà soát một nửa");
  assert.equal((await request(`/api/tasks/${id}/progress-history`, { cookie: admin })).status, 404);
  assert.equal(
    (
      await db
        .prepare("SELECT count(*) AS n FROM audit_logs WHERE object_id=? AND action LIKE 'task.%'")
        .get(id)
    ).n,
    2,
  );
});

test("assignment rejects unprivileged, out-of-scope and invalid changes", async (t) => {
  const { db, request, login } = await fixture(t);
  const commander = await login("demo.chi-huy");
  const officer = await login("demo.can-bo");
  const body = {
    title: "Công việc",
    description: "Nội dung",
    kind: "assigned",
    dueDate: "2027-03-15",
    assigneeId: "DEMO-A03",
  };
  assert.equal(
    (await request("/api/tasks", { method: "POST", cookie: officer, body })).status,
    403,
  );
  assert.equal(
    (
      await request("/api/tasks", {
        method: "POST",
        cookie: commander,
        body: { ...body, dueDate: "2027-02-31" },
      })
    ).status,
    400,
  );
  await db
    .prepare("INSERT INTO units(id,name,code) VALUES ('DV-OTHER','Đơn vị khác','DV-OTHER')")
    .run();
  await db
    .prepare("UPDATE account_scopes SET unit_id='DV-OTHER' WHERE account_id='DEMO-A04'")
    .run();
  assert.equal(
    (
      await request("/api/tasks", {
        method: "POST",
        cookie: commander,
        body: { ...body, assigneeId: "DEMO-A04" },
      })
    ).status,
    403,
  );
  const created = await request("/api/tasks", { method: "POST", cookie: commander, body });
  assert.equal(created.status, 201);
  const id = created.data.task.id;
  assert.equal(
    (
      await request(`/api/tasks/${id}/progress`, {
        method: "PUT",
        cookie: officer,
        body: { progress: 101 },
      })
    ).status,
    400,
  );
  await db.prepare("DELETE FROM account_scopes WHERE account_id='DEMO-A03'").run();
  assert.equal(
    (
      await request(`/api/tasks/${id}/progress`, {
        method: "PUT",
        cookie: officer,
        body: { progress: 10 },
      })
    ).status,
    403,
  );
});

test("task progress rolls back when audit logging fails", async (t) => {
  const { db, request, login } = await fixture(t);
  const officer = await login("demo.can-bo");
  const initial = (await db.prepare("SELECT progress FROM tasks WHERE id='CV-DEMO-01'").get())
    .progress;
  await db.exec(
    `CREATE TRIGGER reject_progress_audit BEFORE INSERT ON audit_logs FOR EACH ROW WHEN (NEW.action='task.progress_updated') EXECUTE FUNCTION raise_abort('audit unavailable')`,
  );
  const result = await request("/api/tasks/CV-DEMO-01/progress", {
    method: "PUT",
    cookie: officer,
    body: { progress: 70, note: "Cập nhật thử" },
  });
  assert.equal(result.status, 500);
  assert.equal(
    (await db.prepare("SELECT progress FROM tasks WHERE id='CV-DEMO-01'").get()).progress,
    initial,
  );
});
