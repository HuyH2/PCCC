import { kpiDebt, listKpiResults, listKpiTargets, saveKpiTarget } from "./kpi.service.js";

export const kpiRoutes = [
  {
    method: "GET",
    path: "/api/kpi/results",
    handle: async (ctx) => await listKpiResults(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "GET",
    path: "/api/kpi/debt",
    handle: async (ctx) => await kpiDebt(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "GET",
    path: "/api/kpi/targets",
    handle: async (ctx) => await listKpiTargets(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "POST",
    path: "/api/kpi/targets",
    async handle(ctx) {
      const result = await saveKpiTarget(ctx.db, ctx.user, await ctx.readJson(), ctx.ip);
      ctx.status = 201;
      return result;
    },
  },
];
