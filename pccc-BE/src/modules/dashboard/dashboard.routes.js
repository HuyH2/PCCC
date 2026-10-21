import { pagination } from "../../core/validation.js";
import { dashboardSummary, facilitiesByOfficer, facilitiesByRegion } from "./dashboard.service.js";

// UC-SYS-02
export const dashboardRoutes = [
  {
    method: "GET",
    path: "/api/dashboard",
    handle: async (ctx) => await dashboardSummary(ctx.db, ctx.user),
  },
  {
    method: "GET",
    path: "/api/dashboard/facilities-by-region",
    handle: async (ctx) => await facilitiesByRegion(ctx.db, ctx.user, pagination(ctx.url)),
  },
  {
    method: "GET",
    path: "/api/dashboard/facilities-by-officer",
    handle: async (ctx) => await facilitiesByOfficer(ctx.db, ctx.user, pagination(ctx.url)),
  },
];
