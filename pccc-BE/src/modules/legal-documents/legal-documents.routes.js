import { ApiError, assert } from "../../core/errors.js";
import {
  documentCategories,
  documentDetail,
  documentHistory,
  listDocuments,
  saveDocument,
  replaceDocumentFile,
  requireDocumentAccess,
  MAX_DOCUMENT_BYTES,
  DOCUMENT_SIZE_MESSAGE,
} from "./legal-documents.service.js";

// M05 — JSON payload carries the PDF as base64, so allow its encoded size plus metadata.
const DOCUMENT_JSON_LIMIT = Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4 + 20000;
const DOCUMENT_PATH = /^\/api\/legal-documents\/([a-zA-Z0-9-]+)$/;
const FILE_PATH = /^\/api\/legal-documents\/([a-zA-Z0-9-]+)\/file$/;

function downloadFile(ctx, id) {
  documentDetail(ctx.db, ctx.user, id);
  const file = ctx.db.prepare("SELECT file_name,file_data FROM legal_documents WHERE id=?").get(id);
  assert(file.file_data, 404, "NOT_FOUND", "Văn bản không có file đính kèm.");
  const { response } = ctx;
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
  );
  response.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
  response.end(Buffer.from(file.file_data));
}

async function uploadFile(ctx, id) {
  requireDocumentAccess(ctx.user, "edit");
  documentDetail(ctx.db, ctx.user, id);
  const { request } = ctx;
  assert(
    request.headers["content-type"] === "application/pdf",
    415,
    "UNSUPPORTED_MEDIA_TYPE",
    "Yêu cầu file PDF.",
  );
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    assert(size <= MAX_DOCUMENT_BYTES, 413, "FILE_TOO_LARGE", DOCUMENT_SIZE_MESSAGE);
    chunks.push(chunk);
  }
  let name;
  try {
    name = decodeURIComponent(request.headers["x-file-name"] ?? "");
  } catch {
    throw new ApiError(400, "INVALID_INPUT", "Tên file không hợp lệ.");
  }
  return {
    document: replaceDocumentFile(
      ctx.db,
      ctx.user,
      id,
      name,
      Buffer.concat(chunks),
      Number(request.headers["x-document-version"]),
      ctx.ip,
    ),
  };
}

export const legalDocumentsRoutes = [
  {
    method: "GET",
    path: "/api/legal-document-categories",
    handle: (ctx) => ({
      items: documentCategories(ctx.db, ctx.user),
      maxFileBytes: MAX_DOCUMENT_BYTES,
    }),
  },
  {
    method: "GET",
    path: "/api/legal-documents",
    handle: (ctx) => listDocuments(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "POST",
    path: "/api/legal-documents",
    async handle(ctx) {
      requireDocumentAccess(ctx.user, "create");
      const payload = await ctx.readJson(DOCUMENT_JSON_LIMIT);
      ctx.status = 201;
      return { document: saveDocument(ctx.db, ctx.user, payload, null, ctx.ip) };
    },
  },
  {
    method: "GET",
    path: DOCUMENT_PATH,
    handle: (ctx, match) => ({ document: documentDetail(ctx.db, ctx.user, match[1]) }),
  },
  {
    method: "PUT",
    path: DOCUMENT_PATH,
    async handle(ctx, match) {
      requireDocumentAccess(ctx.user, "edit");
      const payload = await ctx.readJson(DOCUMENT_JSON_LIMIT);
      return { document: saveDocument(ctx.db, ctx.user, payload, match[1], ctx.ip) };
    },
  },
  {
    method: "GET",
    path: /^\/api\/legal-documents\/([a-zA-Z0-9-]+)\/history$/,
    handle: (ctx, match) => documentHistory(ctx.db, ctx.user, match[1], ctx.url),
  },
  { method: "GET", path: FILE_PATH, handle: (ctx, match) => downloadFile(ctx, match[1]) },
  { method: "POST", path: FILE_PATH, handle: (ctx, match) => uploadFile(ctx, match[1]) },
];
