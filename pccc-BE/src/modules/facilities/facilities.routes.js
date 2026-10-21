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

async function sendAttachment(ctx, facilityId, attachmentId, disposition) {
  const { attachment, bytes } = await facilityAttachmentFile(
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
    handle: async (ctx, match) =>
      await listFacilityPersonnel(ctx.db, ctx.user, decodeURIComponent(match[1]), ctx.url),
  },
  {
    method: "POST",
    path: /^\/api\/facilities\/([^/]+)\/personnel$/,
    handle: async (ctx, match) => {
      ctx.status = 201;
      return await saveFacilityPersonnel(
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
    handle: async (ctx, match) =>
      await getFacilityPersonnel(
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
      await saveFacilityPersonnel(
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
    handle: async (ctx, match) =>
      await deactivateFacilityPersonnel(
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
    handle: async (ctx, match) =>
      await listFacilityAttachments(ctx.db, ctx.user, decodeURIComponent(match[1]), ctx.url),
  },
  {
    method: "POST",
    path: /^\/api\/facilities\/([^/]+)\/attachments$/,
    handle: async (ctx, match) => {
      ctx.status = 201;
      return await uploadFacilityAttachment(
        ctx.db,
        ctx.user,
        decodeURIComponent(match[1]),
        ctx.request,
        ctx.ip,
        ctx.uploadDirectory,
        async () => await authenticate(ctx.db, ctx.token),
      );
    },
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/attachments\/([^/]+)\/view$/,
    handle: async (ctx, match) =>
      await sendAttachment(
        ctx,
        decodeURIComponent(match[1]),
        decodeURIComponent(match[2]),
        "inline",
      ),
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/attachments\/([^/]+)\/download$/,
    handle: async (ctx, match) =>
      await sendAttachment(
        ctx,
        decodeURIComponent(match[1]),
        decodeURIComponent(match[2]),
        "attachment",
      ),
  },
  {
    method: "DELETE",
    path: /^\/api\/facilities\/([^/]+)\/attachments\/([^/]+)$/,
    handle: async (ctx, match) =>
      await softDeleteFacilityAttachment(
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
    handle: async (ctx) => await listFacilityViolations(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "GET",
    path: "/api/facilities/options",
    handle: async (ctx) => await listFacilityOptions(ctx.db, ctx.user),
  },
  {
    method: "POST",
    path: "/api/facilities",
    async handle(ctx) {
      const input = await ctx.readJson();
      ctx.status = 201;
      return await createFacility(ctx.db, ctx.user, input, ctx.ip);
    },
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/status$/,
    handle: async (ctx, match) =>
      await getFacilityStatus(ctx.db, ctx.user, decodeURIComponent(match[1])),
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/status-history$/,
    handle: async (ctx, match) =>
      await listFacilityStatusHistory(ctx.db, ctx.user, decodeURIComponent(match[1]), ctx.url),
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/changes$/,
    handle: async (ctx, match) =>
      await listFacilityChanges(ctx.db, ctx.user, decodeURIComponent(match[1]), ctx.url),
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)\/timeline$/,
    handle: async (ctx, match) =>
      await listFacilityTimeline(ctx.db, ctx.user, decodeURIComponent(match[1]), ctx.url),
  },
  {
    method: "PUT",
    path: /^\/api\/facilities\/([^/]+)\/status$/,
    handle: async (ctx, match) =>
      await updateFacilityStatus(
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
      await updateFacilityDetails(
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
    handle: async (ctx) =>
      await listFacilities(ctx.db, ctx.user, {
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
    handle: async (ctx, match) => await getFacility(ctx.db, ctx.user, decodeURIComponent(match[1])),
  },
];
