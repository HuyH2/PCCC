import { assert } from "../../core/errors.js";
import { object, text } from "../../core/validation.js";
import { transaction } from "../../core/database.js";
import { writeAudit } from "../audit/audit.service.js";
import {
  accountScope,
  facilityScope,
  regionScope,
  requirePermission,
  unitScope,
} from "../authorization/authorization.service.js";

// UC-ORG-03 — region catalogue and officer assignment. One region has one owner (Q03);
// every change is appended to assignment_events (BR-03).
function regionSelect(principal) {
  const facilities = facilityScope(principal);
  return {
    sql: `
  SELECT r.id,r.name,r.unit_id,u.name AS unit_name,
    ra.account_id AS officer_account_id,
    oa.full_name AS officer_name,
    oa.officer_id AS officer_code,
    ra.assigned_at,
    (SELECT count(*) FROM facilities f WHERE f.region_id=r.id AND ${facilities.sql}) AS facility_count,
    ev.effective_date,
    ev.reason AS assignment_note
  FROM regions r
  JOIN units u ON u.id=r.unit_id
  LEFT JOIN region_assignments ra ON ra.region_id=r.id
  LEFT JOIN accounts oa ON oa.id=ra.account_id
  LEFT JOIN assignment_events ev ON ev.id=(
    SELECT max(e.id) FROM assignment_events e WHERE e.region_id=r.id AND e.action='assign'
  )`,
    params: facilities.params,
  };
}

function regionRow(db, principal, id, permission = "M02.view") {
  requirePermission(principal, permission);
  const select = regionSelect(principal);
  const scope = regionScope(principal);
  const row = db
    .prepare(`${select.sql} WHERE r.id=? AND ${scope.sql}`)
    .get(...select.params, id, ...scope.params);
  assert(row, 404, "NOT_FOUND", "Không tìm thấy khu vực trong phạm vi được cấp.");
  return row;
}

const SEARCH = "(instr(fold(r.name),fold(?))>0 OR instr(fold(r.id),fold(?))>0)";

export function listRegions(db, principal, { page, pageSize, search, unitId }) {
  requirePermission(principal, "M02.view");
  assert(search.length <= 100, 400, "INVALID_INPUT", "Từ khóa tìm kiếm quá dài.");
  const select = regionSelect(principal);
  const scope = regionScope(principal);
  const clauses = [scope.sql];
  const filterParams = [];
  if (search) {
    clauses.push(SEARCH);
    filterParams.push(search, search);
  }
  if (unitId) {
    text(unitId, "Đơn vị", 1, 100);
    clauses.push("r.unit_id=?");
    filterParams.push(unitId);
  }
  const where = clauses.join(" AND ");
  return {
    items: db
      .prepare(`${select.sql} WHERE ${where} ORDER BY u.name,r.name,r.id LIMIT ? OFFSET ?`)
      .all(...select.params, ...scope.params, ...filterParams, pageSize, (page - 1) * pageSize),
    total: db
      .prepare(`SELECT count(*) AS n FROM regions r WHERE ${where}`)
      .get(...scope.params, ...filterParams).n,
    page,
    pageSize,
  };
}

export function getRegion(db, principal, id, { page = 1, pageSize = 20 } = {}) {
  const region = regionRow(db, principal, id);
  const facilities = facilityScope(principal);
  return {
    region,
    facilities: db
      .prepare(
        `SELECT f.id,f.name,f.address,f.status,f.officer_id,o.full_name AS officer_name
      FROM facilities f LEFT JOIN officer_directory o ON o.officer_id=f.officer_id
      WHERE f.region_id=? AND ${facilities.sql} ORDER BY f.name,f.id`,
      )
      .all(id, ...facilities.params),
    officers: regionOfficers(db, principal, id).officers,
    history_total: db
      .prepare("SELECT count(*) AS n FROM assignment_events WHERE region_id=?")
      .get(id).n,
    history_page: page,
    history_page_size: pageSize,
    history: db
      .prepare(
        `SELECT e.id,e.action,e.reason,e.effective_date,e.occurred_at,
      af.full_name AS from_name,at.full_name AS to_name,p.full_name AS performed_by_name
      FROM assignment_events e
      LEFT JOIN accounts af ON af.id=e.from_account_id
      LEFT JOIN accounts at ON at.id=e.to_account_id
      LEFT JOIN accounts p ON p.id=e.performed_by
      WHERE e.region_id=? ORDER BY e.occurred_at DESC,e.id DESC LIMIT ? OFFSET ?`,
      )
      .all(id, pageSize, (page - 1) * pageSize),
  };
}

function assertUnit(db, unitId) {
  text(unitId, "Đơn vị", 1, 100);
  assert(
    db.prepare("SELECT 1 FROM units WHERE id=?").get(unitId),
    400,
    "INVALID_INPUT",
    "Đơn vị không tồn tại.",
  );
  return unitId;
}

function assertUnitInScope(db, principal, unitId) {
  const scope = unitScope(principal);
  assert(
    db.prepare(`SELECT 1 FROM units u WHERE u.id=? AND ${scope.sql}`).get(unitId, ...scope.params),
    403,
    "UNIT_OUT_OF_SCOPE",
    "Đơn vị ngoài phạm vi được cấp.",
  );
}

