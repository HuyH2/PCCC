import { randomUUID } from "node:crypto";
import { assert } from "../../core/errors.js";
import { object, pagination, text } from "../../core/validation.js";
import { transaction } from "../../core/database.js";
import { businessDate } from "../../core/time.js";
import { requireAdministrator } from "../authorization/authorization.service.js";
import { writeAudit } from "../audit/audit.service.js";
import { preserveAdministrator } from "./administration.service.js";

async function account(db, id) {
  const row = await db
    .prepare(
      `SELECT a.id,a.username,a.full_name,a.officer_id,a.role_code,a.status,r.enabled
    FROM accounts a JOIN roles r ON r.code=a.role_code WHERE a.id=?`,
    )
    .get(id);
  assert(row, 404, "NOT_FOUND", "Không tìm thấy tài khoản.");
  return row;
}

async function uniqueOfficer(db, officerId) {
  assert(
    (await db.prepare("SELECT count(*) AS n FROM accounts WHERE officer_id=?").get(officerId)).n ===
      1,
    409,
    "AMBIGUOUS_OFFICER",
    "Mã cán bộ đang gắn nhiều tài khoản; cần xử lý trước khi chuyển giao.",
  );
}

export async function changeAccountStatus(db, principal, id, action, ip) {
  requireAdministrator(principal);
  assert(action === "lock" || action === "unlock", 400, "INVALID_INPUT", "Thao tác không hợp lệ.");
  return await transaction(db, async () => {
    const before = await account(db, id);
    assert(id !== principal.id, 409, "SELF_LOCK", "Không thể khóa tài khoản đang thực hiện.");
    const expected = action === "lock" ? "active" : "locked";
    assert(
      before.status === expected,
      409,
      "ACCOUNT_STATUS_CONFLICT",
      "Trạng thái tài khoản đã thay đổi.",
    );
    const status = action === "lock" ? "locked" : "active";
    await db
      .prepare("UPDATE accounts SET status=? WHERE id=? AND status=?")
      .run(status, id, expected);
    if (action === "lock") {
      await preserveAdministrator(db);
      await db.prepare("DELETE FROM sessions WHERE account_id=?").run(id);
    }
    await writeAudit(db, {
      actorId: principal.id,
      feature: "M01",
      objectType: "account",
      objectId: id,
      action: action === "lock" ? "account.locked" : "account.unlocked",
      before: { status: before.status },
      after: { status },
      ip,
    });
    return { ...before, status };
  });
}

export async function transferCandidates(db, principal) {
  requireAdministrator(principal, "M01.view");
  return {
    items: await db
      .prepare(
        `SELECT a.id,a.username,a.full_name,a.officer_id,a.role_code,a.status,
      (SELECT count(*) FROM facilities f WHERE f.officer_id=a.officer_id) AS facility_count,
      (SELECT count(*) FROM region_assignments r WHERE r.account_id=a.id) AS region_count
      FROM accounts a JOIN roles role ON role.code=a.role_code
      WHERE a.status='active' AND role.enabled=1 ORDER BY a.full_name,a.id`,
      )
      .all(),
  };
}

export async function managedAssignments(db, principal, sourceId) {
  requireAdministrator(principal, "M01.view");
  const source = await account(db, sourceId);
  await uniqueOfficer(db, source.officer_id);
  return {
    account: source,
    regions: await db
      .prepare(
        `SELECT r.id,r.name,u.name AS unit_name
      FROM region_assignments ra JOIN regions r ON r.id=ra.region_id
      JOIN units u ON u.id=r.unit_id WHERE ra.account_id=? ORDER BY r.name`,
      )
      .all(sourceId),
    facilities: await db
      .prepare(
        `SELECT f.id,f.name,f.address,r.name AS region_name
      FROM facilities f JOIN regions r ON r.id=f.region_id
      WHERE f.officer_id=? ORDER BY f.name,f.id`,
      )
      .all(source.officer_id),
  };
}

function selectedIds(value, label) {
  assert(
    Array.isArray(value) && value.length <= 100,
    400,
    "INVALID_INPUT",
    `${label} không hợp lệ.`,
  );
  const ids = value.map((id) => text(id, label, 1, 100));
  assert(new Set(ids).size === ids.length, 400, "INVALID_INPUT", `${label} không được trùng.`);
  return ids;
}

