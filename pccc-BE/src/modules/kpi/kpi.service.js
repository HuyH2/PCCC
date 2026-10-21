import { assert } from "../../core/errors.js";
import { transaction } from "../../core/database.js";
import { object, text } from "../../core/validation.js";
import { businessPeriod, periodRange, validPeriod } from "../../core/time.js";
import { accountScope, requirePermission } from "../authorization/authorization.service.js";
import { writeAudit } from "../audit/audit.service.js";

function requireKpiView(user) {
  requirePermission(user, "M07.view");
  assert(user.scopes.length > 0, 403, "FORBIDDEN", "Tài khoản chưa có phạm vi quản lý.");
}

function canManage(user) {
  return ["A01", "A02", "A05"].includes(user.role) && user.permissions.includes("M07.edit");
}

function visibleAccounts(db, user) {
  if (!canManage(user)) {
    return db
      .prepare(
        "SELECT id,full_name,username,role_code FROM accounts WHERE id=? AND status='active'",
      )
      .all(user.id);
  }
  const scope = accountScope(user);
  return db
    .prepare(
      `SELECT a.id,a.full_name,a.username,a.role_code
      FROM accounts a
      JOIN role_permissions rp ON rp.role_code=a.role_code AND rp.permission_code='M07.view'
      WHERE a.status='active' AND EXISTS
        (SELECT 1 FROM account_scopes s WHERE s.account_id=a.id) AND ${scope.sql}
      ORDER BY a.full_name,a.id`,
    )
    .all(...scope.params);
}

function periodFrom(url) {
  const value = url.searchParams.get("period") || businessPeriod();
  assert(validPeriod(value), 400, "INVALID_INPUT", "Kỳ KPI phải có dạng YYYY-MM.");
  return value;
}

function targetFor(db, accountId, period) {
  return db
    .prepare("SELECT * FROM kpi_targets WHERE account_id=? AND period=?")
    .get(accountId, period);
}

function debtWaived(db, accountId, period) {
  return Boolean(
    db
      .prepare(
        `SELECT 1 FROM explanations
        WHERE account_id=? AND period=? AND status='accepted' AND debt_waived=1 LIMIT 1`,
      )
      .get(accountId, period),
  );
}

function calculate(db, accountId, period) {
  const periods = db
    .prepare("SELECT period FROM kpi_targets WHERE account_id=? AND period<=? ORDER BY period")
    .all(accountId, period)
    .map((row) => row.period);
  if (periods.length === 0) {
    return {
      account_id: accountId,
      period,
      target_tasks: 0,
      completed_tasks: 0,
      previous_debt: 0,
      debt: 0,
      waived_debt: 0,
      score: 0,
      configured: false,
    };
  }
  let previousDebt = 0;
  let last = null;
  for (const targetPeriod of periods) {
    const target = targetFor(db, accountId, targetPeriod);
    if (!target) continue;
    const range = periodRange(targetPeriod);
    const completed = db
      .prepare(
        `SELECT count(*) AS n FROM tasks
        WHERE assigned_to=? AND status='completed' AND completed_at>=? AND completed_at<?`,
      )
      .get(accountId, range.start, range.end).n;
    const available = target.target_tasks + previousDebt;
    const rawDebt = Math.max(0, available - completed);
    const waived = debtWaived(db, accountId, targetPeriod);
    const debt = waived ? 0 : rawDebt;
    const score = available === 0 ? 100 : Math.min(100, Math.round((completed / available) * 100));
    last = {
      account_id: accountId,
      period: targetPeriod,
      target_tasks: target.target_tasks,
      completed_tasks: completed,
      previous_debt: previousDebt,
      debt,
      waived_debt: waived ? rawDebt : 0,
      score,
      configured: true,
    };
    db.prepare(
      `INSERT INTO kpi_results
      (account_id,period,target_tasks,completed_tasks,previous_debt,debt,waived_debt,score,computed_at)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(account_id,period) DO UPDATE SET
        target_tasks=excluded.target_tasks,completed_tasks=excluded.completed_tasks,
        previous_debt=excluded.previous_debt,debt=excluded.debt,
        waived_debt=excluded.waived_debt,score=excluded.score,computed_at=excluded.computed_at`,
    ).run(
      accountId,
      targetPeriod,
      target.target_tasks,
      completed,
      previousDebt,
      debt,
      waived ? rawDebt : 0,
      score,
      Date.now(),
    );
    previousDebt = debt;
    if (targetPeriod === period) return last;
  }
  if (last && last.period !== period) {
    return {
      ...last,
      period,
      target_tasks: 0,
      completed_tasks: 0,
      previous_debt: previousDebt,
      debt: previousDebt,
      waived_debt: 0,
      score: 0,
      configured: false,
    };
  }
  return last;
}

