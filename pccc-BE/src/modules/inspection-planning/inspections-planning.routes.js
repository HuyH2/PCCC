import { sendFile } from "../../core/http.js";
import {
  listSchedules,
  updateSchedule,
  listReschedules,
  rescheduleInspection,
} from "./schedules.service.js";
import { planningInspectionDetail, assignLeadOfficer } from "./periodic-inspections.service.js";
import { upsertNotice } from "./notices.service.js";
import { planningFile } from "./planning-files.service.js";

const ID = "([a-zA-Z0-9-]+)";

export const inspectionsPlanningRoutes = [
  {
    method: "GET",
    path: "/api/inspection-schedules",
    handle: async (ctx) => await listSchedules(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "GET",
    path: new RegExp(`^/api/inspections/${ID}/planning$`),
    handle: async (ctx, match) => await planningInspectionDetail(ctx.db, ctx.user, match[1]),
  },
  {
    method: "GET",
    path: new RegExp(`^/api/inspections/${ID}/reschedules$`),
    handle: async (ctx, match) => await listReschedules(ctx.db, ctx.user, match[1]),
  },
  {
    method: "GET",
    path: new RegExp(`^/api/inspections/${ID}/notice/file$`),
    handle: async (ctx, match) =>
      sendFile(ctx.response, await planningFile(ctx.db, ctx.user, match[1], "notice")),
  },
  {
    method: "GET",
    path: new RegExp(`^/api/inspections/${ID}/planning-documents/${ID}/file$`),
    handle: async (ctx, match) =>
      sendFile(ctx.response, await planningFile(ctx.db, ctx.user, match[1], "document", match[2])),
  },
  {
    method: "GET",
    path: new RegExp(`^/api/inspections/${ID}/reschedules/${ID}/file$`),
    handle: async (ctx, match) =>
      sendFile(
        ctx.response,
        await planningFile(ctx.db, ctx.user, match[1], "reschedule", match[2]),
      ),
  },
  {
    method: "PUT",
    path: new RegExp(`^/api/inspections/${ID}/lead-officer$`),
    async handle(ctx, match) {
      return {
        inspection: await assignLeadOfficer(
          ctx.db,
          ctx.user,
          match[1],
          await ctx.readJson(),
          ctx.ip,
        ),
      };
    },
  },
  {
    method: "PUT",
    path: new RegExp(`^/api/inspections/${ID}/schedule$`),
    async handle(ctx, match) {
      return {
        inspection: await updateSchedule(ctx.db, ctx.user, match[1], await ctx.readJson(), ctx.ip),
      };
    },
  },
  {
    method: "POST",
    path: new RegExp(`^/api/inspections/${ID}/notice$`),
    async handle(ctx, match) {
      return {
        notice: await upsertNotice(
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
    method: "POST",
    path: new RegExp(`^/api/inspections/${ID}/reschedules$`),
    async handle(ctx, match) {
      ctx.status = 201;
      return await rescheduleInspection(
        ctx.db,
        ctx.user,
        match[1],
        await ctx.readJson(10485760),
        ctx.ip,
      );
    },
  },
];
