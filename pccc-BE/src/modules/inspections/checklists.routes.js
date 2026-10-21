import {
  requireChecklistAuthor,
  listChecklists,
  checklistDetail,
  createChecklist,
} from "./checklists.service.js";

const ID = "([a-zA-Z0-9-]+)";

export const checklistRoutes = [
  {
    method: "GET",
    path: "/api/inspection-checklists",
    handle: async (ctx) => await listChecklists(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "POST",
    path: "/api/inspection-checklists",
    async handle(ctx) {
      requireChecklistAuthor(ctx.user);
      const payload = await ctx.readJson(262144);
      ctx.status = 201;
      return await createChecklist(ctx.db, ctx.user, payload, ctx.ip);
    },
  },
  {
    method: "GET",
    path: new RegExp(`^\\/api\\/inspection-checklists\\/${ID}$`),
    handle: async (ctx, match) => await checklistDetail(ctx.db, ctx.user, match[1]),
  },
];
