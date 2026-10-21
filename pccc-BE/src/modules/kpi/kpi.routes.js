import { kpiDebt, listKpiResults, listKpiTargets, saveKpiTarget } from "./kpi.service.js";

export const kpiRoutes = [
  {
    method: "GET",
    path: "/api/kpi/results",
    handle: (ctx) => listKpiResults(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "GET",
    path: "/api/kpi/debt",
    handle: (ctx) => kpiDebt(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "GET",
    path: "/api/kpi/targets",
    handle: (ctx) => listKpiTargets(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "POST",
    path: "/api/kpi/targets",
    async handle(ctx) {
      const result = saveKpiTarget(ctx.db, ctx.user, await ctx.readJson(), ctx.ip);
      ctx.status = 201;
      return result;
    },
  },
];
