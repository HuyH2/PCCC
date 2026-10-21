import { globalSearch } from "./search.service.js";

// UC-SYS-01
export const searchRoutes = [
  { method: "GET", path: "/api/search", handle: (ctx) => globalSearch(ctx.db, ctx.user, ctx.url) },
];
