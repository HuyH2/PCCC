"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/shared/section-card";
import type { DataScope } from "@/lib/auth-contract";

interface Role {
  code: string;
  name: string;
  enabled: number;
  permissions: string[];
}
interface Permission {
  code: string;
  module: string;
  action: string;
}
interface Account {
  id: string;
  username: string;
  full_name: string;
  role_code: string;
  status: string;
}
const actionNames: Record<string, string> = {
  view: "Xem",
  create: "Thêm",
  edit: "Sửa",
  approve: "Duyệt",
  export: "Xuất",
};
const selectClass = "border-input bg-background h-9 w-full rounded-md border px-3 text-sm";

async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401) {
    window.location.assign("/dang-nhap");
    throw new Error("Phiên đăng nhập đã hết hạn.");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Không thể xử lý yêu cầu.");
  return data;
}

export function AuthorizationEditor({ canEdit }: { canEdit: boolean }) {
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [permissions, setPermissions] = React.useState<Permission[]>([]);
  const [role, setRole] = React.useState("A03");
  const [grants, setGrants] = React.useState<string[]>([]);
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [accountPage, setAccountPage] = React.useState(1);
  const [accountTotal, setAccountTotal] = React.useState(0);
  const [accountId, setAccountId] = React.useState("");
  const [accountRole, setAccountRole] = React.useState("A03");
  const [scopes, setScopes] = React.useState<DataScope[]>([]);
  const [kind, setKind] = React.useState<DataScope["kind"]>("region");
  const [targetId, setTargetId] = React.useState("");
  const [pending, setPending] = React.useState(true);
  const [loaded, setLoaded] = React.useState(false);
  const [accountReady, setAccountReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setPending(true);
    setError(null);
    setLoaded(false);
    Promise.all([
      api("/api/authorization/roles"),
      api(`/api/authorization/accounts?page=${accountPage}&pageSize=20`),
    ])
      .then(([r, a]) => {
        if (!active) return;
        setRoles(r.roles);
        setPermissions(r.permissions);
        setAccounts(a.items);
        setAccountTotal(a.total);
        setLoaded(true);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [accountPage]);
  React.useEffect(() => {
    setGrants(roles.find((r) => r.code === role)?.permissions || []);
  }, [role, roles]);
  const [accountLoading, setAccountLoading] = React.useState(false);
  React.useEffect(() => {
    if (!accountId) return;
    let active = true;
    setAccountLoading(true);
    setError(null);
    setAccountReady(false);
    api(`/api/authorization/accounts/${encodeURIComponent(accountId)}`)
      .then((data) => {
        if (active) {
          setAccountRole(data.account.role_code);
          setScopes(data.scopes);
          setAccountReady(true);
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setAccountLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accountId]);

  async function savePermissions() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await api(`/api/authorization/roles/${role}/permissions`, "PUT", { permissions: grants });
      setRoles((old) => old.map((r) => (r.code === role ? { ...r, permissions: grants } : r)));
      setMessage("Đã lưu quyền. Quyền mới có hiệu lực ngay.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu quyền.");
    } finally {
      setPending(false);
    }
  }
  async function saveAccount() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await api(`/api/authorization/accounts/${encodeURIComponent(accountId)}`, "PUT", {
        role: accountRole,
        scopes,
      });
      setMessage("Đã lưu vai trò và phạm vi. Tài khoản được thay đổi cần đăng nhập lại.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu phạm vi.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-5">
      {pending && <p role="status">Đang xử lý…</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <SectionCard title="Quyền chức năng theo vai trò">
        <fieldset disabled={pending || !canEdit || !loaded} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role">Vai trò</Label>
            <select
              id="role"
              className={selectClass}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {roles
                .filter((r) => r.enabled)
                .map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.code} · {r.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from(new Set(permissions.map((p) => p.module))).map((module) => (
              <div key={module} className="rounded-lg border p-3">
                <p className="mb-2 font-semibold">{module}</p>
                {permissions
                  .filter((p) => p.module === module)
                  .map((p) => (
                    <label key={p.code} className="flex items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={grants.includes(p.code)}
                        onChange={(e) =>
                          setGrants((old) =>
                            e.target.checked ? [...old, p.code] : old.filter((g) => g !== p.code),
                          )
                        }
                      />
                      {actionNames[p.action]}
                    </label>
                  ))}
              </div>
            ))}
          </div>
          <Button type="button" onClick={savePermissions}>
            Lưu quyền vai trò
          </Button>
        </fieldset>
      </SectionCard>
      <SectionCard title="Vai trò và phạm vi tài khoản">
        <fieldset disabled={pending || !canEdit || !loaded} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account">Tài khoản</Label>
            <select
              id="account"
              className={selectClass}
              value={accountId}
              onChange={(e) => {
                setAccountReady(false);
                setAccountId(e.target.value);
              }}
            >
              <option value="">Chọn tài khoản</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.username} · {a.full_name} · {a.status}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAccountId("");
                setAccountPage((p) => p - 1);
              }}
              disabled={accountPage === 1}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setAccountId("");
                setAccountPage((p) => p + 1);
              }}
              disabled={accountPage * 20 >= accountTotal}
            >
              Sau
            </Button>
          </div>
          {accountLoading && <p role="status">Đang tải phạm vi tài khoản…</p>}
          {accountId && (
            <fieldset disabled={accountLoading || !accountReady} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-role">Vai trò tài khoản</Label>
                <select
                  id="account-role"
                  className={selectClass}
                  value={accountRole}
                  onChange={(e) => setAccountRole(e.target.value)}
                >
                  {roles
                    .filter((r) => r.enabled)
                    .map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.code} · {r.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <Label htmlFor="scope-kind">Loại phạm vi</Label>
                  <select
                    id="scope-kind"
                    className={selectClass}
                    value={kind}
                    onChange={(e) => setKind(e.target.value as DataScope["kind"])}
                  >
                    <option value="region">Khu phố</option>
                    <option value="unit">Đơn vị (gồm đơn vị con)</option>
                    <option value="facility">Cơ sở</option>
                    <option value="all">Toàn hệ thống</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="scope-id">Mã phạm vi</Label>
                  <Input
                    id="scope-id"
                    disabled={kind === "all"}
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    placeholder="KP01 / DV-KV10 / CS001"
                    maxLength={128}
                  />
                </div>
                <Button
                  className="self-end"
                  type="button"
                  disabled={kind !== "all" && !targetId.trim()}
                  onClick={() => {
                    const scope: DataScope = {
                      kind,
                      targetId: kind === "all" ? null : targetId.trim(),
                    };
                    setScopes((old) =>
                      kind === "all"
                        ? [scope]
                        : [
                            ...old.filter(
                              (s) =>
                                s.kind !== "all" &&
                                !(s.kind === kind && s.targetId === scope.targetId),
                            ),
                            scope,
                          ],
                    );
                    setTargetId("");
                  }}
                >
                  Thêm phạm vi
                </Button>
              </div>
              <ul className="space-y-2">
                {scopes.map((s) => (
                  <li
                    key={`${s.kind}:${s.targetId}`}
                    className="flex items-center justify-between gap-2 rounded border p-2 text-sm"
                  >
                    <span>{s.kind === "all" ? "Toàn hệ thống" : `${s.kind}: ${s.targetId}`}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setScopes((old) => old.filter((v) => v !== s))}
                    >
                      Bỏ
                    </Button>
                  </li>
                ))}
              </ul>
              {!scopes.length && (
                <p className="text-muted-foreground text-sm">
                  Chưa cấp phạm vi: tài khoản không xem được cơ sở nào.
                </p>
              )}
              <Button type="button" onClick={saveAccount}>
                Lưu vai trò & phạm vi
              </Button>
            </fieldset>
          )}
        </fieldset>
      </SectionCard>
    </div>
  );
}
