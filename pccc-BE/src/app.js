import { createServer } from "node:http";
import { ApiError, assert } from "./core/errors.js";
import { cookieValue, findRoute, readJson } from "./core/http.js";
import { authenticate, COOKIE_NAME, createAuthentication } from "./modules/auth/auth.service.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { administrationRoutes } from "./modules/administration/administration.routes.js";
import { facilitiesRoutes } from "./modules/facilities/facilities.routes.js";
import { searchRoutes } from "./modules/search/search.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";
import { legalDocumentsRoutes } from "./modules/legal-documents/legal-documents.routes.js";
import { inspectionsRoutes } from "./modules/inspections/inspections.routes.js";
import { inspectionPlanningRoutes } from "./modules/inspection-planning/inspection-planning.routes.js";
import { regionsRoutes } from "./modules/regions/regions.routes.js";
import { tasksRoutes } from "./modules/tasks/tasks.routes.js";
import { kpiRoutes } from "./modules/kpi/kpi.routes.js";
import { explanationsRoutes } from "./modules/explanations/explanations.routes.js";
import { incidentRoutes } from "./modules/incidents/incidents.routes.js";
import { organizationRoutes } from "./modules/organization/organization.routes.js";
import { dataTransferRoutes } from "./modules/data-transfer/data-transfer.routes.js";
import { violationsRoutes } from "./modules/violations/violations.routes.js";

// Modular monolith: each business module registers its routes here; all share one process and DB.
const routes = [
  { method: "GET", path: "/api/health", public: true, handle: () => ({ status: "ok" }) },
  ...authRoutes,
  ...incidentRoutes,
  ...organizationRoutes,
  ...violationsRoutes,
  ...administrationRoutes,
  ...facilitiesRoutes,
  ...searchRoutes,
  ...dashboardRoutes,
  ...auditRoutes,
  ...legalDocumentsRoutes,
  ...inspectionPlanningRoutes,
  ...inspectionsRoutes,
  ...regionsRoutes,
  ...tasksRoutes,
  ...kpiRoutes,
  ...explanationsRoutes,
  ...dataTransferRoutes,
];

export function createApp(
  db,
  {
    appOrigin = "http://localhost:3000",
    secureCookie = false,
    ttlSeconds = 28800,
    logger = console,
    uploadDirectory,
    incidentNow = Date.now,
  } = {},
) {
  assert(
    Number.isInteger(ttlSeconds) && ttlSeconds >= 60 && ttlSeconds <= 604800,
    500,
    "CONFIGURATION",
    "SESSION_TTL_SECONDS không hợp lệ.",
  );
  assert(
    new URL(appOrigin).origin === appOrigin,
    500,
    "CONFIGURATION",
    "APP_ORIGIN phải là origin hợp lệ không có dấu / cuối.",
  );
  const auth = createAuthentication(db, { ttlSeconds });
  const cookie = (token, maxAge) =>
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureCookie ? "; Secure" : ""}`;

  return createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Vary", "Origin");
    const origin = request.headers.origin;
    if (origin === appOrigin) {
      response.setHeader("Access-Control-Allow-Origin", appOrigin);
      response.setHeader("Access-Control-Allow-Credentials", "true");
    }
    const send = (status, data) => {
      response.statusCode = status;
      response.end(JSON.stringify(data));
    };
    try {
      assert(
        !origin || origin === appOrigin,
        403,
        "INVALID_ORIGIN",
        "Nguồn yêu cầu không được phép.",
      );
      if (request.method === "OPTIONS") {
        response.setHeader(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        );
        response.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, X-File-Name, X-Document-Version, X-Document-Kind, X-Record-Number, X-Document-Description",
        );
        response.statusCode = 204;
        response.end();
        return;
      }
      const url = new URL(request.url, "http://localhost");
      const method = request.method;
      const ip = request.socket.remoteAddress || "unknown"; // Never trust spoofable X-Forwarded-For.
      const found = findRoute(routes, method, url.pathname);
      if (!["GET", "HEAD"].includes(method))
        assert(
          origin === appOrigin,
          403,
          "INVALID_ORIGIN",
          "Yêu cầu thay đổi dữ liệu phải có Origin hợp lệ.",
        );
      const token = cookieValue(request, COOKIE_NAME);
      const ctx = {
        db,
        auth,
        request,
        response,
        url,
        method,
        ip,
        token,
        uploadDirectory,
        incidentNow,
        readJson: (limit) => readJson(request, limit),
        setSessionCookie: (value) => response.setHeader("Set-Cookie", cookie(value, ttlSeconds)),
        clearSessionCookie: () => response.setHeader("Set-Cookie", cookie("", 0)),
      };
      // Every non-public route (and unknown paths) requires a valid session first.
      if (!found?.route.public) ctx.user = authenticate(db, token);
      if (found) {
        const body = await found.route.handle(ctx, found.match);
        if (!response.writableEnded) send(ctx.status ?? 200, body);
        return;
      }
      throw new ApiError(404, "NOT_FOUND", "API không tồn tại.");
    } catch (error) {
      if (error instanceof ApiError)
        return send(error.status, { error: { code: error.code, message: error.message } });
      // Do not log request bodies, credentials, cookies, or database error parameters.
      logger.error("Backend request failed", { name: error.name });
      return send(500, {
        error: { code: "INTERNAL_ERROR", message: "Không thể xử lý yêu cầu. Vui lòng thử lại." },
      });
    }
  });
}
