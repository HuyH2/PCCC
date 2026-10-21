import { pagination } from "../../core/validation.js";
import { authenticate } from "../auth/auth.service.js";
import {
  createFacility,
  getFacility,
  listFacilities,
  listFacilityOptions,
} from "./facilities.service.js";
import {
  getFacilityStatus,
  listFacilityStatusHistory,
  listFacilityChanges,
  listFacilityTimeline,
  listFacilityViolations,
  updateFacilityDetails,
  updateFacilityStatus,
} from "./facility-history.service.js";
import {
  deactivateFacilityPersonnel,
  facilityAttachmentFile,
  getFacilityPersonnel,
  listFacilityAttachments,
  listFacilityPersonnel,
  saveFacilityPersonnel,
  softDeleteFacilityAttachment,
  uploadFacilityAttachment,
} from "./facility-profile.service.js";

function sendAttachment(ctx, facilityId, attachmentId, disposition) {
  const { attachment, bytes } = facilityAttachmentFile(
    ctx.db,
    ctx.user,
    facilityId,
    attachmentId,
    ctx.uploadDirectory,
  );
  ctx.response.statusCode = 200;
  ctx.response.setHeader("Content-Type", attachment.content_type);
  ctx.response.setHeader("Content-Length", bytes.length);
  ctx.response.setHeader(
    "Content-Disposition",
    `${disposition}; filename="attachment.${attachment.storage_path.split(".").at(-1)}"; filename*=UTF-8''${encodeURIComponent(attachment.original_name).replace(/'/g, "%27")}`,
  );
  ctx.response.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
  ctx.response.end(bytes);
}

export const facilitiesRoutes = [
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/personnel$/,
    handle: (ctx, match) =>
      listFacilityPersonnel(ctx.db, ctx.user, decodeURIComponent(match[1]), ctx.url),
  },
  {
    method: "POST",
    path: /^\/api\/facilities\/([^/]+)\/personnel$/,
    handle: async (ctx, match) => {
      ctx.status = 201;
      return saveFacilityPersonnel(
        ctx.db,
        ctx.user,
        decodeURIComponent(match[1]),
        await ctx.readJson(),
        null,
        ctx.ip,
      );
    },
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/personnel\/([^/]+)$/,
    handle: (ctx, match) =>
      getFacilityPersonnel(
        ctx.db,
        ctx.user,
        decodeURIComponent(match[1]),
        decodeURIComponent(match[2]),
      ),
  },
  {
    method: "PUT",
    path: /^\/api\/facilities\/([^/]+)\/personnel\/([^/]+)$/,
    handle: async (ctx, match) =>
      saveFacilityPersonnel(
        ctx.db,
        ctx.user,
        decodeURIComponent(match[1]),
        await ctx.readJson(),
        decodeURIComponent(match[2]),
        ctx.ip,
      ),
  },
  {
    method: "DELETE",
    path: /^\/api\/facilities\/([^/]+)\/personnel\/([^/]+)$/,
    handle: (ctx, match) =>
      deactivateFacilityPersonnel(
        ctx.db,
        ctx.user,
        decodeURIComponent(match[1]),
        decodeURIComponent(match[2]),
        ctx.ip,
      ),
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/attachments$/,
    handle: (ctx, match) =>
      listFacilityAttachments(ctx.db, ctx.user, decodeURIComponent(match[1]), ctx.url),
  },
  {
    method: "POST",
    path: /^\/api\/facilities\/([^/]+)\/attachments$/,
    handle: async (ctx, match) => {
      ctx.status = 201;
      return uploadFacilityAttachment(
        ctx.db,
        ctx.user,
        decodeURIComponent(match[1]),
        ctx.request,
        ctx.ip,
        ctx.uploadDirectory,
        () => authenticate(ctx.db, ctx.token),
      );
    },
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/attachments\/([^/]+)\/view$/,
    handle: (ctx, match) =>
      sendAttachment(ctx, decodeURIComponent(match[1]), decodeURIComponent(match[2]), "inline"),
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/attachments\/([^/]+)\/download$/,
    handle: (ctx, match) =>
      sendAttachment(ctx, decodeURIComponent(match[1]), decodeURIComponent(match[2]), "attachment"),
  },
  {
    method: "DELETE",
    path: /^\/api\/facilities\/([^/]+)\/attachments\/([^/]+)$/,
    handle: (ctx, match) =>
      softDeleteFacilityAttachment(
        ctx.db,
        ctx.user,
        decodeURIComponent(match[1]),
        decodeURIComponent(match[2]),
        ctx.ip,
      ),
  },
  {
    method: "GET",
    path: "/api/violations",
    handle: (ctx) => listFacilityViolations(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "GET",
    path: "/api/facilities/options",
    handle: (ctx) => listFacilityOptions(ctx.db, ctx.user),
  },
  {
    method: "POST",
    path: "/api/facilities",
    async handle(ctx) {
      const input = await ctx.readJson();
      ctx.status = 201;
      return createFacility(ctx.db, ctx.user, input, ctx.ip);
    },
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/status$/,
    handle: (ctx, match) => getFacilityStatus(ctx.db, ctx.user, decodeURIComponent(match[1])),
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/status-history$/,
    handle: (ctx, match) =>
      listFacilityStatusHistory(ctx.db, ctx.user, decodeURIComponent(match[1]), ctx.url),
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/changes$/,
    handle: (ctx, match) =>
      listFacilityChanges(ctx.db, ctx.user, decodeURIComponent(match[1]), ctx.url),
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/timeline$/,
    handle: (ctx, match) =>
      listFacilityTimeline(ctx.db, ctx.user, decodeURIComponent(match[1]), ctx.url),
  },
  {
    method: "PUT",
    path: /^\/api\/facilities\/([^/]+)\/status$/,
    handle: async (ctx, match) =>
      updateFacilityStatus(
        ctx.db,
        ctx.user,
        decodeURIComponent(match[1]),
        await ctx.readJson(),
        ctx.ip,
      ),
  },
  {
    method: "PUT",
    path: /^\/api\/facilities\/([^/]+)$/,
    handle: async (ctx, match) =>
      updateFacilityDetails(
        ctx.db,
        ctx.user,
        decodeURIComponent(match[1]),
        await ctx.readJson(),
        ctx.ip,
      ),
  },
  {
    method: "GET",
    path: "/api/facilities",
    handle: (ctx) =>
      listFacilities(ctx.db, ctx.user, {
        ...pagination(ctx.url),
        search: ctx.url.searchParams.get("search") ?? "",
        regionId: ctx.url.searchParams.get("regionId") ?? "",
        officerId: ctx.url.searchParams.get("officerId") ?? "",
        status: ctx.url.searchParams.get("status") ?? "",
      }),
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)$/,
    handle: (ctx, match) => getFacility(ctx.db, ctx.user, decodeURIComponent(match[1])),
  },
];
