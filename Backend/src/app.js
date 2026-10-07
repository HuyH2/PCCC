import { createServer } from "node:http";
import { ApiError, assert } from "./errors.js";
import { authenticate, COOKIE_NAME, createAuthentication } from "./authentication.js";
import {
  facilityScope,
  permissionsFor,
  requireAdministrator,
  requirePermission,
  scopesFor,
} from "./authorization.js";
import { updateAccountAuthorization, updateRolePermissions } from "./administration.js";
import { object, pagination, text } from "./validation.js";

function cookieToken(request) {
  return (request.headers.cookie || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
}

async function readJson(request) {
  assert(
    request.headers["content-type"]?.split(";")[0].trim() === "application/json",
    415,
    "UNSUPPORTED_MEDIA_TYPE",
    "Yêu cầu Content-Type application/json.",
  );
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    assert(size <= 16384, 413, "BODY_TOO_LARGE", "Dữ liệu gửi lên quá lớn.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "INVALID_JSON", "JSON không hợp lệ.");
  }
}

export function createApp(
  db,
  {
    appOrigin = "http://localhost:3000",
    secureCookie = false,
    ttlSeconds = 28800,
    logger = console,
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
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
        response.statusCode = 204;
        response.end();
        return;
      }
      const url = new URL(request.url, "http://localhost");
      const path = url.pathname;
      const method = request.method;
      const ip = request.socket.remoteAddress || "unknown"; // Never trust spoofable X-Forwarded-For.
      if (method === "GET" && path === "/api/health") return send(200, { status: "ok" });
      if (!["GET", "HEAD"].includes(method))
        assert(
          origin === appOrigin,
          403,
          "INVALID_ORIGIN",
          "Yêu cầu thay đổi dữ liệu phải có Origin hợp lệ.",
        );
      const token = cookieToken(request);
      if (method === "POST" && path === "/api/auth/login") {
        const body = object(await readJson(request), ["username", "password"]);
        const username = text(body.username, "Tên đăng nhập", 1, 100).trim().toLowerCase();
        assert(
          /^[a-z0-9._-]+$/.test(username),
          400,
          "INVALID_INPUT",
          "Tên đăng nhập không hợp lệ.",
        );
        const password = text(body.password, "Mật khẩu", 1, 256);
        const result = await auth.login(username, password, ip);
        // Rotate any previous session; its token must no longer work.
        auth.logout(token, ip);
        response.setHeader("Set-Cookie", cookie(result.token, ttlSeconds));
        return send(200, {
          user: result.user,
          redirectTo: result.user.mustChangePassword
            ? "/doi-mat-khau"
            : result.user.role === "A05"
              ? "/quan-tri/vai-tro"
              : "/",
        });
      }
      if (method === "POST" && path === "/api/auth/logout") {
        auth.logout(token, ip);
        response.setHeader("Set-Cookie", cookie("", 0));
        return send(200, { message: "Đã đăng xuất." });
      }
      const user = authenticate(db, token);
      if (method === "GET" && path === "/api/auth/me") return send(200, { user });
      if (method === "POST" && path === "/api/auth/skip-password-change") {
        auth.skipPasswordChange(user, ip);
        return send(200, {
          message: "Đã bỏ qua đổi mật khẩu.",
          redirectTo: user.role === "A05" ? "/quan-tri/vai-tro" : "/",
        });
      }
      if (method === "POST" && path === "/api/auth/change-password") {
        const body = object(await readJson(request), ["currentPassword", "newPassword"]);
        await auth.changePassword(
          user,
          text(body.currentPassword, "Mật khẩu hiện tại", 1, 256),
          text(body.newPassword, "Mật khẩu mới", 12, 256),
          ip,
        );
        response.setHeader("Set-Cookie", cookie("", 0));
        return send(200, { message: "Đã đổi mật khẩu. Vui lòng đăng nhập lại." });
      }
      if (method === "GET" && path === "/api/authorization/roles") {
        requireAdministrator(user, "M01.view");
        return send(200, {
          roles: db
            .prepare("SELECT * FROM roles ORDER BY code")
            .all()
            .map((r) => ({ ...r, permissions: permissionsFor(db, r.code) })),
          permissions: db.prepare("SELECT * FROM permissions ORDER BY code").all(),
        });
      }
      const roleMatch = path.match(/^\/api\/authorization\/roles\/(A0[1-7])\/permissions$/);
      if (method === "PUT" && roleMatch) {
        requireAdministrator(user);
        const payload = await readJson(request);
        updateRolePermissions(db, authenticate(db, token), roleMatch[1], payload, ip);
        return send(200, { permissions: permissionsFor(db, roleMatch[1]) });
      }
      const accountMatch = path.match(/^\/api\/authorization\/accounts\/([^/]+)$/);
      if (accountMatch && (method === "GET" || method === "PUT")) {
        requireAdministrator(user, method === "GET" ? "M01.view" : "M01.edit");
        const id = decodeURIComponent(accountMatch[1]);
        const account = db
          .prepare(
            "SELECT id,username,full_name,officer_id,role_code,status,must_change_password FROM accounts WHERE id=?",
          )
          .get(id);
        assert(account, 404, "NOT_FOUND", "Không tìm thấy tài khoản.");
        if (method === "PUT") {
          const payload = await readJson(request);
          updateAccountAuthorization(db, authenticate(db, token), id, payload, ip);
        }
        return send(200, {
          account: db
            .prepare(
              "SELECT id,username,full_name,officer_id,role_code,status,must_change_password FROM accounts WHERE id=?",
            )
            .get(id),
          scopes: scopesFor(db, id),
        });
      }
      if (method === "GET" && path === "/api/authorization/accounts") {
        requireAdministrator(user, "M01.view");
        const { page, pageSize } = pagination(url);
        return send(200, {
          items: db
            .prepare(
              "SELECT id,username,full_name,role_code,status FROM accounts ORDER BY username LIMIT ? OFFSET ?",
            )
            .all(pageSize, (page - 1) * pageSize),
          total: db.prepare("SELECT count(*) AS total FROM accounts").get().total,
          page,
          pageSize,
        });
      }
      if (method === "GET" && path === "/api/authorization/scope-options") {
        requireAdministrator(user, "M01.view");
        const { page, pageSize } = pagination(url);
        assert(
          ["unit", "region", "facility"].includes(url.searchParams.get("kind")),
          400,
          "INVALID_INPUT",
          "kind phải là unit, region hoặc facility.",
        );
        const table = { unit: "units", region: "regions", facility: "facilities" }[
          url.searchParams.get("kind")
        ];
        return send(200, {
          items: db
            .prepare(`SELECT id,name FROM ${table} ORDER BY id LIMIT ? OFFSET ?`)
            .all(pageSize, (page - 1) * pageSize),
          total: db.prepare(`SELECT count(*) AS total FROM ${table}`).get().total,
          page,
          pageSize,
        });
      }
      if (method === "GET" && path === "/api/audit-logs") {
        requireAdministrator(user, "M01.view");
        const { page, pageSize } = pagination(url);
        return send(200, {
          items: db
            .prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?")
            .all(pageSize, (page - 1) * pageSize),
          total: db.prepare("SELECT count(*) AS total FROM audit_logs").get().total,
          page,
          pageSize,
        });
      }
      if (
        method === "GET" &&
        (path === "/api/facilities" || /^\/api\/facilities\/[^/]+$/.test(path))
      ) {
        requirePermission(user, "M03.view");
        const scope = facilityScope(user);
        const id = path.split("/")[3];
        if (id) {
          const facility = db
            .prepare(`SELECT f.* FROM facilities f WHERE ${scope.sql} AND f.id=?`)
            .get(...scope.params, decodeURIComponent(id));
          assert(facility, 404, "NOT_FOUND", "Không tìm thấy cơ sở trong phạm vi được cấp.");
          return send(200, { facility });
        }
        const { page, pageSize } = pagination(url);
        const search = url.searchParams.get("search") ?? "";
        assert(search.length <= 100, 400, "INVALID_INPUT", "Từ khóa tìm kiếm quá dài.");
        const sql = `${scope.sql} AND (instr(lower(f.name),lower(?))>0 OR instr(lower(f.address),lower(?))>0)`;
        const params = [...scope.params, search, search];
        return send(200, {
          items: db
            .prepare(`SELECT f.* FROM facilities f WHERE ${sql} ORDER BY f.id LIMIT ? OFFSET ?`)
            .all(...params, pageSize, (page - 1) * pageSize),
          total: db
            .prepare(`SELECT count(*) AS total FROM facilities f WHERE ${sql}`)
            .get(...params).total,
          page,
          pageSize,
        });
      }
      if (method === "GET" && path === "/api/dashboard") {
        requirePermission(user, "M10.view");
        requirePermission(user, "M03.view");
        const scope = facilityScope(user);
        return send(200, {
          facilityCount: db
            .prepare(`SELECT count(*) AS total FROM facilities f WHERE ${scope.sql}`)
            .get(...scope.params).total,
        });
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
