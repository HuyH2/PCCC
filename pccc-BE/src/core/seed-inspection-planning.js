import { writeAudit } from "../modules/audit/audit.service.js";

// DEMO ONLY. Targets are illustrative and do not encode the unconfirmed Q08/Q09 rules.
export async function seedInspectionPlanning(db) {
  const now = Date.now();
  const planId = "DEMO-PLAN-2026";
  if (!(await db.prepare("SELECT 1 FROM inspection_plans WHERE id=?").get(planId))) {
    await db
      .prepare(
        `INSERT INTO inspection_plans(
        id,code,year,title,facility_group,legal_basis,unit_id,annual_target,status,
        created_by,updated_by,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        planId,
        "KHKT-2026-KV10",
        2026,
        "Kế hoạch kiểm tra PCCC năm 2026 (mẫu)",
        "Cơ sở thuộc diện quản lý (mẫu)",
        "Căn cứ giả lập phục vụ demo, không có giá trị pháp lý",
        "DV-KV10",
        24,
        "published",
        "DEMO-A02",
        "DEMO-A02",
        now,
        now,
      );
    const targets = [
      ["DEMO-TARGET-YEAR", null, "year", null, null, null, 24],
      ["DEMO-TARGET-M10", "DEMO-TARGET-YEAR", "month", 10, null, null, 4],
      ["DEMO-TARGET-W42", "DEMO-TARGET-M10", "week", 10, 42, null, 2],
      ["DEMO-TARGET-A03", "DEMO-TARGET-W42", "week", 10, 42, "CB-A03", 2],
    ];
    for (const [id, parentId, periodType, month, week, officerId, count] of targets) {
      await db
        .prepare(
          `INSERT INTO inspection_targets(
          id,plan_id,parent_id,period_type,year,month,week,officer_id,target_count,
          created_by,updated_by,created_at,updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          id,
          planId,
          parentId,
          periodType,
          2026,
          month,
          week,
          officerId,
          count,
          "DEMO-A02",
          "DEMO-A02",
          now,
          now,
        );
    }
    await writeAudit(db, {
      actorId: "DEMO-A02",
      feature: "M06.planning",
      objectType: "inspection_plan",
      objectId: planId,
      action: "inspection_plan.seeded",
      after: { id: planId, code: "KHKT-2026-KV10", demo: true },
      ip: "seed",
    });
  }

  // Migration backfill runs before demo inspections are inserted; keep the shared calendar complete.
  await db
    .prepare(
      `INSERT INTO inspection_schedules(
      id,inspection_id,scheduled_date,location,status,version,
      created_by,updated_by,created_at,updated_at
    )
    SELECT 'SCHED-' || id,id,scheduled_date,'','scheduled',1,
      created_by,updated_by,created_at,updated_at
    FROM inspections ON CONFLICT DO NOTHING`,
    )
    .run();
}
