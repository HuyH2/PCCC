import { writeAudit } from "../modules/audit/audit.service.js";

/** Demo-only case, inserted once without overwriting user changes. */
export function seedFacilityViolations(db) {
  const facility = db.prepare("SELECT * FROM facilities WHERE id='CS002'").get();
  if (!facility || facility.name !== "Cơ sở CS002 (dữ liệu mẫu)" || facility.status !== "active")
    return;
  if (db.prepare("SELECT 1 FROM facility_violations WHERE facility_id=?").get(facility.id)) return;
  const now = Date.now();
  const reason = "Hồ sơ đình chỉ giả lập phục vụ kiểm thử giao diện";
  const decisionReference = "QD-DEMO-CS002";
  db.prepare("UPDATE facilities SET status='suspended' WHERE id=?").run(facility.id);
  const auditId = writeAudit(db, {
    actorId: "DEMO-A05",
    feature: "M04",
    objectType: "facility",
    objectId: facility.id,
    action: "facility.status_changed",
    before: { status: "active" },
    after: { status: "suspended", reason, decisionReference },
    ip: "demo-seed",
  });
  db.prepare(
    `INSERT INTO facility_status_history
    (facility_id,previous_status,new_status,reason,decision_reference,actor_id,occurred_at,audit_log_id)
    VALUES (?,?,?,?,?,?,?,?)`,
  ).run(facility.id, "active", "suspended", reason, decisionReference, "DEMO-A05", now, auditId);
  db.prepare(
    `INSERT INTO facility_violations
    (facility_id,description,suspension_decision_reference,suspension_at,suspended_by)
    VALUES (?,?,?,?,?)`,
  ).run(facility.id, reason, decisionReference, now, "DEMO-A05");
}
