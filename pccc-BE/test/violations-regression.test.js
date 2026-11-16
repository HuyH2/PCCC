import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { openDatabase } from "../src/core/database.js";
import { seedDemo } from "../src/core/seed.js";
import {
  createViolation,
  updateViolation,
  createSuspension,
  updateSuspension,
  addRemediation,
  addEvidence,
  submitApproval,
  decideApproval,
  violationDetail,
} from "../src/core/violations.js";
import { updateFacilityStatus } from "../src/modules/facilities/facility-history.service.js";

const actor = {
  id: "DEMO-A05",
  role: "A05",
  scopes: [{ kind: "all" }],
  permissions: [
    "M04.view",
    "M04.create",
    "M04.edit",
    "M04.approve",
    "M03.view",
    "M03.edit",
    "M01.edit",
  ],
};
const payload = {
  facilityId: "CS001",
  type: "Vi phạm kiểm thử",
  severity: "Nhẹ",
  detectedOn: "2026-11-01",
  description: "Dữ liệu giả lập cho hồi quy",
  trackedOfficerId: "CB-A03",
};
const suspension = {
  decisionNumber: "TEST-QD",
  reason: "Lý do đình chỉ kiểm thử",
  issuedOn: "2026-11-01",
};
const restore = {
  status: "active",
  reason: "Khắc phục và phê duyệt kiểm thử",
  decisionReference: "TEST-RESTORE",
  remediationEvidence: "Hồ sơ khắc phục mẫu đã xác minh",
  approvalConfirmed: true,
};
async function createFixture(t) {
  const db = await openDatabase(":memory:");
  t.after(() => db.close());
  await seedDemo(db, randomBytes(24).toString("hex"));
  const createTestViolation = async () => (await createViolation(db, actor, payload)).id;
  const createPendingSuspension = async () => {
    const id = await createTestViolation();
    await createSuspension(db, actor, id, suspension);
    await addRemediation(db, actor, id, { note: "Đã khắc phục", progress: 100 });
    await addEvidence(db, actor, id, {
      fileName: "test.pdf",
      mediaType: "application/pdf",
      contentBase64: Buffer.from("%PDF-1.4\n%%EOF").toString("base64"),
    });
    await submitApproval(db, actor, id);
    return id;
  };
  const approveViolation = (id) => decideApproval(db, actor, id, {}, true);
  const status = async () =>
    (await db.prepare("SELECT status FROM facilities WHERE id='CS001'").get()).status;
  return { db, createTestViolation, createPendingSuspension, approveViolation, status };
}

test("closed suspensions cannot be edited; active cases retain editing and audit", async (t) => {
  const { db, createPendingSuspension, approveViolation } = await createFixture(t);
  const id = await createPendingSuspension();
  await updateSuspension(db, actor, id, { decisionNumber: "BEFORE-CLOSE" });
  await approveViolation(id);
  const before = await db.prepare("SELECT count(*) AS n FROM audit_logs WHERE object_id=?").get(id);
  await assert.rejects(updateSuspension(db, actor, id, { decisionNumber: "AFTER-CLOSE" }), {
    code: "INVALID_STATE",
  });
  assert.equal((await violationDetail(db, actor, id)).suspension.decision_number, "BEFORE-CLOSE");
  assert.deepEqual(
    await db.prepare("SELECT count(*) AS n FROM audit_logs WHERE object_id=?").get(id),
    before,
  );
});

test("unknown tracked officers rejected on create and update without changing data", async (t) => {
  const { db, createTestViolation } = await createFixture(t);
  await assert.rejects(createViolation(db, actor, { ...payload, trackedOfficerId: "MISSING" }), {
    code: "INVALID_OFFICER",
  });
  assert.equal((await db.prepare("SELECT count(*) AS n FROM violations").get()).n, 0);
  const id = await createTestViolation();
  await assert.rejects(
    updateViolation(db, actor, id, {
      trackedOfficerId: "MISSING",
      description: "Không được ghi một phần",
    }),
    { code: "INVALID_OFFICER" },
  );
  const details = await violationDetail(db, actor, id);
  assert.equal(details.violation.trackedOfficerId, "CB-A03");
  assert.equal(details.violation.description, payload.description);
  await updateViolation(db, actor, id, { trackedOfficerId: "CB-A01" });
  assert.equal((await violationDetail(db, actor, id)).violation.trackedOfficerId, "CB-A01");
});

