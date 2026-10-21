import { pagination } from "../../core/validation.js";
import { getFacility, listFacilities } from "./facilities.service.js";
import {
  getFacilityStatus,
  listFacilityStatusHistory,
  listFacilityChanges,
  listFacilityTimeline,
  listFacilityViolations,
  updateFacilityDetails,
  updateFacilityStatus,
} from "./facility-history.service.js";

export const facilitiesRoutes = [
  {
    method: "GET",
    path: "/api/violations",
    handle: (ctx) => listFacilityViolations(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/status$/,
    handle: (ctx, match) => getFacilityStatus(ctx.db, ctx.user, decodeURIComponent(match[1])),
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/status-history$/,
    handle: (ctx, match) =>
      listFacilityStatusHistory(ctx.db, ctx.user, decodeURIComponent(match[1]), ctx.url),
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/changes$/,
    handle: (ctx, match) =>
      listFacilityChanges(ctx.db, ctx.user, decodeURIComponent(match[1]), ctx.url),
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/timeline$/,
    handle: (ctx, match) =>
      listFacilityTimeline(ctx.db, ctx.user, decodeURIComponent(match[1]), ctx.url),
  },
  {
    method: "PUT",
    path: /^\/api\/facilities\/([^/]+)\/status$/,
    handle: async (ctx, match) =>
      updateFacilityStatus(
        ctx.db,
        ctx.user,
        decodeURIComponent(match[1]),
        await ctx.readJson(),
        ctx.ip,
      ),
  },
  {
    method: "PUT",
    path: /^\/api\/facilities\/([^/]+)$/,
    handle: async (ctx, match) =>
      updateFacilityDetails(
        ctx.db,
        ctx.user,
        decodeURIComponent(match[1]),
        await ctx.readJson(),
        ctx.ip,
      ),
  },
  {
    method: "GET",
    path: "/api/facilities",
    handle: (ctx) =>
      listFacilities(ctx.db, ctx.user, {
        ...pagination(ctx.url),
        search: ctx.url.searchParams.get("search") ?? "",
      }),
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)$/,
    handle: (ctx, match) => getFacility(ctx.db, ctx.user, decodeURIComponent(match[1])),
  },
];
