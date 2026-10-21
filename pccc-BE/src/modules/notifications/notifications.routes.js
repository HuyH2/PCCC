import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications.service.js";
import { refreshReportReminders } from "../reports/reports.service.js";
import { createNotification } from "./notifications.service.js";

export const notificationRoutes = [
  {
    method: "POST",
    path: "/api/notifications",
    async handle(ctx) {
      const result = createNotification(ctx.db, ctx.user, await ctx.readJson(), ctx.ip);
      ctx.status = 201;
      return result;
    },
  },
  {
    method: "GET",
    path: "/api/notifications",
    handle(ctx) {
      refreshReportReminders(ctx.db, ctx.user);
      return listNotifications(ctx.db, ctx.user, ctx.url);
    },
  },
  {
    method: "POST",
    path: "/api/notifications/read-all",
    handle(ctx) {
      return markAllNotificationsRead(ctx.db, ctx.user);
    },
  },
  {
    method: "POST",
    path: /^\/api\/notifications\/([a-zA-Z0-9-]+)\/read$/,
    handle(ctx, match) {
      return markNotificationRead(ctx.db, ctx.user, match[1]);
    },
  },
];