test("both suspension sources must close before facility restoration", async (t) => {
  const { db, createPendingSuspension, approveViolation, status } = await createFixture(t);
  await updateFacilityStatus(db, actor, "CS001", {
    status: "suspended",
    reason: "Đình chỉ qua cơ sở",
    decisionReference: "TEST-LEGACY",
  });
  const id = await createPendingSuspension();
  await assert.rejects(updateFacilityStatus(db, actor, "CS001", restore), {
    code: "OPEN_SUSPENSION",
  });
  assert.equal(await status(), "suspended");
  assert.equal(
    (await db.prepare("SELECT status FROM facility_violations WHERE facility_id='CS001'").get())
      .status,
    "suspended",
  );
  await approveViolation(id);
  assert.equal(await status(), "suspended");
  await updateFacilityStatus(db, actor, "CS001", restore);
  assert.equal(await status(), "active");
  assert.equal(
    (await db.prepare("SELECT status FROM facility_violations WHERE facility_id='CS001'").get())
      .status,
    "restored",
  );
});

test("facility history records only actual transitions with linked audit and actors", async (t) => {
  const { db, createPendingSuspension, approveViolation, status } = await createFixture(t);
  const a = await createPendingSuspension(),
    b = await createPendingSuspension();
  await approveViolation(a);
  assert.equal(await status(), "suspended");
  await approveViolation(b);
  assert.equal(await status(), "active");
  const rows = await db
    .prepare(
      `SELECT h.*,l.feature,l.object_id FROM facility_status_history h JOIN audit_logs l ON l.id=h.audit_log_id WHERE h.facility_id='CS001' ORDER BY h.id`,
    )
    .all();
  assert.deepEqual(
    rows.map((r) => [r.previous_status, r.new_status]),
    [
      ["active", "suspended"],
      ["suspended", "active"],
    ],
  );
  assert.ok(
    rows.every(
      (r) =>
        r.actor_id === actor.id &&
        r.occurred_at > 0 &&
        r.reason &&
        r.decision_reference &&
        r.feature === "M04" &&
        r.object_id === "CS001",
    ),
  );
});

test("new suspension cycle restores current paused/unlicensed state rather than old active state", async (t) => {
  const { db, createPendingSuspension, approveViolation, status } = await createFixture(t);
  await approveViolation(await createPendingSuspension());
  for (const previous of ["paused", "unlicensed"]) {
    await updateFacilityStatus(db, actor, "CS001", {
      status: previous,
      reason: "Chu kỳ mới để kiểm thử",
    });
    const a = await createPendingSuspension(),
      b = await createPendingSuspension();
    await approveViolation(a);
    assert.equal(await status(), "suspended");
    await approveViolation(b);
    assert.equal(await status(), previous);
  }
});

test("failed facility audit rolls back suspension and approval atomically", async (t) => {
  const { db, createTestViolation, createPendingSuspension, approveViolation, status } =
    await createFixture(t);
  const id = await createTestViolation();
  const rejectAudit = () =>
    db.exec(
      "CREATE TRIGGER reject_m04_status_audit BEFORE INSERT ON audit_logs FOR EACH ROW WHEN (NEW.action='facility.status_changed') EXECUTE FUNCTION raise_abort('audit unavailable')",
    );
  await rejectAudit();
  await assert.rejects(createSuspension(db, actor, id, suspension));
  assert.equal(await status(), "active");
  assert.equal((await db.prepare("SELECT count(*) AS n FROM suspensions").get()).n, 0);
  await db.exec("DROP TRIGGER reject_m04_status_audit ON audit_logs");
  const pending = await createPendingSuspension();
  const before = await db
    .prepare("SELECT count(*) AS n FROM facility_status_history WHERE facility_id='CS001'")
    .get();
  await rejectAudit();
  await assert.rejects(approveViolation(pending));
  assert.equal(await status(), "suspended");
  assert.equal((await violationDetail(db, actor, pending)).violation.status, "pending_approval");
  assert.deepEqual(
    await db
      .prepare("SELECT count(*) AS n FROM facility_status_history WHERE facility_id='CS001'")
      .get(),
    before,
  );
});

test("new mutation checks retain permission and scope protections", async (t) => {
  const { db, createPendingSuspension } = await createFixture(t);
  const id = await createPendingSuspension();
  await assert.rejects(updateSuspension(db, { ...actor, permissions: [] }, id, suspension), {
    code: "FORBIDDEN",
  });
  await assert.rejects(updateSuspension(db, { ...actor, scopes: [] }, id, suspension), {
    code: "NOT_FOUND",
  });
  await assert.rejects(createViolation(db, { ...actor, permissions: [] }, payload), {
    code: "FORBIDDEN",
  });
  await assert.rejects(decideApproval(db, { ...actor, permissions: [] }, id, {}, true), {
    code: "FORBIDDEN",
  });
});
