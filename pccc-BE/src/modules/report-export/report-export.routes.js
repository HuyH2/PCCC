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

async function downloadFile(ctx, id) {
  const file = await downloadReportFile(ctx.db, ctx.user, id);
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
    handle: async (ctx) => await listReportTypes(ctx.db, ctx.user),
  },
  {
    method: "GET",
    path: "/api/report-export/options",
    handle: async (ctx) => await reportOptions(ctx.db, ctx.user),
  },
  {
    method: "GET",
    path: "/api/report-export/templates",
    handle: async (ctx) => await listReportTemplates(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "POST",
    path: "/api/report-export/templates",
    async handle(ctx) {
      const payload = await ctx.readJson();
      ctx.status = 201;
      return { item: await createReportTemplate(ctx.db, ctx.user, payload, ctx.ip) };
    },
  },
  {
    method: "GET",
    path: "/api/report-export/preview",
    handle: async (ctx) => await previewReport(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "POST",
    path: "/api/report-export/exports",
    async handle(ctx) {
      const payload = await ctx.readJson();
      ctx.status = 201;
      return await createReportExport(ctx.db, ctx.user, payload, ctx.ip);
    },
  },
  {
    method: "GET",
    path: "/api/report-export/exports",
    handle: async (ctx) => await listReportExports(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "GET",
    path: EXPORT_ID,
    handle: async (ctx, match) => await downloadFile(ctx, match[1]),
  },
];
