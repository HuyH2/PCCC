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
  assert(await findAccount(ctx.db, id), 404, "NOT_FOUND", "Không tìm thấy tài khoản.");
  if (ctx.method === "PUT") {
    const payload = await ctx.readJson();
    const result = await updateAccountAuthorization(
      ctx.db,
      await authenticate(ctx.db, ctx.token),
      id,
      payload,
      ctx.ip,
    );
    return { account: await findAccount(ctx.db, id), ...result };
  }
  return { account: await findAccount(ctx.db, id), scopes: await scopesFor(ctx.db, id) };
}

const ACCOUNT_PATH = /^\/api\/authorization\/accounts\/([^/]+)$/;

export const administrationRoutes = [
  {
    method: "POST",
    path: /^\/api\/authorization\/accounts\/([^/]+)\/(lock|unlock)$/,
    async handle(ctx, match) {
      return {
        account: await changeAccountStatus(
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
      return await createAccount(ctx.db, ctx.user, payload, ctx.ip);
    },
  },
  {
    method: "POST",
    path: /^\/api\/authorization\/accounts\/([^/]+)\/status$/,
    async handle(ctx, match) {
      const payload = await ctx.readJson();
      const status = payload?.status;
      return {
        account: await setAccountStatus(
          ctx.db,
          ctx.user,
          decodeURIComponent(match[1]),
          status,
          ctx.ip,
        ),
      };
    },
  },
  {
    method: "POST",
    path: /^\/api\/authorization\/accounts\/([^/]+)\/reset-password$/,
    async handle(ctx, match) {
      const payload = await ctx.readJson();
      return await resetAccountPassword(
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
    handle: async (ctx) => await transferCandidates(ctx.db, ctx.user),
  },
  {
    method: "GET",
    path: "/api/account-transfers/assignments",
    async handle(ctx) {
      const sourceId = ctx.url.searchParams.get("sourceAccountId");
      assert(sourceId, 400, "INVALID_INPUT", "Chọn cán bộ chuyển giao.");
      return await managedAssignments(ctx.db, ctx.user, sourceId);
    },
  },
  {
    method: "GET",
    path: "/api/account-transfers",
    handle: async (ctx) => await listTransfers(ctx.db, ctx.user, ctx.url),
  },
  {
    method: "POST",
    path: "/api/account-transfers",
    async handle(ctx) {
      const payload = await ctx.readJson();
      ctx.status = 201;
      return { transfer: await createTransfer(ctx.db, ctx.user, payload, ctx.ip) };
    },
  },
  {
    method: "GET",
    path: "/api/authorization/roles",
    async handle(ctx) {
      requireAdministrator(ctx.user, "M01.view");
      return await listRoles(ctx.db);
    },
  },
  {
    method: "PUT",
    path: /^\/api\/authorization\/roles\/(A0[1-7])\/permissions$/,
    async handle(ctx, match) {
      requireAdministrator(ctx.user);
      const payload = await ctx.readJson();
      await updateRolePermissions(
        ctx.db,
        await authenticate(ctx.db, ctx.token),
        match[1],
        payload,
        ctx.ip,
      );
      return { permissions: await permissionsFor(ctx.db, match[1]) };
    },
  },
  {
    method: "GET",
    path: ACCOUNT_PATH,
    handle: async (ctx, match) => await accountDetail(ctx, match, "M01.view"),
  },
  {
    method: "PUT",
    path: ACCOUNT_PATH,
    handle: async (ctx, match) => await accountDetail(ctx, match, "M01.edit"),
  },
  {
    method: "GET",
    path: "/api/authorization/accounts",
    async handle(ctx) {
      requireAdministrator(ctx.user, "M01.view");
      return await listAccounts(
        ctx.db,
        pagination(ctx.url),
        ctx.url.searchParams.get("search") ?? "",
      );
    },
  },
  {
    method: "GET",
    path: "/api/authorization/scope-options",
    async handle(ctx) {
      requireAdministrator(ctx.user, "M01.view");
      const paging = pagination(ctx.url);
      return await listScopeOptions(ctx.db, ctx.url.searchParams.get("kind"), paging);
    },
  },
];
