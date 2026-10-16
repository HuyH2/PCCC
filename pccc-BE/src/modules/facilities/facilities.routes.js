import { pagination } from "../../core/validation.js";
import { getFacility, listFacilities } from "./facilities.service.js";

export const facilitiesRoutes = [
  {
    method: "GET",
    path: "/api/facilities",
    handle: (ctx) =>
      listFacilities(ctx.db, ctx.user, {
        ...pagination(ctx.url),
        search: ctx.url.searchParams.get("search") ?? "",
      }),
  },
  {
    method: "GET",
    path: /^\/api\/facilities\/([^/]+)$/,
    handle: (ctx, match) => getFacility(ctx.db, ctx.user, decodeURIComponent(match[1])),
  },
];
