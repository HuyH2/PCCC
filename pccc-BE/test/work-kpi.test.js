import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import { businessDate, businessPeriod, previousPeriod } from "../src/core/time.js";
import { createApp } from "../src/app.js";

const password = "Work-kpi-test-2026";
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

test("migration adds KPI, explanation, assignment and progress structures", async (t) => {
  const { db } = await fixture(t);
  const tables = (
    await db
      .prepare(
        "SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public'",
      )
      .all()
  ).map((row) => row.name);
  for (const table of [
    "task_assignments",
    "task_progress",
    "kpi_targets",
    "kpi_results",
    "explanations",
  ])
    assert.ok(tables.includes(table), `missing ${table}`);
  assert.equal(
    (await db.prepare("SELECT count(*) AS n FROM task_assignments WHERE ended_at IS NULL").get()).n,
    7,
  );
  assert.ok(
    (
      await db
        .prepare(
          "SELECT column_name AS name FROM information_schema.columns WHERE table_name='tasks'",
        )
        .all()
    ).some((column) => column.name === "completed_at"),
  );
});

test("task filters, completion and KPI debt/explanation flow", async (t) => {
  const { db, request, login } = await fixture(t);
  const commander = await login("demo.chi-huy");
  const deputy = await login("demo.to-truong");
  const officer = await login("demo.can-bo");
  const admin = await login("demo.admin");
  const today = businessDate();
  const period = businessPeriod();
  const previous = previousPeriod(period);

  const savedPrevious = await request("/api/kpi/targets", {
    method: "POST",
    cookie: admin,
    body: { accountId: "DEMO-A02", period: previous, targetTasks: 2 },
  });
  assert.equal(savedPrevious.status, 201);
  const savedCurrent = await request("/api/kpi/targets", {
    method: "POST",
    cookie: admin,
    body: { accountId: "DEMO-A02", period, targetTasks: 2 },
  });
  assert.equal(savedCurrent.status, 201);
  assert.equal(
    (
      await request("/api/kpi/targets", {
        method: "POST",
        cookie: admin,
        body: { accountId: "DEMO-A02", period: "2026-13", targetTasks: -1 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/kpi/targets", {
        method: "POST",
        cookie: officer,
        body: { accountId: "DEMO-A03", period, targetTasks: 1 },
      })
    ).status,
    403,
  );

  const createdIds = [];
  for (const title of ["Việc KPI một", "Việc KPI hai"]) {
    const created = await request("/api/tasks", {
      method: "POST",
      cookie: commander,
      body: {
        title,
        description: "Kiểm tra luồng công việc và KPI",
        kind: "assigned",
        dueDate: today,
        assigneeId: "DEMO-A02",
      },
    });
    assert.equal(created.status, 201);
    createdIds.push(created.data.task.id);
    assert.equal(
      (
        await db
          .prepare(
            "SELECT count(*) AS n FROM task_assignments WHERE task_id=? AND ended_at IS NULL",
          )
          .get(created.data.task.id)
      ).n,
      1,
    );
  }

  const mine = await request("/api/tasks?view=mine&status=open", { cookie: deputy });
  assert.equal(mine.status, 200);
  assert.ok(createdIds.every((id) => mine.data.items.some((task) => task.id === id)));
  assert.equal((await request("/api/tasks/mine?status=open", { cookie: deputy })).status, 200);
  const assigned = await request(`/api/tasks/assigned?from=${today}&to=${today}&status=open`, {
    cookie: commander,
  });
  assert.equal(assigned.status, 200);
  assert.ok(createdIds.every((id) => assigned.data.items.some((task) => task.id === id)));
  assert.equal((await request("/api/tasks?from=2026-13-01", { cookie: commander })).status, 400);

  for (const id of createdIds) {
    assert.equal(
      (
        await request(`/api/tasks/${id}/status`, {
          method: "PUT",
          cookie: deputy,
          body: { status: "cancelled" },
        })
      ).status,
      403,
    );
    const completed = await request(`/api/tasks/${id}/status`, {
      method: "PUT",
      cookie: deputy,
      body: { status: "completed" },
    });
    assert.equal(completed.status, 200);
    assert.equal(completed.data.task.status, "completed");
    assert.equal(completed.data.task.progress, 100);
    assert.ok(completed.data.task.completed_at);
    const history = await request(`/api/tasks/${id}/progress-history`, { cookie: deputy });
    assert.equal(history.status, 200);
    assert.equal(history.data.total, 1);
    assert.equal(history.data.items[0].after.progress, 100);
  }
  const filtered = await request(
    `/api/tasks?view=assigned&status=completed&from=${today}&to=${today}`,
    {
      cookie: commander,
    },
  );
  assert.ok(createdIds.every((id) => filtered.data.items.some((task) => task.id === id)));

  const personal = await request(`/api/kpi/results?period=${period}&accountId=DEMO-A02`, {
    cookie: deputy,
  });
  assert.equal(personal.status, 200);
  assert.equal(personal.data.items.length, 1);
  assert.equal(personal.data.items[0].account_id, "DEMO-A02");
  assert.equal(personal.data.items[0].target_tasks, 2);
  assert.equal(personal.data.items[0].completed_tasks, 2);
  assert.equal(personal.data.items[0].previous_debt, 2);
  assert.equal(personal.data.items[0].debt, 2);
  assert.equal(personal.data.items[0].score, 50);

  const team = await request(`/api/kpi/results?period=${period}`, { cookie: commander });
  assert.equal(team.status, 200);
  assert.ok(team.data.items.length > 1);
  assert.ok(team.data.items.some((row) => row.account_id === "DEMO-A02"));
  const officerView = await request(`/api/kpi/results?period=${period}`, { cookie: officer });
  assert.equal(officerView.status, 200);
  assert.deepEqual(
    officerView.data.items.map((row) => row.account_id),
    ["DEMO-A03"],
  );

  const requested = await request("/api/explanations", {
    method: "POST",
    cookie: commander,
    body: {
      accountId: "DEMO-A02",
      period,
      reason: "Đề nghị giải trình phần chỉ tiêu còn thiếu.",
    },
  });
  assert.equal(requested.status, 201);
  const explanationId = requested.data.explanation.id;
  assert.equal(requested.data.explanation.status, "requested");
  assert.equal(
    (
      await request(`/api/explanations/${explanationId}/review`, {
        method: "PUT",
        cookie: commander,
        body: { decision: "accepted" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/api/explanations", {
        method: "POST",
        cookie: officer,
        body: { accountId: "DEMO-A03", period, reason: "Không có quyền" },
      })
    ).status,
    403,
  );
  const submitted = await request(`/api/explanations/${explanationId}/response`, {
    method: "PUT",
    cookie: deputy,
    body: { response: "Đã hoàn thành các việc được giao, đề nghị xem xét." },
  });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.data.explanation.status, "submitted");
  const reviewed = await request(`/api/explanations/${explanationId}/review`, {
    method: "PUT",
    cookie: commander,
    body: { decision: "accepted", note: "Chấp nhận." },
  });
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.data.explanation.status, "accepted");
  assert.equal(reviewed.data.explanation.debt_waived, 1);

  const taskExplanation = await request("/api/explanations", {
    method: "POST",
    cookie: commander,
    body: {
      accountId: "DEMO-A02",
      taskId: createdIds[0],
      reason: "Đề nghị giải trình tiến độ công việc cụ thể.",
    },
  });
  assert.equal(taskExplanation.status, 201);
  assert.equal(taskExplanation.data.explanation.task_id, createdIds[0]);
  assert.equal(taskExplanation.data.explanation.period, null);

  const waived = await request(`/api/kpi/results?period=${period}&accountId=DEMO-A02`, {
    cookie: commander,
  });
  assert.equal(waived.status, 200);
  assert.equal(waived.data.items[0].debt, 0);
  assert.equal(waived.data.items[0].waived_debt, 2);
  const debt = await request(`/api/kpi/debt?period=${period}&accountId=DEMO-A02`, {
    cookie: commander,
  });
  assert.equal(debt.status, 200);
  assert.equal(debt.data.items[0].debt, 0);
});
