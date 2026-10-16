import { ApiError, assert } from "../../core/errors.js";
import {
  checklistDetail,
  completeFollowUp,
  completeInspection,
  createChecklist,
  requireChecklistAuthor,
  createFollowUp,
  createInspection,
  documentFile,
  inspectionDetail,
  listChecklists,
  listInspections,
  requireInspectionAccess,
  saveConclusion,
  saveResults,
  scopedInspection,
  uploadDocument,
  INSPECTION_FILE_SIZE_MESSAGE,
  MAX_INSPECTION_FILE_BYTES,
} from "./inspections.service.js";

const ID = "([a-zA-Z0-9-]+)";
const INSPECTION = `^\\/api\\/inspections\\/${ID}`;
const path = (suffix = "") => new RegExp(`${INSPECTION}${suffix}$`);

function header(request, name, label) {
  try {
    return decodeURIComponent(request.headers[name] ?? "");
  } catch {
    throw new ApiError(400, "INVALID_INPUT", `${label} không hợp lệ.`);
  }
}

// Raw file body (PDF/JPEG/PNG); metadata travels in URI-encoded X-* headers.
async function upload(ctx, id) {
  requireInspectionAccess(ctx.user, "edit");
  scopedInspection(ctx.db, ctx.user, id);
  const { request } = ctx;
  assert(
    Number(request.headers["content-length"] ?? 0) <= MAX_INSPECTION_FILE_BYTES,
    413,
    "FILE_TOO_LARGE",
    INSPECTION_FILE_SIZE_MESSAGE,
  );
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    assert(size <= MAX_INSPECTION_FILE_BYTES, 413, "FILE_TOO_LARGE", INSPECTION_FILE_SIZE_MESSAGE);
    chunks.push(chunk);
  }
  ctx.status = 201;
  return {
    document: uploadDocument(
      ctx.db,
      ctx.user,
      id,
      {
        kind: request.headers["x-document-kind"],
        recordNumber: header(request, "x-record-number", "Số biên bản"),
        description: header(request, "x-document-description", "Mô tả"),
        fileName: header(request, "x-file-name", "Tên file"),
        contentType: request.headers["content-type"]?.split(";")[0].trim(),
        data: Buffer.concat(chunks),
      },
      ctx.ip,
    ),
  };
}

function download(ctx, id, documentId) {
  const file = documentFile(ctx.db, ctx.user, id, documentId);
  const { response } = ctx;
  response.statusCode = 200;
  response.setHeader("Content-Type", file.content_type);
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
  );
  response.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
  response.end(Buffer.from(file.file_data));
}

export const inspectionsRoutes = [
  {
    method: "GET",
    path: "/api/inspection-checklists",
    handle: (ctx) => listChecklists(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "POST",
    path: "/api/inspection-checklists",
    async handle(ctx) {
      requireChecklistAuthor(ctx.user);
      const payload = await ctx.readJson(262144);
      ctx.status = 201;
      return createChecklist(ctx.db, ctx.user, payload, ctx.ip);
    },
  },
  {
    method: "GET",
    path: new RegExp(`^\\/api\\/inspection-checklists\\/${ID}$`),
    handle: (ctx, match) => checklistDetail(ctx.db, ctx.user, match[1]),
  },
  {
    method: "GET",
    path: "/api/inspections",
    handle: (ctx) => listInspections(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "POST",
    path: "/api/inspections",
    async handle(ctx) {
      requireInspectionAccess(ctx.user, "create");
      const payload = await ctx.readJson();
      ctx.status = 201;
      return { inspection: createInspection(ctx.db, ctx.user, payload, ctx.ip) };
    },
  },
  {
    method: "GET",
    path: path(),
    handle: (ctx, match) => inspectionDetail(ctx.db, ctx.user, match[1]),
  },
  {
    method: "PUT",
    path: path("\\/results"),
    async handle(ctx, match) {
      requireInspectionAccess(ctx.user, "edit");
      return saveResults(ctx.db, ctx.user, match[1], await ctx.readJson(65536), ctx.ip);
    },
  },
  {
    method: "PUT",
    path: path("\\/conclusion"),
    async handle(ctx, match) {
      requireInspectionAccess(ctx.user, "edit");
      const payload = await ctx.readJson();
      return { inspection: saveConclusion(ctx.db, ctx.user, match[1], payload, ctx.ip) };
    },
  },
  {
    method: "POST",
    path: path("\\/complete"),
    async handle(ctx, match) {
      requireInspectionAccess(ctx.user, "edit");
      const payload = await ctx.readJson();
      return { inspection: completeInspection(ctx.db, ctx.user, match[1], payload, ctx.ip) };
    },
  },
  { method: "POST", path: path("\\/documents"), handle: (ctx, match) => upload(ctx, match[1]) },
  {
    method: "GET",
    path: path(`\\/documents\\/${ID}\\/file`),
    handle: (ctx, match) => download(ctx, match[1], match[2]),
  },
  {
    method: "POST",
    path: path("\\/follow-ups"),
    async handle(ctx, match) {
      requireInspectionAccess(ctx.user, "edit");
      const payload = await ctx.readJson();
      ctx.status = 201;
      return { followUp: createFollowUp(ctx.db, ctx.user, match[1], payload, ctx.ip) };
    },
  },
  {
    method: "PUT",
    path: path(`\\/follow-ups\\/${ID}`),
    async handle(ctx, match) {
      requireInspectionAccess(ctx.user, "edit");
      const payload = await ctx.readJson();
      return {
        followUp: completeFollowUp(ctx.db, ctx.user, match[1], match[2], payload, ctx.ip),
      };
    },
  },
];
