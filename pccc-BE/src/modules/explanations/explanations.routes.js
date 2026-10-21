import {
  createExplanation,
  getExplanation,
  listExplanations,
  reviewExplanation,
  submitExplanation,
} from "./explanations.service.js";

const id = "([1-9][0-9]*)";
const detailPath = new RegExp(`^/api/explanations/${id}$`);
const responsePath = new RegExp(`^/api/explanations/${id}/response$`);
const reviewPath = new RegExp(`^/api/explanations/${id}/review$`);

export const explanationsRoutes = [
  {
    method: "GET",
    path: "/api/explanations",
    handle: async (ctx) => await listExplanations(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "POST",
    path: "/api/explanations",
    async handle(ctx) {
      const result = await createExplanation(ctx.db, ctx.user, await ctx.readJson(), ctx.ip);
      ctx.status = 201;
      return result;
    },
  },
  {
    method: "GET",
    path: detailPath,
    handle: async (ctx, match) => await getExplanation(ctx.db, ctx.user, Number(match[1])),
  },
  {
    method: "PUT",
    path: responsePath,
    async handle(ctx, match) {
      return await submitExplanation(
        ctx.db,
        ctx.user,
        Number(match[1]),
        await ctx.readJson(),
        ctx.ip,
      );
    },
  },
  {
    method: "PUT",
    path: reviewPath,
    async handle(ctx, match) {
      return await reviewExplanation(
        ctx.db,
        ctx.user,
        Number(match[1]),
        await ctx.readJson(),
        ctx.ip,
      );
    },
  },
];
