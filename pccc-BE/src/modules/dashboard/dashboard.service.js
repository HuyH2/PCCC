import {
  facilityScope,
  regionScope,
  requirePermission,
} from "../authorization/authorization.service.js";

function requireDashboard(principal) {
  requirePermission(principal, "M10.view");
  requirePermission(principal, "M03.view");
}

/**
 * UC-SYS-02. All metrics share facilityScope, so the per-region and per-officer breakdowns
 * always add up to facilityCount (R-803).
 */
export async function dashboardSummary(db, principal) {
  requireDashboard(principal);
  const facility = facilityScope(principal);
  const region = regionScope(principal);
  const totals = await db
    .prepare(
      `SELECT count(*) AS "facilityCount", count(DISTINCT f.officer_id) AS "officerCount"
      FROM facility_overview f WHERE ${facility.sql}`,
    )
    .get(...facility.params);
  return {
    facilityCount: totals.facilityCount,
    officerCount: totals.officerCount,
    regionCount: (
      await db
        .prepare(`SELECT count(*) AS total FROM regions r WHERE ${region.sql}`)
        .get(...region.params)
    ).total,
  };
}

/** Regions in scope, including those without facilities, ordered by facility count. */
export async function facilitiesByRegion(db, principal, { page, pageSize }) {
  requireDashboard(principal);
  const facility = facilityScope(principal);
  const region = regionScope(principal);
  return {
    items: await db
      .prepare(
        `SELECT r.id AS "regionId", r.name AS "regionName", u.id AS "unitId", u.name AS "unitName",
          count(f.id) AS "facilityCount"
        FROM regions r JOIN units u ON u.id=r.unit_id
        LEFT JOIN facilities f ON f.region_id=r.id AND ${facility.sql}
        WHERE ${region.sql}
        GROUP BY r.id, u.id ORDER BY "facilityCount" DESC, r.id LIMIT ? OFFSET ?`,
      )
      .all(...facility.params, ...region.params, pageSize, (page - 1) * pageSize),
    total: (
      await db
        .prepare(`SELECT count(*) AS total FROM regions r WHERE ${region.sql}`)
        .get(...region.params)
    ).total,
    page,
    pageSize,
  };
}

/** Officers responsible for facilities in scope (facilities.officer_id). */
export async function facilitiesByOfficer(db, principal, { page, pageSize }) {
  requireDashboard(principal);
  const facility = facilityScope(principal);
  return {
    items: await db
      .prepare(
        `SELECT f.officer_id AS "officerId", f.officer_name AS "officerName",
          count(*) AS "facilityCount", count(DISTINCT f.region_id) AS "regionCount"
        FROM facility_overview f WHERE ${facility.sql}
        GROUP BY f.officer_id, f.officer_name ORDER BY "facilityCount" DESC, f.officer_id LIMIT ? OFFSET ?`,
      )
      .all(...facility.params, pageSize, (page - 1) * pageSize),
    total: (
      await db
        .prepare(
          `SELECT count(DISTINCT f.officer_id) AS total FROM facility_overview f WHERE ${facility.sql}`,
        )
        .get(...facility.params)
    ).total,
    page,
    pageSize,
  };
}
