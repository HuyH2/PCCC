import { ApiError, assert } from "../../core/errors.js";
import { sendFile } from "../../core/http.js";
import { requireInspectionAccess, scopedInspection } from "./inspections.service.js";
import {
  listInspections,
  createInspection,
  inspectionDetail,
  saveResults,
  saveConclusion,
  completeInspection,
} from "./inspections.service.js";
import { validateInspectionFile, uploadDocument, documentFile } from "./documents.service.js";
import { createFollowUp, completeFollowUp } from "./follow-ups.service.js";
import { checklistRoutes } from "./checklists.routes.js";
import {
  MAX_INSPECTION_FILE_BYTES,
  INSPECTION_FILE_SIZE_MESSAGE,
} from "./inspections.constants.js";

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
  await scopedInspection(ctx.db, ctx.user, id);
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
    document: await uploadDocument(
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

const inspectionOnlyRoutes = [
  {
    method: "GET",
    path: "/api/inspections",
    handle: async (ctx) => await listInspections(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "POST",
    path: "/api/inspections",
    async handle(ctx) {
      requireInspectionAccess(ctx.user, "create");
      const payload = await ctx.readJson();
      ctx.status = 201;
      return { inspection: await createInspection(ctx.db, ctx.user, payload, ctx.ip) };
    },
  },
  {
    method: "GET",
    path: path(),
    handle: async (ctx, match) => await inspectionDetail(ctx.db, ctx.user, match[1]),
  },
  {
    method: "PUT",
    path: path("\\/results"),
    async handle(ctx, match) {
      requireInspectionAccess(ctx.user, "edit");
      return await saveResults(ctx.db, ctx.user, match[1], await ctx.readJson(65536), ctx.ip);
    },
  },
  {
    method: "PUT",
    path: path("\\/conclusion"),
    async handle(ctx, match) {
      requireInspectionAccess(ctx.user, "edit");
      const payload = await ctx.readJson();
      return { inspection: await saveConclusion(ctx.db, ctx.user, match[1], payload, ctx.ip) };
    },
  },
  {
    method: "POST",
    path: path("\\/complete"),
    async handle(ctx, match) {
      requireInspectionAccess(ctx.user, "edit");
      const payload = await ctx.readJson();
      return { inspection: await completeInspection(ctx.db, ctx.user, match[1], payload, ctx.ip) };
    },
  },
  {
    method: "POST",
    path: path("\\/documents"),
    handle: async (ctx, match) => await upload(ctx, match[1]),
  },
  {
    method: "GET",
    path: path(`\\/documents\\/${ID}\\/file`),
    handle: async (ctx, match) =>
      sendFile(ctx.response, await documentFile(ctx.db, ctx.user, match[1], match[2])),
  },
  {
    method: "POST",
    path: path("\\/follow-ups"),
    async handle(ctx, match) {
      requireInspectionAccess(ctx.user, "edit");
      const payload = await ctx.readJson();
      ctx.status = 201;
      return { followUp: await createFollowUp(ctx.db, ctx.user, match[1], payload, ctx.ip) };
    },
  },
  {
    method: "PUT",
    path: path(`\\/follow-ups\\/${ID}`),
    async handle(ctx, match) {
      requireInspectionAccess(ctx.user, "edit");
      const payload = await ctx.readJson();
      return {
        followUp: await completeFollowUp(ctx.db, ctx.user, match[1], match[2], payload, ctx.ip),
      };
    },
  },
];

// Combined export: checklists + inspections — app.js imports this as inspectionsRoutes.
export const inspectionsRoutes = [...checklistRoutes, ...inspectionOnlyRoutes];
