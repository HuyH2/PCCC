import {
  createTask,
  deleteTaskMessage,
  editTaskMessage,
  listTaskAssignees,
  listTaskMessages,
  listTaskProgressHistory,
  listTasks,
  sendTaskMessage,
  taskDetail,
  updateTaskProgress,
  updateTaskStatus,
} from "./tasks.service.js";

const id = "([a-zA-Z0-9-]+)";
const messageId = "([1-9][0-9]*)";
const taskPath = new RegExp(`^/api/tasks/${id}$`);
const messagesPath = new RegExp(`^/api/tasks/${id}/messages$`);
const messagePath = new RegExp(`^/api/tasks/${id}/messages/${messageId}$`);
const progressPath = new RegExp(`^/api/tasks/${id}/progress$`);
const progressHistoryPath = new RegExp(`^/api/tasks/${id}/progress-history$`);
const statusPath = new RegExp(`^/api/tasks/${id}/status$`);

export const tasksRoutes = [
  { method: "GET", path: "/api/tasks", handle: (ctx) => listTasks(ctx.db, ctx.user, ctx.url) },
  {
    method: "GET",
    path: "/api/tasks/assignees",
    handle: (ctx) => listTaskAssignees(ctx.db, ctx.user),
  },
  {
    method: "GET",
    path: "/api/tasks/assigned",
    handle: (ctx) => listTasks(ctx.db, ctx.user, ctx.url, "assigned"),
  },
  {
    method: "GET",
    path: "/api/tasks/mine",
    handle: (ctx) => listTasks(ctx.db, ctx.user, ctx.url, "mine"),
  },
  {
    method: "POST",
    path: "/api/tasks",
    async handle(ctx) {
      const result = createTask(ctx.db, ctx.user, await ctx.readJson(), ctx.ip);
      ctx.status = 201;
      return result;
    },
  },
  { method: "GET", path: taskPath, handle: (ctx, match) => taskDetail(ctx.db, ctx.user, match[1]) },
  {
    method: "GET",
    path: progressHistoryPath,
    handle: (ctx, match) => listTaskProgressHistory(ctx.db, ctx.user, match[1], ctx.url),
  },
  {
    method: "PUT",
    path: progressPath,
    async handle(ctx, match) {
      return updateTaskProgress(ctx.db, ctx.user, match[1], await ctx.readJson(), ctx.ip);
    },
  },
  {
    method: "PUT",
    path: statusPath,
    async handle(ctx, match) {
      return updateTaskStatus(ctx.db, ctx.user, match[1], await ctx.readJson(), ctx.ip);
    },
  },
  {
    method: "GET",
    path: messagesPath,
    handle: (ctx, match) => listTaskMessages(ctx.db, ctx.user, match[1], ctx.url),
  },
  {
    method: "POST",
    path: messagesPath,
    async handle(ctx, match) {
      const input = await ctx.readJson();
      const result = sendTaskMessage(ctx.db, ctx.user, match[1], input, ctx.ip);
      ctx.status = 201;
      return result;
    },
  },
  {
    method: "PUT",
    path: messagePath,
    async handle(ctx, match) {
      return editTaskMessage(
        ctx.db,
        ctx.user,
        match[1],
        Number(match[2]),
        await ctx.readJson(),
        ctx.ip,
      );
    },
  },
  {
    method: "DELETE",
    path: messagePath,
    handle: (ctx, match) => deleteTaskMessage(ctx.db, ctx.user, match[1], Number(match[2]), ctx.ip),
  },
];
