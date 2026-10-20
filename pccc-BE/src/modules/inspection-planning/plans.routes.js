import { listPlans, planDetail, createPlan, updatePlan, planningOptions, listPlanFacilities } from "./plans.service.js";
import { createTarget } from "./targets.service.js";
import { createPeriodicInspection } from "./periodic-inspections.service.js";

const ID = "([a-zA-Z0-9-]+)";

export const planRoutes = [
  {
    method: "GET",
    path: "/api/inspection-plans",
    handle: (ctx) => listPlans(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "POST",
    path: "/api/inspection-plans",
    async handle(ctx) {
      ctx.status = 201;
      return { plan: createPlan(ctx.db, ctx.user, await ctx.readJson(), ctx.ip) };
    },
  },
  {
    method: "GET",
    path: "/api/inspection-planning/options",
    handle: (ctx) => planningOptions(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "GET",
    path: new RegExp(`^/api/inspection-plans/${ID}$`),
    handle: (ctx, match) => planDetail(ctx.db, ctx.user, match[1]),
  },
  {
    method: "PUT",
    path: new RegExp(`^/api/inspection-plans/${ID}$`),
    async handle(ctx, match) {
      return { plan: updatePlan(ctx.db, ctx.user, match[1], await ctx.readJson(), ctx.ip) };
    },
  },
  {
    method: "POST",
    path: new RegExp(`^/api/inspection-plans/${ID}/targets$`),
    async handle(ctx, match) {
      ctx.status = 201;
      return { target: createTarget(ctx.db, ctx.user, match[1], await ctx.readJson(), ctx.ip) };
    },
  },
  {
    method: "GET",
    path: new RegExp(`^/api/inspection-plans/${ID}/facilities$`),
    handle: (ctx, match) => listPlanFacilities(ctx.db, ctx.user, match[1], ctx.url),
  },
  {
    method: "POST",
    path: new RegExp(`^/api/inspection-plans/${ID}/inspections$`),
    async handle(ctx, match) {
      ctx.status = 201;
      return {
        inspection: createPeriodicInspection(
          ctx.db,
          ctx.user,
          match[1],
          await ctx.readJson(10485760),
          ctx.ip,
        ),
      };
    },
  },
];
