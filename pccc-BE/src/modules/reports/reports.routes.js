import { ApiError, assert } from "../../core/errors.js";
import { sendFile } from "../../core/http.js";
import { requirePermission } from "../authorization/authorization.service.js";
import {
  MAX_REPORT_FILE_BYTES,
  completeReport,
  createReportRequest,
  createReportSchedule,
  createReportType,
  generateReportPeriod,
  listReportAssignees,
  listReportRequests,
  listReportSchedules,
  listReportTypes,
  reportDetail,
  reportFile,
  submitReport,
  updateReportRequest,
  updateReportSchedule,
  updateReportType,
} from "./reports.service.js";

const requestPath = /^\/api\/reports\/requests\/([a-zA-Z0-9-]+)$/;
const schedulePath = /^\/api\/reports\/schedules\/([a-zA-Z0-9-]+)\/generate$/;
const submissionPath =
  /^\/api\/reports\/requests\/([a-zA-Z0-9-]+)\/submissions\/([a-zA-Z0-9-]+)\/file$/;
function header(request, name) {
  try {
    return decodeURIComponent(request.headers[name] ?? "");
  } catch {
    throw new ApiError(400, "INVALID_INPUT", "Tên file hoặc ghi chú không hợp lệ.");
  }
}
async function upload(ctx, id) {
  requirePermission(ctx.user, "M08.edit");
  assert(
    Number(ctx.request.headers["content-length"] ?? 0) <= MAX_REPORT_FILE_BYTES,
    413,
    "FILE_TOO_LARGE",
    "File báo cáo tối đa 10 MB.",
  );
  const chunks = [];
  let size = 0;
  for await (const chunk of ctx.request) {
    size += chunk.length;
    assert(size <= MAX_REPORT_FILE_BYTES, 413, "FILE_TOO_LARGE", "File báo cáo tối đa 10 MB.");
    chunks.push(chunk);
  }
  ctx.status = 201;
  return await submitReport(
    ctx.db,
    ctx.user,
    id,
    {
      fileName: header(ctx.request, "x-file-name"),
      contentType: ctx.request.headers["content-type"]?.split(";")[0].trim(),
      note: header(ctx.request, "x-report-note"),
      data: Buffer.concat(chunks),
    },
    ctx.ip,
  );
}
export const reportsRoutes = [
  {
    method: "GET",
    path: "/api/reports/types",
    handle: async (ctx) => await listReportTypes(ctx.db, ctx.user),
  },
  {
    method: "POST",
    path: "/api/reports/types",
    async handle(ctx) {
      const result = await createReportType(ctx.db, ctx.user, await ctx.readJson(), ctx.ip);
      ctx.status = 201;
      return result;
    },
  },
  {
    method: "PUT",
    path: /^\/api\/reports\/types\/([a-zA-Z0-9-]+)$/,
    async handle(ctx, match) {
      return await updateReportType(ctx.db, ctx.user, match[1], await ctx.readJson(), ctx.ip);
    },
  },
  {
    method: "GET",
    path: "/api/reports/assignees",
    handle: async (ctx) => await listReportAssignees(ctx.db, ctx.user),
  },
  {
    method: "GET",
    path: "/api/reports/requests",
    handle: async (ctx) => await listReportRequests(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "POST",
    path: "/api/reports/requests",
    async handle(ctx) {
      const result = await createReportRequest(ctx.db, ctx.user, await ctx.readJson(), ctx.ip);
      ctx.status = 201;
      return result;
    },
  },
  {
    method: "GET",
    path: requestPath,
    handle: async (ctx, match) => await reportDetail(ctx.db, ctx.user, match[1]),
  },
  {
    method: "PUT",
    path: requestPath,
    async handle(ctx, match) {
      return await updateReportRequest(ctx.db, ctx.user, match[1], await ctx.readJson(), ctx.ip);
    },
  },
  {
    method: "POST",
    path: /^\/api\/reports\/requests\/([a-zA-Z0-9-]+)\/submit$/,
    handle: async (ctx, match) => await upload(ctx, match[1]),
  },
  {
    method: "POST",
    path: /^\/api\/reports\/requests\/([a-zA-Z0-9-]+)\/complete$/,
    handle: async (ctx, match) => await completeReport(ctx.db, ctx.user, match[1], ctx.ip),
  },
  {
    method: "GET",
    path: submissionPath,
    async handle(ctx, match) {
      sendFile(ctx.response, await reportFile(ctx.db, ctx.user, match[1], match[2]));
    },
  },
  {
    method: "GET",
    path: "/api/reports/schedules",
    handle: async (ctx) => await listReportSchedules(ctx.db, ctx.user),
  },
  {
    method: "POST",
    path: "/api/reports/schedules",
    async handle(ctx) {
      const result = await createReportSchedule(ctx.db, ctx.user, await ctx.readJson(), ctx.ip);
      ctx.status = 201;
      return result;
    },
  },
  {
    method: "POST",
    path: schedulePath,
    handle: async (ctx, match) => await generateReportPeriod(ctx.db, ctx.user, match[1], ctx.ip),
  },
  {
    method: "PUT",
    path: /^\/api\/reports\/schedules\/([a-zA-Z0-9-]+)$/,
    async handle(ctx, match) {
      return await updateReportSchedule(ctx.db, ctx.user, match[1], await ctx.readJson(), ctx.ip);
    },
  },
];
