import { ApiError } from "../../core/errors.js";
import { authenticate } from "../auth/auth.service.js";
import { handleIncidents } from "../../core/incidents.js";

const path = /^\/api\/incidents(?:\/.*)?$/;
const handle = async (ctx) => {
  let result;
  const handled = await handleIncidents({
    ...ctx,
    path: ctx.url.pathname,
    send: (status, body) => {
      ctx.status = status;
      result = body;
    },
    readBody: async () => await ctx.readJson(131072),
    authenticateAgain: async () => await authenticate(ctx.db, ctx.token),
    uploadDirectory: ctx.uploadDirectory,
    now: ctx.incidentNow,
  });
  if (!handled) throw new ApiError(404, "NOT_FOUND", "API không tồn tại.");
  return result;
};

export const incidentRoutes = ["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => ({
  method,
  path,
  handle,
}));
