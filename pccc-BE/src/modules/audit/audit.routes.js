import { listAuditLogs } from "./audit.service.js";

// UC-SYS-05 — read-only audit log for system-wide administrators.
export const auditRoutes = [
  {
    method: "GET",
    path: "/api/audit-logs",
    handle: (ctx) => listAuditLogs(ctx.db, ctx.user, ctx.url),
  },
];
