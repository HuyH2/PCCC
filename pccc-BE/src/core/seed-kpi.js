import { businessPeriod, previousPeriod } from "./time.js";

/** Demo KPI targets and one open explanation; never replaces configured targets. */
export async function seedKpi(db) {
  const period = businessPeriod();
  const previous = previousPeriod(period);
  const targets = [
    ["DEMO-A01", previous, 3],
    ["DEMO-A01", period, 4],
    ["DEMO-A02", period, 4],
    ["DEMO-A03", previous, 3],
    ["DEMO-A03", period, 5],
    ["DEMO-A04", period, 4],
    ["DEMO-A05", period, 3],
  ];
  const now = Date.now();
  for (const [accountId, targetPeriod, targetTasks] of targets) {
    if (!(await db.prepare("SELECT 1 FROM accounts WHERE id=?").get(accountId))) continue;
    await db
      .prepare(
        `INSERT INTO kpi_targets
      (account_id,period,target_tasks,note,created_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
      )
      .run(accountId, targetPeriod, targetTasks, "Chỉ tiêu mẫu cho demo", "DEMO-A05", now, now);
  }
  if (
    (await db.prepare("SELECT 1 FROM accounts WHERE id='DEMO-A01'").get()) &&
    (await db.prepare("SELECT 1 FROM accounts WHERE id='DEMO-A03'").get())
  )
    await db
      .prepare(
        `INSERT INTO explanations
      (account_id,period,requested_by,reason,status,requested_at,seed_key)
      VALUES (?,?,?,?,'requested',?,?) ON CONFLICT DO NOTHING`,
      )
      .run(
        "DEMO-A03",
        previous,
        "DEMO-A01",
        "Đề nghị giải trình phần chỉ tiêu còn thiếu kỳ trước (dữ liệu mẫu).",
        now,
        "kpi-demo-a03-previous",
      );
}
