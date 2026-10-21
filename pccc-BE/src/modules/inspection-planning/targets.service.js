import { randomUUID } from "node:crypto";
import { assert } from "../../core/errors.js";
import { object } from "../../core/validation.js";
import { transaction } from "../../core/database.js";
import { writeAudit } from "../audit/audit.service.js";
import { trimmed, integer, requirePlanning, requireRole, unitWithin } from "./planning.helpers.js";
import { scopedPlan } from "./planning.queries.js";

const ALLOCATION_ROLES = ["A01", "A02"];

// ---------------------------------------------------------------------------
// UC-INS-03 — allocate periodic inspection targets (month / week / officer / region)
// ---------------------------------------------------------------------------

export function createTarget(db, user, planId, payload, ip) {
  requirePlanning(user, "edit");
  requireRole(user, ALLOCATION_ROLES, "Chỉ Chỉ huy hoặc Phó chỉ huy được phân bổ chỉ tiêu.");
  object(payload, [
    "period_type",
    "month",
    "week",
    "officer_id",
    "region_id",
    "target_count",
    "parent_id",
  ]);
  const plan = scopedPlan(db, user, planId);
  assert(
    plan.status !== "closed",
    409,
    "INVALID_STATE",
    "Kế hoạch đã đóng không thể phân bổ thêm.",
  );
  const periodType = payload.period_type;
  assert(
    ["month", "week"].includes(periodType),
    400,
    "INVALID_INPUT",
    "Kỳ phân bổ phải là tháng hoặc tuần.",
  );
  const month = integer(payload.month, "Tháng", 1, 12);
  const week = periodType === "week" ? integer(payload.week, "Tuần", 1, 53) : null;
  const targetCount = integer(payload.target_count, "Chỉ tiêu", 1, 1000000);
  const officerId = payload.officer_id ? trimmed(payload.officer_id, "Cán bộ", 1, 100) : null;
  const regionId = payload.region_id ? trimmed(payload.region_id, "Địa bàn", 1, 100) : null;
  if (officerId) {
    const officer = db
      .prepare("SELECT * FROM officers WHERE id=? AND status='ACTIVE'")
      .get(officerId);
    assert(
      officer && unitWithin(db, officer.unit_id, plan.unit_id),
      400,
      "INVALID_INPUT",
      "Cán bộ không thuộc đơn vị của kế hoạch.",
    );
  }
  if (regionId) {
    const region = db.prepare("SELECT unit_id FROM regions WHERE id=?").get(regionId);
    assert(
      region && unitWithin(db, region.unit_id, plan.unit_id),
      400,
      "INVALID_INPUT",
      "Địa bàn không thuộc đơn vị của kế hoạch.",
    );
  }
  let parentId = payload.parent_id ?? null;
  if (parentId) {
    const parent = db
      .prepare("SELECT * FROM inspection_targets WHERE id=? AND plan_id=?")
      .get(parentId, planId);
    assert(parent, 400, "INVALID_INPUT", "Chỉ tiêu cha không hợp lệ.");
  }
  const aggregate = officerId == null && regionId == null;
  if (aggregate && periodType === "month") {
    const yearTarget = db
      .prepare("SELECT id FROM inspection_targets WHERE plan_id=? AND period_type='year'")
      .get(planId);
    assert(yearTarget, 409, "INVALID_STATE", "Kế hoạch chưa có chỉ tiêu năm.");
    assert(
      !parentId || parentId === yearTarget.id,
      400,
      "INVALID_INPUT",
      "Chỉ tiêu tháng phải thuộc chỉ tiêu năm.",
    );
    parentId = yearTarget.id;
    const existing = db
      .prepare(
        "SELECT coalesce(sum(target_count),0) AS n FROM inspection_targets WHERE plan_id=? AND period_type='month' AND officer_id IS NULL AND region_id IS NULL",
      )
      .get(planId).n;
    assert(
      existing + targetCount <= plan.annual_target,
      409,
      "TARGET_EXCEEDED",
      "Tổng chỉ tiêu tháng vượt chỉ tiêu năm.",
    );
  }
  if (aggregate && periodType === "week") {
    const monthTarget = db
      .prepare(
        "SELECT id,target_count FROM inspection_targets WHERE plan_id=? AND period_type='month' AND month=? AND officer_id IS NULL AND region_id IS NULL",
      )
      .get(planId, month);
    assert(
      monthTarget,
      409,
      "MISSING_PARENT_TARGET",
      "Cần phân bổ chỉ tiêu tháng trước khi phân bổ tuần.",
    );
    const existing = db
      .prepare(
        "SELECT coalesce(sum(target_count),0) AS n FROM inspection_targets WHERE plan_id=? AND period_type='week' AND month=? AND officer_id IS NULL AND region_id IS NULL",
      )
      .get(planId, month).n;
    assert(
      existing + targetCount <= monthTarget.target_count,
      409,
      "TARGET_EXCEEDED",
      "Tổng chỉ tiêu tuần vượt chỉ tiêu tháng.",
    );
    assert(
      !parentId || parentId === monthTarget.id,
      400,
      "INVALID_INPUT",
      "Chỉ tiêu tuần phải thuộc chỉ tiêu tháng tương ứng.",
    );
    parentId = monthTarget.id;
  }
  if (!aggregate) {
    assert(parentId, 400, "INVALID_INPUT", "Chỉ tiêu cán bộ/địa bàn phải thuộc một chỉ tiêu kỳ.");
    const parent = db
      .prepare("SELECT * FROM inspection_targets WHERE id=? AND plan_id=?")
      .get(parentId, planId);
    assert(
      parent && parent.period_type === periodType && parent.month === month && parent.week === week,
      400,
      "INVALID_INPUT",
      "Chỉ tiêu cha không cùng kỳ phân bổ.",
    );
    const existing = db
      .prepare(
        "SELECT coalesce(sum(target_count),0) AS n FROM inspection_targets WHERE parent_id=?",
      )
      .get(parentId).n;
    assert(
      existing + targetCount <= parent.target_count,
      409,
      "TARGET_EXCEEDED",
      "Tổng giao cho cán bộ/địa bàn vượt chỉ tiêu kỳ.",
    );
  }
  const duplicate = db
    .prepare(
      `SELECT 1 FROM inspection_targets WHERE plan_id=? AND period_type=? AND year=?
    AND coalesce(month,0)=? AND coalesce(week,0)=? AND coalesce(officer_id,'')=? AND coalesce(region_id,'')=?`,
    )
    .get(planId, periodType, plan.year, month, week ?? 0, officerId ?? "", regionId ?? "");
  assert(!duplicate, 409, "DUPLICATE", "Chỉ tiêu cho kỳ và đối tượng này đã tồn tại.");
  const id = randomUUID();
  const now = Date.now();
  return transaction(db, () => {
    db.prepare(
      `INSERT INTO inspection_targets(
      id,plan_id,parent_id,period_type,year,month,week,officer_id,region_id,target_count,
      created_by,updated_by,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      planId,
      parentId,
      periodType,
      plan.year,
      month,
      week,
      officerId,
      regionId,
      targetCount,
      user.id,
      user.id,
      now,
      now,
    );
    const target = db.prepare("SELECT * FROM inspection_targets WHERE id=?").get(id);
    writeAudit(db, {
      actorId: user.id,
      feature: "M06.planning",
      objectType: "inspection_target",
      objectId: id,
      action: "inspection_target.created",
      after: target,
      ip,
    });
    return target;
  });
}