async function grantDirectScope(db, accountId, kind, targetId) {
  if (
    await db
      .prepare("SELECT 1 FROM account_scopes WHERE account_id=? AND kind='all'")
      .get(accountId)
  )
    return;
  const column = kind === "region" ? "region_id" : "facility_id";
  await db
    .prepare(
      `INSERT INTO account_scopes(account_id,kind,${column}) VALUES (?,?,?) ON CONFLICT DO NOTHING`,
    )
    .run(accountId, kind, targetId);
}

export async function createTransfer(db, principal, payload, ip) {
  requireAdministrator(principal);
  object(payload, ["sourceAccountId", "targetAccountId", "regionIds", "facilityIds", "reason"]);
  const sourceId = text(payload.sourceAccountId, "Cán bộ chuyển", 1, 128);
  const targetId = text(payload.targetAccountId, "Cán bộ nhận", 1, 128);
  const regionIds = selectedIds(payload.regionIds, "Khu vực");
  const facilityIds = selectedIds(payload.facilityIds, "Cơ sở");
  assert(
    regionIds.length + facilityIds.length > 0 && regionIds.length + facilityIds.length <= 100,
    400,
    "INVALID_INPUT",
    "Chọn ít nhất một và tối đa 100 địa bàn/cơ sở.",
  );
  const reason = text(payload.reason?.trim(), "Lý do", 1, 1000);
  assert(sourceId !== targetId, 400, "INVALID_INPUT", "Cán bộ nhận phải khác cán bộ chuyển.");

  return await transaction(db, async () => {
    const source = await account(db, sourceId);
    const target = await account(db, targetId);
    assert(
      source.status === "active" && target.status === "active" && source.enabled && target.enabled,
      409,
      "ACCOUNT_UNAVAILABLE",
      "Hai tài khoản phải đang hoạt động.",
    );
    await uniqueOfficer(db, source.officer_id);
    await uniqueOfficer(db, target.officer_id);
    assert(
      source.officer_id !== target.officer_id,
      400,
      "INVALID_INPUT",
      "Hai tài khoản cùng cán bộ.",
    );
    const regions = [];
    for (const id of regionIds) {
      const row = await db
        .prepare(
          `SELECT r.id,r.name FROM region_assignments ra
        JOIN regions r ON r.id=ra.region_id WHERE r.id=? AND ra.account_id=?`,
        )
        .get(id, sourceId);
      assert(row, 409, "ASSIGNMENT_CHANGED", "Khu vực không còn thuộc cán bộ chuyển.");
      regions.push(row);
    }
    const facilities = [];
    for (const id of facilityIds) {
      const row = await db
        .prepare("SELECT id,name,region_id FROM facilities WHERE id=? AND officer_id=?")
        .get(id, source.officer_id);
      assert(row, 409, "ASSIGNMENT_CHANGED", "Cơ sở không còn thuộc cán bộ chuyển.");
      facilities.push(row);
    }
    const transferId = randomUUID();
    const now = Date.now();
    for (const region of regions) {
      const changed = await db
        .prepare(
          "UPDATE region_assignments SET account_id=?,assigned_at=? WHERE region_id=? AND account_id=?",
        )
        .run(targetId, now, region.id, sourceId);
      assert(changed.changes === 1, 409, "ASSIGNMENT_CHANGED", "Khu vực vừa thay đổi.");
      const removed = await db
        .prepare("DELETE FROM account_scopes WHERE account_id=? AND kind='region' AND region_id=?")
        .run(sourceId, region.id);
      if (removed.changes) {
        const remaining = await db
          .prepare("SELECT id FROM facilities WHERE region_id=? AND officer_id=?")
          .all(region.id, source.officer_id);
        for (const facility of remaining)
          await grantDirectScope(db, sourceId, "facility", facility.id);
      }
      await grantDirectScope(db, targetId, "region", region.id);
    }
    for (const facility of facilities) {
      const changed = await db
        .prepare("UPDATE facilities SET officer_id=? WHERE id=? AND officer_id=?")
        .run(target.officer_id, facility.id, source.officer_id);
      assert(changed.changes === 1, 409, "ASSIGNMENT_CHANGED", "Cơ sở vừa thay đổi.");
      await db
        .prepare(
          "DELETE FROM account_scopes WHERE account_id=? AND kind='facility' AND facility_id=?",
        )
        .run(sourceId, facility.id);
      await grantDirectScope(db, targetId, "facility", facility.id);
    }
    await db.prepare("DELETE FROM sessions WHERE account_id IN (?,?)").run(sourceId, targetId);
    const items = [
      ...regions.map((item) => ({ kind: "region", id: item.id, name: item.name })),
      ...facilities.map((item) => ({ kind: "facility", id: item.id, name: item.name })),
    ];
    const auditId = await writeAudit(db, {
      actorId: principal.id,
      feature: "M01.transfer",
      objectType: "account_transfer",
      objectId: transferId,
      action: "account.transfer_completed",
      before: { sourceAccountId: sourceId, sourceOfficerId: source.officer_id, items },
      after: {
        targetAccountId: targetId,
        targetOfficerId: target.officer_id,
        items,
        effectiveAt: now,
        reason,
      },
      ip,
    });
    // UC-ORG-03 history covers transfers too; otherwise the region would show the new
    // owner with the previous assignment's effective date/note.
    const effectiveDate = businessDate(now);
    for (const region of regions)
      await db
        .prepare(
          `INSERT INTO assignment_events
        (region_id,from_account_id,to_account_id,action,reason,effective_date,
          performed_by,occurred_at,audit_log_id)
        VALUES (?,?,?,'assign',?,?,?,?,?)`,
        )
        .run(region.id, sourceId, targetId, reason, effectiveDate, principal.id, now, auditId);
    await db
      .prepare(
        `INSERT INTO account_transfers
      (id,source_account_id,target_account_id,source_officer_id,target_officer_id,effective_at,performed_by,reason,created_at,audit_log_id)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        transferId,
        sourceId,
        targetId,
        source.officer_id,
        target.officer_id,
        now,
        principal.id,
        reason,
        now,
        auditId,
      );
    for (const item of items)
      await db
        .prepare(
          `INSERT INTO account_transfer_items
        (transfer_id,region_id,facility_id,source_officer_id,target_officer_id) VALUES (?,?,?,?,?)`,
        )
        .run(
          transferId,
          item.kind === "region" ? item.id : null,
          item.kind === "facility" ? item.id : null,
          source.officer_id,
          target.officer_id,
        );
    return {
      id: transferId,
      effectiveAt: now,
      sourceAccountId: sourceId,
      targetAccountId: targetId,
      items,
    };
  });
}

export async function listTransfers(db, principal, url) {
  requireAdministrator(principal, "M01.view");
  const { page, pageSize } = pagination(url);
  const sourceId = url.searchParams.get("sourceAccountId");
  const where = sourceId ? "WHERE t.source_account_id=? OR t.target_account_id=?" : "";
  if (sourceId) text(sourceId, "Tài khoản", 1, 128);
  const params = sourceId ? [sourceId, sourceId] : [];
  const items = await db
    .prepare(
      `SELECT t.*,source.full_name AS source_name,target.full_name AS target_name,
    actor.full_name AS actor_name FROM account_transfers t
    JOIN accounts source ON source.id=t.source_account_id
    JOIN accounts target ON target.id=t.target_account_id
    JOIN accounts actor ON actor.id=t.performed_by
    ${where} ORDER BY t.effective_at DESC,t.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize);
  if (items.length) {
    const placeholders = items.map(() => "?").join(",");
    const details = await db
      .prepare(
        `SELECT i.transfer_id,
      CASE WHEN i.region_id IS NOT NULL THEN 'region' ELSE 'facility' END AS kind,
      coalesce(i.region_id,i.facility_id) AS id,coalesce(r.name,f.name) AS name
      FROM account_transfer_items i LEFT JOIN regions r ON r.id=i.region_id
      LEFT JOIN facilities f ON f.id=i.facility_id
      WHERE i.transfer_id IN (${placeholders}) ORDER BY i.id`,
      )
      .all(...items.map((item) => item.id));
    for (const item of items)
      item.items = details.filter((detail) => detail.transfer_id === item.id);
  }
  return {
    items,
    total: (
      await db.prepare(`SELECT count(*) AS n FROM account_transfers t ${where}`).get(...params)
    ).n,
    page,
    pageSize,
  };
}