export function createRegion(db, principal, payload, ip) {
  requirePermission(principal, "M02.view");
  requirePermission(principal, "M02.create");
  object(payload, ["id", "name", "unitId"]);
  const id = text(payload.id, "Mã khu vực", 1, 32).trim().toUpperCase();
  assert(
    /^[A-Z0-9._-]+$/.test(id),
    400,
    "INVALID_INPUT",
    "Mã khu vực chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.",
  );
  const name = text(payload.name?.trim(), "Tên khu vực", 1, 200);
  const unitId = assertUnit(db, payload.unitId);
  assertUnitInScope(db, principal, unitId);
  return transaction(db, () => {
    assert(
      !db.prepare("SELECT 1 FROM regions WHERE id=?").get(id),
      409,
      "DUPLICATE_CODE",
      "Mã khu vực đã tồn tại.",
    );
    db.prepare("INSERT INTO regions(id,name,unit_id,code) VALUES (?,?,?,?)").run(
      id,
      name,
      unitId,
      id,
    );
    const created = regionRow(db, principal, id);
    writeAudit(db, {
      actorId: principal.id,
      feature: "M02",
      objectType: "region",
      objectId: id,
      action: "region.created",
      after: created,
      ip,
    });
    return { region: created };
  });
}

export function updateRegion(db, principal, id, payload, ip) {
  requirePermission(principal, "M02.view");
  const before = regionRow(db, principal, id, "M02.edit");
  object(payload, ["name", "unitId"]);
  const name = text(payload.name?.trim(), "Tên khu vực", 1, 200);
  const unitId = assertUnit(db, payload.unitId);
  assertUnitInScope(db, principal, unitId);
  return transaction(db, () => {
    db.prepare("UPDATE regions SET name=?,unit_id=? WHERE id=?").run(name, unitId, id);
    const after = regionRow(db, principal, id, "M02.edit");
    writeAudit(db, {
      actorId: principal.id,
      feature: "M02",
      objectType: "region",
      objectId: id,
      action: "region.updated",
      before,
      after,
      ip,
    });
    return { region: after };
  });
}

function grantDirectScope(db, accountId, kind, targetId) {
  if (db.prepare("SELECT 1 FROM account_scopes WHERE account_id=? AND kind='all'").get(accountId))
    return;
  const column = kind === "region" ? "region_id" : "facility_id";
  db.prepare(`INSERT OR IGNORE INTO account_scopes(account_id,kind,${column}) VALUES (?,?,?)`).run(
    accountId,
    kind,
    targetId,
  );
}

function unitChain(db, unitId) {
  const ids = [];
  const seen = new Set();
  let current = unitId;
  while (current && !seen.has(current)) {
    seen.add(current);
    ids.push(current);
    current = db.prepare("SELECT parent_id FROM units WHERE id=?").get(current)?.parent_id ?? null;
  }
  return ids;
}

// A region-scoped commander can still hand a region to an officer of the same unit
// (or a parent unit), even though that officer has no region scope yet.
function assignmentAccountScope(db, principal, region) {
  const base = accountScope(principal);
  const unitIds = unitChain(db, region.unit_id);
  const placeholders = unitIds.map(() => "?").join(",");
  return {
    sql: `(${base.sql} OR a.id IN (
      SELECT account_id FROM account_scopes
      WHERE kind='unit' AND unit_id IN (${placeholders})
    ))`,
    params: [...base.params, ...unitIds],
  };
}

function dateOnly(value, field) {
  if (value == null || value === "") return null;
  text(value, field, 10, 10);
  const parsed = new Date(`${value}T00:00:00Z`);
  const roundTrip = !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : "";
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      roundTrip === value &&
      parsed.getUTCFullYear() >= 1900 &&
      parsed.getUTCFullYear() <= 2999,
    400,
    "INVALID_INPUT",
    `${field} phải là ngày hợp lệ có dạng YYYY-MM-DD.`,
  );
  return value;
}

