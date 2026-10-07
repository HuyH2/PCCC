import { createHash, randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "./password.js";
import { assert } from "./errors.js";
import { permissionsFor, scopesFor } from "./authorization.js";
import { transaction } from "./database.js";

export const COOKIE_NAME = "pccc_session";
export const tokenHash = (token) => createHash("sha256").update(token).digest("hex");

export function audit(db, actor, action, object, before, after, ip) {
  db.prepare(
    "INSERT INTO audit_logs(actor_id,action,object_id,before_json,after_json,occurred_at,ip) VALUES (?,?,?,?,?,?,?)",
  ).run(
    actor,
    action,
    object,
    before == null ? null : JSON.stringify(before),
    after == null ? null : JSON.stringify(after),
    Date.now(),
    ip,
  );
}

export function principalFor(db, account) {
  return {
    id: account.id,
    username: account.username,
    fullName: account.full_name,
    officerId: account.officer_id,
    role: account.role_code,
    mustChangePassword: Boolean(account.must_change_password),
    permissions: permissionsFor(db, account.role_code),
    scopes: scopesFor(db, account.id),
  };
}

export function authenticate(db, token, now = Date.now()) {
  assert(
    typeof token === "string" && /^[a-f0-9]{64}$/.test(token),
    401,
    "UNAUTHENTICATED",
    "Vui lòng đăng nhập.",
  );
  const account = db
    .prepare(
      `SELECT a.*,r.enabled FROM sessions s JOIN accounts a ON a.id=s.account_id
    JOIN roles r ON r.code=a.role_code WHERE s.token_hash=? AND s.expires_at>?`,
    )
    .get(tokenHash(token), now);
  assert(
    account && account.status === "active" && account.enabled === 1,
    401,
    "UNAUTHENTICATED",
    "Phiên đã hết hạn hoặc tài khoản không còn hoạt động.",
  );
  return principalFor(db, account);
}

export function createAuthentication(db, { ttlSeconds = 28800 } = {}) {
  // Dummy hash keeps missing-user and wrong-password paths comparable.
  const dummyHash = hashPassword(randomBytes(32).toString("hex"));
  return {
    async login(username, password, ip) {
      const now = Date.now();
      const keys = [`ip:${ip}`, `user:${username}`].map(tokenHash);
      for (const key of keys) {
        const attempt = db.prepare("SELECT * FROM login_attempts WHERE key=?").get(key);
        assert(
          !attempt || now - attempt.window_start >= 900000 || attempt.attempts < 10,
          429,
          "TOO_MANY_ATTEMPTS",
          "Đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.",
        );
      }
      transaction(db, () => {
        db.prepare("DELETE FROM login_attempts WHERE window_start<?").run(now - 900000);
        for (const key of keys)
          db.prepare(
            `INSERT INTO login_attempts VALUES (?,1,?)
          ON CONFLICT(key) DO UPDATE SET attempts=attempts+1`,
          ).run(key, now);
      });
      let account = db
        .prepare(
          "SELECT a.*,r.enabled FROM accounts a JOIN roles r ON r.code=a.role_code WHERE a.username=?",
        )
        .get(username);
      const valid = await verifyPassword(password, account?.password_hash ?? (await dummyHash));
      if (!account || !valid) {
        audit(
          db,
          account?.id ?? null,
          "auth.login_failed",
          account?.id ?? null,
          null,
          { reason: "invalid_credentials" },
          ip,
        );
        assert(false, 401, "INVALID_CREDENTIALS", "Tên đăng nhập hoặc mật khẩu không đúng.");
      }
      // Password hashing yields to other requests. Re-read lifecycle/role before issuing a session.
      const current = db
        .prepare(
          "SELECT a.*,r.enabled FROM accounts a JOIN roles r ON r.code=a.role_code WHERE a.id=?",
        )
        .get(account.id);
      assert(
        current && current.password_hash === account.password_hash,
        401,
        "INVALID_CREDENTIALS",
        "Tài khoản vừa thay đổi. Vui lòng đăng nhập lại.",
      );
      account = current;
      if (account.status !== "active" || account.enabled !== 1) {
        audit(
          db,
          account.id,
          "auth.login_failed",
          account.id,
          null,
          { reason: "account_unavailable" },
          ip,
        );
        assert(
          false,
          403,
          "ACCOUNT_UNAVAILABLE",
          "Tài khoản đang bị khóa, ngưng hoạt động hoặc vai trò chưa được kích hoạt.",
        );
      }
      const token = randomBytes(32).toString("hex");
      transaction(db, () => {
        db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(now);
        db.prepare("INSERT INTO sessions VALUES (?,?,?,?)").run(
          tokenHash(token),
          account.id,
          now,
          now + ttlSeconds * 1000,
        );
        db.prepare("UPDATE accounts SET last_login_at=? WHERE id=?").run(now, account.id);
        db.prepare("DELETE FROM login_attempts WHERE key=?").run(keys[1]);
        // The frontend proxy shares one socket IP. Successful logins must not
        // consume the failure budget for every other user behind that proxy.
        db.prepare("UPDATE login_attempts SET attempts=max(0,attempts-1) WHERE key=?").run(keys[0]);
        audit(db, account.id, "auth.login", account.id, null, null, ip);
      });
      return { token, user: principalFor(db, account) };
    },
    logout(token, ip) {
      const session = token
        ? db.prepare("SELECT account_id FROM sessions WHERE token_hash=?").get(tokenHash(token))
        : null;
      if (session)
        transaction(db, () => {
          db.prepare("DELETE FROM sessions WHERE token_hash=?").run(tokenHash(token));
          audit(db, session.account_id, "auth.logout", session.account_id, null, null, ip);
        });
    },
    skipPasswordChange(principal, ip) {
      transaction(db, () => {
        const result = db
          .prepare(
            "UPDATE accounts SET must_change_password=0 WHERE id=? AND must_change_password=1",
          )
          .run(principal.id);
        if (result.changes === 1) {
          audit(
            db,
            principal.id,
            "auth.password_change_skipped",
            principal.id,
            { mustChangePassword: true },
            { mustChangePassword: false },
            ip,
          );
        }
      });
    },
    async changePassword(principal, currentPassword, newPassword, ip) {
      const account = db.prepare("SELECT password_hash FROM accounts WHERE id=?").get(principal.id);
      assert(
        await verifyPassword(currentPassword, account.password_hash),
        400,
        "INVALID_PASSWORD",
        "Mật khẩu hiện tại không đúng.",
      );
      assert(
        currentPassword !== newPassword,
        400,
        "INVALID_PASSWORD",
        "Mật khẩu mới phải khác mật khẩu hiện tại.",
      );
      const nextHash = await hashPassword(newPassword);
      transaction(db, () => {
        const currentAccount = db
          .prepare(
            "SELECT a.status,r.enabled FROM accounts a JOIN roles r ON r.code=a.role_code WHERE a.id=?",
          )
          .get(principal.id);
        assert(
          currentAccount?.status === "active" && currentAccount.enabled === 1,
          401,
          "UNAUTHENTICATED",
          "Tài khoản không còn hoạt động.",
        );
        const result = db
          .prepare(
            "UPDATE accounts SET password_hash=?,must_change_password=0 WHERE id=? AND password_hash=?",
          )
          .run(nextHash, principal.id, account.password_hash);
        assert(result.changes === 1, 409, "CONFLICT", "Tài khoản vừa thay đổi. Vui lòng thử lại.");
        db.prepare("DELETE FROM sessions WHERE account_id=?").run(principal.id);
        audit(db, principal.id, "auth.password_changed", principal.id, null, null, ip);
      });
    },
  };
}
