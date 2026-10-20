import { assert } from "../../core/errors.js";
import { pagination } from "../../core/validation.js";
import {
  assignRegion,
  assignableOfficers,
  createRegion,
  getRegion,
  listRegions,
  listUnits,
  regionOfficers,
  updateRegion,
} from "./regions.service.js";

// UC-ORG-03 — regions and officer assignments. The exact "/api/regions/officers" route is
// registered before the id pattern so it is never read as a region id.
function decodeRegionId(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    assert(false, 400, "INVALID_INPUT", "Mã khu vực không hợp lệ.");
  }
}

export const regionsRoutes = [
  {
    method: "GET",
    path: "/api/regions",
    handle: (ctx) =>
      listRegions(ctx.db, ctx.user, {
        ...pagination(ctx.url),
        search: ctx.url.searchParams.get("search") ?? "",
        unitId: ctx.url.searchParams.get("unitId") ?? "",
      }),
  },
  {
    method: "GET",
    path: "/api/regions/officers",
    handle: (ctx) =>
      assignableOfficers(ctx.db, ctx.user, ctx.url.searchParams.get("regionId") ?? ""),
  },
  {
    method: "POST",
    path: "/api/regions",
    async handle(ctx) {
      const payload = await ctx.readJson();
      ctx.status = 201;
      return createRegion(ctx.db, ctx.user, payload, ctx.ip);
    },
  },
  {
    method: "GET",
    path: /^\/api\/regions\/([^/]+)$/,
    handle: (ctx, match) =>
      getRegion(ctx.db, ctx.user, decodeRegionId(match[1]), pagination(ctx.url)),
  },
  {
    method: "PUT",
    path: /^\/api\/regions\/([^/]+)$/,
    async handle(ctx, match) {
      const payload = await ctx.readJson();
      return updateRegion(ctx.db, ctx.user, decodeRegionId(match[1]), payload, ctx.ip);
    },
  },
  {
    method: "GET",
    path: /^\/api\/regions\/([^/]+)\/officers$/,
    handle: (ctx, match) => regionOfficers(ctx.db, ctx.user, decodeRegionId(match[1])),
  },
  {
    method: "POST",
    path: /^\/api\/regions\/([^/]+)\/assignment$/,
    async handle(ctx, match) {
      const payload = await ctx.readJson();
      return assignRegion(ctx.db, ctx.user, decodeRegionId(match[1]), payload, ctx.ip);
    },
  },
  {
    method: "GET",
    path: "/api/units",
    handle: (ctx) => listUnits(ctx.db, ctx.user),
  },
];
