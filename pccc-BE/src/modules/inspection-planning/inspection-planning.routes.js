import {
  assignLeadOfficer,
  createPeriodicInspection,
  createPlan,
  createTarget,
  listPlanFacilities,
  listPlans,
  listReschedules,
  listSchedules,
  planDetail,
  planningInspectionDetail,
  planningFile,
  planningOptions,
  rescheduleInspection,
  updatePlan,
  updateSchedule,
  upsertNotice,
} from "./inspection-planning.service.js";

const ID = "([a-zA-Z0-9-]+)";

function download(ctx, file) {
  ctx.response.statusCode = 200;
  ctx.response.setHeader("Content-Type", file.content_type);
  ctx.response.setHeader(
    "Content-Disposition",
    `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
  );
  ctx.response.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
  ctx.response.end(Buffer.from(file.file_data));
}

export const inspectionPlanningRoutes = [
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
    path: "/api/inspection-schedules",
    handle: (ctx) => listSchedules(ctx.db, ctx.user, ctx.url),
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
  {
    method: "GET",
    path: new RegExp(`^/api/inspections/${ID}/planning$`),
    handle: (ctx, match) => planningInspectionDetail(ctx.db, ctx.user, match[1]),
  },
  {
    method: "GET",
    path: new RegExp(`^/api/inspections/${ID}/reschedules$`),
    handle: (ctx, match) => listReschedules(ctx.db, ctx.user, match[1]),
  },
  {
    method: "GET",
    path: new RegExp(`^/api/inspections/${ID}/notice/file$`),
    handle: (ctx, match) => download(ctx, planningFile(ctx.db, ctx.user, match[1], "notice")),
  },
  {
    method: "GET",
    path: new RegExp(`^/api/inspections/${ID}/planning-documents/${ID}/file$`),
    handle: (ctx, match) =>
      download(ctx, planningFile(ctx.db, ctx.user, match[1], "document", match[2])),
  },
  {
    method: "GET",
    path: new RegExp(`^/api/inspections/${ID}/reschedules/${ID}/file$`),
    handle: (ctx, match) =>
      download(ctx, planningFile(ctx.db, ctx.user, match[1], "reschedule", match[2])),
  },
  {
    method: "PUT",
    path: new RegExp(`^/api/inspections/${ID}/lead-officer$`),
    async handle(ctx, match) {
      return {
        inspection: assignLeadOfficer(ctx.db, ctx.user, match[1], await ctx.readJson(), ctx.ip),
      };
    },
  },
  {
    method: "PUT",
    path: new RegExp(`^/api/inspections/${ID}/schedule$`),
    async handle(ctx, match) {
      return {
        inspection: updateSchedule(ctx.db, ctx.user, match[1], await ctx.readJson(), ctx.ip),
      };
    },
  },
  {
    method: "POST",
    path: new RegExp(`^/api/inspections/${ID}/notice$`),
    async handle(ctx, match) {
      return {
        notice: upsertNotice(ctx.db, ctx.user, match[1], await ctx.readJson(10485760), ctx.ip),
      };
    },
  },
  {
    method: "POST",
    path: new RegExp(`^/api/inspections/${ID}/reschedules$`),
    async handle(ctx, match) {
      ctx.status = 201;
      return rescheduleInspection(ctx.db, ctx.user, match[1], await ctx.readJson(10485760), ctx.ip);
    },
  },
];