export function assignRegion(db, principal, id, payload, ip) {
  requirePermission(principal, "M02.view");
  requirePermission(principal, "M02.edit");
  object(payload, ["accountId", "effectiveDate", "note"]);
  const accountId =
    payload.accountId == null || payload.accountId === ""
      ? null
      : text(payload.accountId, "Cán bộ", 1, 128);
  const effectiveDate = dateOnly(payload.effectiveDate, "Ngày hiệu lực");
  const note =
    payload.note == null || payload.note === ""
      ? null
      : text(payload.note.trim(), "Ghi chú", 1, 500);

  return transaction(db, () => {
    const region = regionRow(db, principal, id, "M02.edit");
    assert(
      accountId !== region.officer_account_id,
      409,
      "ASSIGNMENT_UNCHANGED",
      accountId ? "Cán bộ này đã phụ trách khu vực." : "Khu vực hiện chưa có cán bộ phụ trách.",
    );
    const now = Date.now();
    if (accountId) {
      const account = db
        .prepare(
          `SELECT a.id,a.officer_id FROM accounts a JOIN roles r ON r.code=a.role_code
        WHERE a.id=? AND a.status='active' AND r.enabled=1`,
        )
        .get(accountId);
      assert(account, 409, "ACCOUNT_UNAVAILABLE", "Tài khoản cán bộ không hoạt động.");
      const visible = assignmentAccountScope(db, principal, region);
      assert(
        db
          .prepare(`SELECT 1 FROM accounts a WHERE a.id=? AND ${visible.sql}`)
          .get(accountId, ...visible.params),
        403,
        "ACCOUNT_OUT_OF_SCOPE",
        "Tài khoản cán bộ ngoài phạm vi được cấp.",
      );
      assert(
        db.prepare("SELECT count(*) AS n FROM accounts WHERE officer_id=?").get(account.officer_id)
          .n === 1,
        409,
        "AMBIGUOUS_OFFICER",
        "Mã cán bộ đang gắn nhiều tài khoản.",
      );
      db.prepare(
        `INSERT INTO region_assignments(region_id,account_id,assigned_at) VALUES (?,?,?)
        ON CONFLICT(region_id) DO UPDATE SET account_id=excluded.account_id,assigned_at=excluded.assigned_at`,
      ).run(id, accountId, now);
      grantDirectScope(db, accountId, "region", id);
    } else {
      db.prepare("DELETE FROM region_assignments WHERE region_id=?").run(id);
    }

    if (region.officer_account_id && region.officer_account_id !== accountId) {
      db.prepare(
        "DELETE FROM account_scopes WHERE account_id=? AND kind='region' AND region_id=?",
      ).run(region.officer_account_id, id);
      const oldAccount = db
        .prepare("SELECT officer_id FROM accounts WHERE id=?")
        .get(region.officer_account_id);
      if (oldAccount) {
        const remaining = db
          .prepare("SELECT id FROM facilities WHERE region_id=? AND officer_id=?")
          .all(id, oldAccount.officer_id);
        for (const facility of remaining)
          grantDirectScope(db, region.officer_account_id, "facility", facility.id);
      }
    }

    const auditId = writeAudit(db, {
      actorId: principal.id,
      feature: "M02",
      objectType: "region",
      objectId: id,
      action: accountId ? "region.assigned" : "region.unassigned",
      before: { accountId: region.officer_account_id, officerName: region.officer_name },
      after: { accountId, effectiveDate, note },
      ip,
    });
    db.prepare(
      `INSERT INTO assignment_events(region_id,from_account_id,to_account_id,action,reason,
        effective_date,performed_by,occurred_at,audit_log_id)
      VALUES (?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      region.officer_account_id,
      accountId,
      accountId ? "assign" : "unassign",
      note,
      effectiveDate,
      principal.id,
      now,
      auditId,
    );

    return getRegion(db, principal, id);
  });
}

export function regionOfficers(db, principal, id) {
  regionRow(db, principal, id);
  const facilities = facilityScope(principal);
  const rows = db
    .prepare(
      `SELECT f.officer_id,a.full_name,a.id AS account_id,a.role_code,a.status
      FROM facilities f LEFT JOIN accounts a ON a.officer_id=f.officer_id
      WHERE f.region_id=? AND ${facilities.sql} ORDER BY f.officer_id`,
    )
    .all(id, ...facilities.params);
  const owner = db
    .prepare(
      `SELECT a.officer_id,a.full_name,a.id AS account_id,a.role_code,a.status
      FROM region_assignments ra JOIN accounts a ON a.id=ra.account_id
      WHERE ra.region_id=?`,
    )
    .get(id);
  const officers = [];
  const seen = new Set();
  if (owner) {
    seen.add(owner.officer_id);
    officers.push(owner);
  }
  for (const row of rows) {
    if (seen.has(row.officer_id)) continue;
    seen.add(row.officer_id);
    officers.push(row);
  }
  return { officers };
}

export function assignableOfficers(db, principal, regionId = "") {
  requirePermission(principal, "M02.edit");
  let scope;
  if (regionId) {
    const region = regionRow(db, principal, regionId, "M02.edit");
    scope = assignmentAccountScope(db, principal, region);
  } else {
    scope = accountScope(principal);
  }
  return {
    items: db
      .prepare(
        `SELECT a.id,a.full_name,a.officer_id,a.role_code,
      (SELECT count(*) FROM region_assignments ra WHERE ra.account_id=a.id) AS region_count
      FROM accounts a JOIN roles r ON r.code=a.role_code
      WHERE a.status='active' AND r.enabled=1 AND ${scope.sql}
      ORDER BY a.full_name,a.id`,
      )
      .all(...scope.params),
  };
}

export function listUnits(db, principal) {
  requirePermission(principal, "M02.view");
  const scope = unitScope(principal);
  return {
    items: db
      .prepare(
        `SELECT u.id,u.name,u.parent_id FROM units u WHERE ${scope.sql} ORDER BY u.parent_id,u.id`,
      )
      .all(...scope.params),
  };
}
