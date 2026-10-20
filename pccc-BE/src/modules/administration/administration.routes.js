import { assert } from "../../core/errors.js";
import { pagination } from "../../core/validation.js";
import { authenticate } from "../auth/auth.service.js";
import {
  permissionsFor,
  requireAdministrator,
  scopesFor,
} from "../authorization/authorization.service.js";
import {
  createAccount,
  findAccount,
  listAccounts,
  listRoles,
  listScopeOptions,
  resetAccountPassword,
  setAccountStatus,
  updateAccountAuthorization,
  updateRolePermissions,
} from "./administration.service.js";
import {
  changeAccountStatus,
  createTransfer,
  listTransfers,
  managedAssignments,
  transferCandidates,
} from "./account-transfer.service.js";

// UC-ADM-03 — role grants and account scopes; only system-wide administrators.
async function accountDetail(ctx, match, permission) {
  requireAdministrator(ctx.user, permission);
  const id = decodeURIComponent(match[1]);
  assert(findAccount(ctx.db, id), 404, "NOT_FOUND", "Không tìm thấy tài khoản.");
  if (ctx.method === "PUT") {
    const payload = await ctx.readJson();
    const result = updateAccountAuthorization(
      ctx.db,
      authenticate(ctx.db, ctx.token),
      id,
      payload,
      ctx.ip,
    );
    return { account: findAccount(ctx.db, id), ...result };
  }
  return { account: findAccount(ctx.db, id), scopes: scopesFor(ctx.db, id) };
}

const ACCOUNT_PATH = /^\/api\/authorization\/accounts\/([^/]+)$/;

export const administrationRoutes = [
  {
    method: "POST",
    path: /^\/api\/authorization\/accounts\/([^/]+)\/(lock|unlock)$/,
    handle(ctx, match) {
      return {
        account: changeAccountStatus(
          ctx.db,
          ctx.user,
          decodeURIComponent(match[1]),
          match[2],
          ctx.ip,
        ),
      };
    },
  },
  {
    // UC-ADM-02 — create/update/disable accounts; accounts with history are never deleted.
    method: "POST",
    path: "/api/authorization/accounts",
    async handle(ctx) {
      const payload = await ctx.readJson();
      ctx.status = 201;
      return createAccount(ctx.db, ctx.user, payload, ctx.ip);
    },
  },
  {
    method: "POST",
    path: /^\/api\/authorization\/accounts\/([^/]+)\/status$/,
    async handle(ctx, match) {
      const payload = await ctx.readJson();
      const status = payload?.status;
      return {
        account: setAccountStatus(ctx.db, ctx.user, decodeURIComponent(match[1]), status, ctx.ip),
      };
    },
  },
  {
    method: "POST",
    path: /^\/api\/authorization\/accounts\/([^/]+)\/reset-password$/,
    async handle(ctx, match) {
      const payload = await ctx.readJson();
      return resetAccountPassword(
        ctx.db,
        ctx.user,
        decodeURIComponent(match[1]),
        payload?.password,
        ctx.ip,
      );
    },
  },
  {
    method: "GET",
    path: "/api/account-transfers/candidates",
    handle: (ctx) => transferCandidates(ctx.db, ctx.user),
  },
  {
    method: "GET",
    path: "/api/account-transfers/assignments",
    handle(ctx) {
      const sourceId = ctx.url.searchParams.get("sourceAccountId");
      assert(sourceId, 400, "INVALID_INPUT", "Chọn cán bộ chuyển giao.");
      return managedAssignments(ctx.db, ctx.user, sourceId);
    },
  },
  {
    method: "GET",
    path: "/api/account-transfers",
    handle: (ctx) => listTransfers(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "POST",
    path: "/api/account-transfers",
    async handle(ctx) {
      const payload = await ctx.readJson();
      ctx.status = 201;
      return { transfer: createTransfer(ctx.db, ctx.user, payload, ctx.ip) };
    },
  },
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
      return listAccounts(ctx.db, pagination(ctx.url), ctx.url.searchParams.get("search") ?? "");
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
];
