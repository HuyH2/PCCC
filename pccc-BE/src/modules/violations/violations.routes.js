import {
  addEvidence,
  addRemediation,
  createSuspension,
  createViolation,
  decideApproval,
  evidenceBodyMaxBytes,
  listViolationFacilities,
  listViolations,
  readEvidence,
  submitApproval,
  updateSuspension,
  updateViolation,
  violationDetail,
} from "../../core/violations.js";
import { listFacilityViolations } from "../facilities/facility-history.service.js";

export const violationsRoutes = [
  {
    method: "GET",
    path: "/api/violations",
    handle: async (ctx) =>
      ctx.user.permissions.includes("M04.view")
        ? await listViolations(ctx.db, ctx.user, ctx.url)
        : await listFacilityViolations(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "GET",
    path: "/api/violations/facilities",
    handle: async (ctx) => await listViolationFacilities(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "POST",
    path: "/api/violations",
    handle: async (ctx) => {
      ctx.status = 201;
      return { violation: await createViolation(ctx.db, ctx.user, await ctx.readJson(), ctx.ip) };
    },
  },
  {
    method: "GET",
    path: /^\/api\/violations\/([^/]+)$/,
    handle: async (ctx, match) =>
      await violationDetail(ctx.db, ctx.user, decodeURIComponent(match[1])),
  },
  {
    method: "PUT",
    path: /^\/api\/violations\/([^/]+)$/,
    handle: async (ctx, match) => ({
      violation: await updateViolation(
        ctx.db,
        ctx.user,
        decodeURIComponent(match[1]),
        await ctx.readJson(),
        ctx.ip,
      ),
    }),
  },
  {
    method: "POST",
    path: /^\/api\/violations\/([^/]+)\/suspension$/,
    handle: async (ctx, match) => {
      ctx.status = 201;
      return {
        suspension: await createSuspension(
          ctx.db,
          ctx.user,
          decodeURIComponent(match[1]),
          await ctx.readJson(),
          ctx.ip,
        ),
      };
    },
  },
  {
    method: "PUT",
    path: /^\/api\/violations\/([^/]+)\/suspension$/,
    handle: async (ctx, match) => ({
      suspension: await updateSuspension(
        ctx.db,
        ctx.user,
        decodeURIComponent(match[1]),
        await ctx.readJson(),
        ctx.ip,
      ),
    }),
  },
  {
    method: "POST",
    path: /^\/api\/violations\/([^/]+)\/remediation$/,
    handle: async (ctx, match) => {
      ctx.status = 201;
      return {
        remediation: await addRemediation(
          ctx.db,
          ctx.user,
          decodeURIComponent(match[1]),
          await ctx.readJson(),
          ctx.ip,
        ),
      };
    },
  },
  {
    method: "POST",
    path: /^\/api\/violations\/([^/]+)\/evidences$/,
    handle: async (ctx, match) => {
      ctx.status = 201;
      return {
        evidence: await addEvidence(
          ctx.db,
          ctx.user,
          decodeURIComponent(match[1]),
          await ctx.readJson(evidenceBodyMaxBytes),
          ctx.ip,
        ),
      };
    },
  },
  {
    method: "GET",
    path: /^\/api\/violations\/([^/]+)\/evidences\/([^/]+)$/,
    handle: async (ctx, match) => {
      const evidence = await readEvidence(
        ctx.db,
        ctx.user,
        decodeURIComponent(match[1]),
        decodeURIComponent(match[2]),
      );
      ctx.response.setHeader("Content-Type", evidence.media_type);
      ctx.response.setHeader("Content-Length", String(evidence.file_size));
      ctx.response.end(evidence.content);
      return undefined;
    },
  },
  {
    method: "POST",
    path: /^\/api\/violations\/([^/]+)\/submit-approval$/,
    handle: async (ctx, match) => ({
      violation: await submitApproval(ctx.db, ctx.user, decodeURIComponent(match[1]), ctx.ip),
    }),
  },
  {
    method: "POST",
    path: /^\/api\/violations\/([^/]+)\/approve$/,
    handle: async (ctx, match) => ({
      violation: await decideApproval(
        ctx.db,
        ctx.user,
        decodeURIComponent(match[1]),
        await ctx.readJson(),
        true,
        ctx.ip,
      ),
    }),
  },
  {
    method: "POST",
    path: /^\/api\/violations\/([^/]+)\/reject$/,
    handle: async (ctx, match) => ({
      violation: await decideApproval(
        ctx.db,
        ctx.user,
        decodeURIComponent(match[1]),
        await ctx.readJson(),
        false,
        ctx.ip,
      ),
    }),
  },
];
