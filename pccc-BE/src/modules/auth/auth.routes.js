import { assert } from "../../core/errors.js";
import { object, text } from "../../core/validation.js";

const homeFor = (user) => (user.role === "A05" ? "/quan-tri/vai-tro" : "/");

// UC-ADM-01 — login/logout are public; the rest require a valid session.
export const authRoutes = [
  {
    method: "POST",
    path: "/api/auth/login",
    public: true,
    async handle(ctx) {
      const body = object(await ctx.readJson(), ["username", "password"]);
      const username = text(body.username, "Tên đăng nhập", 1, 100).trim().toLowerCase();
      assert(/^[a-z0-9._-]+$/.test(username), 400, "INVALID_INPUT", "Tên đăng nhập không hợp lệ.");
      const password = text(body.password, "Mật khẩu", 1, 256);
      const result = await ctx.auth.login(username, password, ctx.ip);
      // Rotate any previous session; its token must no longer work.
      ctx.auth.logout(ctx.token, ctx.ip);
      ctx.setSessionCookie(result.token);
      return {
        user: result.user,
        redirectTo: result.user.mustChangePassword ? "/doi-mat-khau" : homeFor(result.user),
      };
    },
  },
  {
    method: "POST",
    path: "/api/auth/logout",
    public: true,
    handle(ctx) {
      ctx.auth.logout(ctx.token, ctx.ip);
      ctx.clearSessionCookie();
      return { message: "Đã đăng xuất." };
    },
  },
  {
    method: "GET",
    path: "/api/auth/me",
    handle: (ctx) => ({ user: ctx.user }),
  },
  {
    method: "POST",
    path: "/api/auth/skip-password-change",
    handle(ctx) {
      ctx.auth.skipPasswordChange(ctx.user, ctx.ip);
      return { message: "Đã bỏ qua đổi mật khẩu.", redirectTo: homeFor(ctx.user) };
    },
  },
  {
    method: "POST",
    path: "/api/auth/change-password",
    async handle(ctx) {
      const body = object(await ctx.readJson(), ["currentPassword", "newPassword"]);
      await ctx.auth.changePassword(
        ctx.user,
        text(body.currentPassword, "Mật khẩu hiện tại", 1, 256),
        text(body.newPassword, "Mật khẩu mới", 12, 256),
        ctx.ip,
      );
      ctx.clearSessionCookie();
      return { message: "Đã đổi mật khẩu. Vui lòng đăng nhập lại." };
    },
  },
];
