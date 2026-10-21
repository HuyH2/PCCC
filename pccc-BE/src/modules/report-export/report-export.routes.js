import {
  createReportExport,
  createReportTemplate,
  downloadReportFile,
  listReportExports,
  listReportTemplates,
  listReportTypes,
  previewReport,
  reportOptions,
} from "./report-export.service.js";

const EXPORT_ID = /^\/api\/report-export\/exports\/([a-zA-Z0-9-]+)\/file$/;

function downloadFile(ctx, id) {
  const file = downloadReportFile(ctx.db, ctx.user, id);
  const extension = file.file_name.toLowerCase().endsWith(".pdf") ? ".pdf" : ".xlsx";
  const { response } = ctx;
  response.statusCode = 200;
  response.setHeader("Content-Type", file.content_type);
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="report${extension}"; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
  );
  response.setHeader("Content-Length", file.file_data.length);
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
  response.end(file.file_data);
}

export const reportExportRoutes = [
  {
    method: "GET",
    path: "/api/report-export/types",
    handle: (ctx) => listReportTypes(ctx.db, ctx.user),
  },
  {
    method: "GET",
    path: "/api/report-export/options",
    handle: (ctx) => reportOptions(ctx.db, ctx.user),
  },
  {
    method: "GET",
    path: "/api/report-export/templates",
    handle: (ctx) => listReportTemplates(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "POST",
    path: "/api/report-export/templates",
    async handle(ctx) {
      const payload = await ctx.readJson();
      ctx.status = 201;
      return { item: createReportTemplate(ctx.db, ctx.user, payload, ctx.ip) };
    },
  },
  {
    method: "GET",
    path: "/api/report-export/preview",
    handle: (ctx) => previewReport(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "POST",
    path: "/api/report-export/exports",
    async handle(ctx) {
      const payload = await ctx.readJson();
      ctx.status = 201;
      return createReportExport(ctx.db, ctx.user, payload, ctx.ip);
    },
  },
  {
    method: "GET",
    path: "/api/report-export/exports",
    handle: (ctx) => listReportExports(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "GET",
    path: EXPORT_ID,
    handle: (ctx, match) => downloadFile(ctx, match[1]),
  },
];
