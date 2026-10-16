import { assert } from "../../core/errors.js";
import { pagination } from "../../core/validation.js";
import { authenticate } from "../auth/auth.service.js";
import {
  permissionsFor,
  requireAdministrator,
  scopesFor,
} from "../authorization/authorization.service.js";
import {
  findAccount,
  listAccounts,
  listAuditLogs,
  listRoles,
  listScopeOptions,
  updateAccountAuthorization,
  updateRolePermissions,
} from "./administration.service.js";

// UC-ADM-03 — role grants and account scopes; only system-wide administrators.
async function accountDetail(ctx, match, permission) {
  requireAdministrator(ctx.user, permission);
  const id = decodeURIComponent(match[1]);
  assert(findAccount(ctx.db, id), 404, "NOT_FOUND", "Không tìm thấy tài khoản.");
  if (ctx.method === "PUT") {
    const payload = await ctx.readJson();
    updateAccountAuthorization(ctx.db, authenticate(ctx.db, ctx.token), id, payload, ctx.ip);
  }
  return { account: findAccount(ctx.db, id), scopes: scopesFor(ctx.db, id) };
}

const ACCOUNT_PATH = /^\/api\/authorization\/accounts\/([^/]+)$/;

export const administrationRoutes = [
  {
    method: "GET",
    path: "/api/authorization/roles",
    handle(ctx) {
      requireAdministrator(ctx.user, "M01.view");
      return listRoles(ctx.db);
    },
  },
  {
    method: "PUT",
    path: /^\/api\/authorization\/roles\/(A0[1-7])\/permissions$/,
    async handle(ctx, match) {
      requireAdministrator(ctx.user);
      const payload = await ctx.readJson();
      updateRolePermissions(ctx.db, authenticate(ctx.db, ctx.token), match[1], payload, ctx.ip);
      return { permissions: permissionsFor(ctx.db, match[1]) };
    },
  },
  {
    method: "GET",
    path: ACCOUNT_PATH,
    handle: (ctx, match) => accountDetail(ctx, match, "M01.view"),
  },
  {
    method: "PUT",
    path: ACCOUNT_PATH,
    handle: (ctx, match) => accountDetail(ctx, match, "M01.edit"),
  },
  {
    method: "GET",
    path: "/api/authorization/accounts",
    handle(ctx) {
      requireAdministrator(ctx.user, "M01.view");
      return listAccounts(ctx.db, pagination(ctx.url));
    },
  },
  {
    method: "GET",
    path: "/api/authorization/scope-options",
    handle(ctx) {
      requireAdministrator(ctx.user, "M01.view");
      const paging = pagination(ctx.url);
      return listScopeOptions(ctx.db, ctx.url.searchParams.get("kind"), paging);
    },
  },
  {
    method: "GET",
    path: "/api/audit-logs",
    handle(ctx) {
      requireAdministrator(ctx.user, "M01.view");
      return listAuditLogs(ctx.db, pagination(ctx.url));
    },
  },
];
