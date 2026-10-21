import { ApiError } from "../../core/errors.js";
import { authenticate } from "../auth/auth.service.js";
import { handleOrganization } from "../../core/organization.js";

// The M02 directory keeps its detailed region catalog under /api/organization/regions.
// /api/regions remains the assignment API used by UC-ORG-03.
const paths = [
  /^\/api\/organization\/(?:tree|options|regions(?:\/[^/]+(?:\/status)?)?)$/,
  /^\/api\/officers(?:\/[^/]+(?:\/status)?)?$/,
  /^\/api\/units(?:\/[^/]+(?:\/status)?)?$/,
];

const handle = async (ctx) => {
  let result;
  const path = ctx.url.pathname.replace(/^\/api\/organization\/regions/, "/api/regions");
  const handled = await handleOrganization({
    ...ctx,
    path,
    send: (status, body) => {
      ctx.status = status;
      result = body;
    },
    readBody: ctx.readJson,
    authenticateAgain: async () => await authenticate(ctx.db, ctx.token),
  });
  if (!handled) throw new ApiError(404, "NOT_FOUND", "API không tồn tại.");
  return result;
};

export const organizationRoutes = ["GET", "POST", "PATCH"].flatMap((method) =>
  paths.map((path) => ({ method, path, handle })),
);
