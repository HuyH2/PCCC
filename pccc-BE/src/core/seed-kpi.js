import { businessPeriod, previousPeriod } from "./time.js";

/** Demo KPI targets and one open explanation; never replaces configured targets. */
export function seedKpi(db) {
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
    if (!db.prepare("SELECT 1 FROM accounts WHERE id=?").get(accountId)) continue;
    db.prepare(
      `INSERT OR IGNORE INTO kpi_targets
      (account_id,period,target_tasks,note,created_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?)`,
    ).run(accountId, targetPeriod, targetTasks, "Chỉ tiêu mẫu cho demo", "DEMO-A05", now, now);
  }
  if (
    db.prepare("SELECT 1 FROM accounts WHERE id='DEMO-A01'").get() &&
    db.prepare("SELECT 1 FROM accounts WHERE id='DEMO-A03'").get()
  )
    db.prepare(
      `INSERT OR IGNORE INTO explanations
      (account_id,period,requested_by,reason,status,requested_at,seed_key)
      VALUES (?,?,?,?,'requested',?,?)`,
    ).run(
      "DEMO-A03",
      previous,
      "DEMO-A01",
      "Đề nghị giải trình phần chỉ tiêu còn thiếu kỳ trước (dữ liệu mẫu).",
      now,
      "kpi-demo-a03-previous",
    );
}
