import { assert } from "../../core/errors.js";
import {
  facilityScope,
  regionScope,
  requirePermission,
  unitScope,
} from "../authorization/authorization.service.js";
import { foldSearchText } from "../../core/database.js";

function searchInput(url) {
  const query = (url.searchParams.get("q") ?? "").trim();
  assert(
    query.length >= 2 && query.length <= 100,
    400,
    "INVALID_INPUT",
    "Từ khóa tìm kiếm phải có từ 2 đến 100 ký tự.",
  );
  const rawLimit = url.searchParams.get("limit");
  assert(
    rawLimit === null || (/^[1-9]\d?$/.test(rawLimit) && Number(rawLimit) <= 50),
    400,
    "INVALID_INPUT",
    "limit phải từ 1 đến 50.",
  );
  return { query, limit: rawLimit === null ? 10 : Number(rawLimit) };
}

/**
 * UC-SYS-01 over the Sprint 1 catalog. Every group is filtered by data scope in SQL before
 * count/limit, and a group is omitted entirely when its module permission is missing.
 */
export async function globalSearch(db, principal, url) {
  requirePermission(principal, "M10.view");
  const { query, limit } = searchInput(url);
  const term = foldSearchText(query);
  const group = async (source, where, params, columns, order) => ({
    items: await db
      .prepare(`SELECT ${columns} FROM ${source} WHERE ${where} ORDER BY ${order} LIMIT ?`)
      .all(...params, limit),
    total: (
      await db.prepare(`SELECT count(*) AS total FROM ${source} WHERE ${where}`).get(...params)
    ).total,
  });
  const groups = {};
  if (principal.permissions.includes("M03.view")) {
    const facility = facilityScope(principal);
    groups.facilities = await group(
      "facility_overview f",
      `${facility.sql} AND (instr(fold(f.id),?)>0 OR instr(fold(f.name),?)>0 OR instr(fold(f.address),?)>0)`,
      [...facility.params, term, term, term],
      `f.id, f.name, f.address, f.status, f.region_id AS "regionId", f.region_name AS "regionName",
        f.officer_id AS "officerId", f.officer_name AS "officerName"`,
      "f.name, f.id",
    );
    // Officers are reachable only through facilities the caller may already see.
    groups.officers = await group(
      `(SELECT f.officer_id, f.officer_name, count(*) AS facility_count
        FROM facility_overview f WHERE ${facility.sql} GROUP BY f.officer_id, f.officer_name) o`,
      "(instr(fold(o.officer_id),?)>0 OR instr(fold(o.officer_name),?)>0)",
      [...facility.params, term, term],
      `o.officer_id AS "officerId", o.officer_name AS "officerName", o.facility_count AS "facilityCount"`,
      "o.officer_name, o.officer_id",
    );
  }
  const region = regionScope(principal);
  groups.regions = await group(
    "regions r JOIN units u ON u.id=r.unit_id",
    `${region.sql} AND (instr(fold(r.id),?)>0 OR instr(fold(r.name),?)>0)`,
    [...region.params, term, term],
    `r.id, r.name, r.unit_id AS "unitId", u.name AS "unitName"`,
    "r.name, r.id",
  );
  const unit = unitScope(principal);
  groups.units = await group(
    "units u",
    `${unit.sql} AND (instr(fold(u.id),?)>0 OR instr(fold(u.name),?)>0)`,
    [...unit.params, term, term],
    `u.id, u.name, u.parent_id AS "parentId"`,
    "u.name, u.id",
  );
  return { query, groups };
}
