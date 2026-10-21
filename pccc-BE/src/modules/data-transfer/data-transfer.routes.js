import { pagination } from "../../core/validation.js";
import {
  exportDataset,
  listExportDatasets,
  listTransferJobs,
  transferJobDetail,
} from "./data-transfer.service.js";

function downloadCsv(ctx, exportResult) {
  const { response } = ctx;
  response.statusCode = 200;
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${exportResult.fileName}"; filename*=UTF-8''${encodeURIComponent(exportResult.fileName)}`,
  );
  response.setHeader("Content-Length", Buffer.byteLength(exportResult.csv, "utf8"));
  response.setHeader("X-Data-Transfer-Job-Id", exportResult.job.id);
  response.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
  response.end(exportResult.csv, "utf8");
}

export const dataTransferRoutes = [
  {
    method: "GET",
    path: "/api/data-transfers/datasets",
    handle: async (ctx) => await listExportDatasets(ctx.db, ctx.user),
  },
  {
    method: "POST",
    path: "/api/data-transfers/export",
    async handle(ctx) {
      const result = await exportDataset(ctx.db, ctx.user, await ctx.readJson(), ctx.ip);
      downloadCsv(ctx, result);
    },
  },
  {
    method: "GET",
    path: "/api/data-transfers",
    handle: async (ctx) => await listTransferJobs(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "GET",
    path: /^\/api\/data-transfers\/([^/]+)$/,
    handle: async (ctx, match) => await transferJobDetail(ctx.db, ctx.user, match[1]),
  },
];