function accountFilter(db, user, requestedId) {
  const accounts = visibleAccounts(db, user);
  if (requestedId) {
    const account = accounts.find((item) => item.id === requestedId);
    assert(account, 403, "FORBIDDEN", "Tài khoản ngoài phạm vi KPI.");
    return [account];
  }
  return accounts;
}

export function listKpiResults(db, user, url) {
  requireKpiView(user);
  const period = periodFrom(url);
  const requestedId = url.searchParams.get("accountId") || "";
  const accounts = accountFilter(db, user, requestedId);
  const items = accounts.map((account) => ({
    ...account,
    ...calculate(db, account.id, period),
    full_name: account.full_name,
  }));
  return { period, items };
}

export function listKpiTargets(db, user, url) {
  requireKpiView(user);
  const period = periodFrom(url);
  const requestedId = url.searchParams.get("accountId") || "";
  const accounts = accountFilter(db, user, requestedId);
  const ids = accounts.map((account) => account.id);
  if (ids.length === 0) return { period, items: [] };
  const placeholders = ids.map(() => "?").join(",");
  const items = db
    .prepare(
      `SELECT k.*,a.full_name,a.username,a.role_code
      FROM kpi_targets k JOIN accounts a ON a.id=k.account_id
      WHERE k.period=? AND k.account_id IN (${placeholders})
      ORDER BY a.full_name,a.id`,
    )
    .all(period, ...ids);
  return { period, items };
}

export function saveKpiTarget(db, user, input, ip) {
  requireKpiView(user);
  assert(canManage(user), 403, "FORBIDDEN", "Bạn không có quyền cấu hình chỉ tiêu KPI.");
  object(input, ["accountId", "period", "targetTasks", "note"]);
  const accountId = text(input.accountId, "Tài khoản", 1, 100);
  const period = text(input.period, "Kỳ KPI", 7, 7);
  assert(validPeriod(period), 400, "INVALID_INPUT", "Kỳ KPI phải có dạng YYYY-MM.");
  assert(
    Number.isInteger(input.targetTasks) && input.targetTasks >= 0 && input.targetTasks <= 10000,
    400,
    "INVALID_INPUT",
    "Chỉ tiêu phải là số nguyên từ 0 đến 10000.",
  );
  const note =
    input.note === undefined
      ? ""
      : text(typeof input.note === "string" ? input.note.trim() : input.note, "Ghi chú", 0, 1000);
  const account = visibleAccounts(db, user).find((item) => item.id === accountId);
  assert(account, 403, "FORBIDDEN", "Tài khoản ngoài phạm vi KPI.");
  return transaction(db, () => {
    const now = Date.now();
    db.prepare(
      `INSERT INTO kpi_targets(account_id,period,target_tasks,note,created_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(account_id,period) DO UPDATE SET
        target_tasks=excluded.target_tasks,note=excluded.note,updated_at=excluded.updated_at`,
    ).run(accountId, period, input.targetTasks, note, user.id, now, now);
    writeAudit(db, {
      actorId: user.id,
      feature: "M07",
      objectType: "kpi_target",
      objectId: `${accountId}:${period}`,
      action: "kpi.target_saved",
      after: { accountId, period, targetTasks: input.targetTasks, note },
      ip,
    });
    return {
      target: db
        .prepare("SELECT * FROM kpi_targets WHERE account_id=? AND period=?")
        .get(accountId, period),
    };
  });
}

export function kpiDebt(db, user, url) {
  const result = listKpiResults(db, user, url);
  return {
    period: result.period,
    items: result.items.map((item) => ({
      account_id: item.account_id,
      full_name: item.full_name,
      debt: item.debt,
      previous_debt: item.previous_debt,
      waived_debt: item.waived_debt,
      configured: item.configured,
    })),
  };
}
