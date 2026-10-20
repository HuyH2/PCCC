"use client";

import * as React from "react";
import { KeyRound, Pencil, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/shared/section-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { accountApi } from "@/lib/account-transfer-contract";

interface ManagedAccount {
  id: string;
  username: string;
  full_name: string;
  officer_id: string;
  role_code: string;
  status: "active" | "locked" | "inactive";
  region_count?: number;
  facility_count?: number;
  unit_name?: string;
}

interface ScopeOption {
  id: string;
  name: string;
}

interface RoleOption {
  code: string;
  name: string;
  enabled: number;
}

const statusNames = { active: "Hoạt động", locked: "Đã khóa", inactive: "Ngưng hoạt động" };
const selectClass = "border-input bg-background h-9 w-full rounded-md border px-3 text-sm";

export function AccountList({
  canEdit,
  currentAccountId,
}: {
  canEdit: boolean;
  currentAccountId: string;
}) {
  const [accounts, setAccounts] = React.useState<ManagedAccount[]>([]);
  const [roles, setRoles] = React.useState<RoleOption[]>([]);
  const [units, setUnits] = React.useState<ScopeOption[]>([]);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [draft, setDraft] = React.useState({
    username: "",
    fullName: "",
    officerId: "",
    role: "",
    unitId: "",
    password: "",
  });
  const [editing, setEditing] = React.useState<{
    account: ManagedAccount;
    fullName: string;
    officerId: string;
    role: string;
    unitId: string;
    scopeCount: number;
  } | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await accountApi<{ items: ManagedAccount[]; total: number }>(
        `/api/authorization/accounts?page=${page}&pageSize=20&search=${encodeURIComponent(query)}`,
      );
      setAccounts(data.items);
      setTotal(data.total);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tải tài khoản.");
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!canEdit) return;
    Promise.all([
      accountApi<{ roles: RoleOption[] }>("/api/authorization/roles"),
      accountApi<{ items: ScopeOption[] }>("/api/authorization/scope-options?kind=unit&pageSize=100"),
    ])
      .then(([roleData, unitData]) => {
        setRoles(roleData.roles.filter((role) => role.enabled === 1));
        setUnits(unitData.items);
      })
      .catch(() => {
        setRoles([]);
        setUnits([]);
      });
  }, [canEdit]);

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await accountApi("/api/authorization/accounts", "POST", {
        username: draft.username.trim(),
        fullName: draft.fullName.trim(),
        officerId: draft.officerId.trim(),
        role: draft.role,
        password: draft.password,
        scopes: draft.unitId ? [{ kind: "unit", targetId: draft.unitId }] : [],
      });
      setMessage(`Đã tạo tài khoản ${draft.username.trim()} cho ${draft.fullName.trim()}.`);
      setDraft({
        username: "",
        fullName: "",
        officerId: "",
        role: "",
        unitId: "",
        password: "",
      });
      setShowCreate(false);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tạo tài khoản.");
    } finally {
      setBusy(false);
    }
  }

  async function openEdit(account: ManagedAccount) {
    setError(null);
    setMessage(null);
    try {
      const data = await accountApi<{
        account: ManagedAccount;
        scopes: Array<{ kind: string; targetId: string | null }>;
      }>(`/api/authorization/accounts/${encodeURIComponent(account.id)}`);
      const unitScope = data.scopes.find((scope) => scope.kind === "unit");
      setEditing({
        account: data.account,
        fullName: data.account.full_name,
        officerId: data.account.officer_id,
        role: data.account.role_code,
        unitId: unitScope?.targetId ?? "",
        scopeCount: data.scopes.length,
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tải tài khoản.");
    }
  }

  async function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const detail = await accountApi<{
        scopes: Array<{ kind: string; targetId: string | null }>;
      }>(`/api/authorization/accounts/${encodeURIComponent(editing.account.id)}`);
      const otherScopes = detail.scopes.filter((scope) => scope.kind !== "unit");
      const scopes = [
        ...(editing.unitId ? [{ kind: "unit", targetId: editing.unitId }] : []),
        ...otherScopes,
      ];
      await accountApi(`/api/authorization/accounts/${encodeURIComponent(editing.account.id)}`, "PUT", {
        role: editing.role,
        fullName: editing.fullName.trim(),
        officerId: editing.officerId.trim(),
        scopes,
      });
      setMessage(`Đã cập nhật tài khoản ${editing.account.username}. Người dùng cần đăng nhập lại.`);
      setEditing(null);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể cập nhật tài khoản.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(account: ManagedAccount, status: ManagedAccount["status"]) {
    const label =
      status === "locked" ? "khóa" : status === "inactive" ? "ngưng hoạt động" : "kích hoạt";
    if (!window.confirm(`Xác nhận ${label} tài khoản ${account.full_name}?`)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await accountApi(`/api/authorization/accounts/${encodeURIComponent(account.id)}/status`, "POST", {
        status,
      });
      setMessage(`Đã ${label} tài khoản ${account.full_name}.`);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể cập nhật trạng thái.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(account: ManagedAccount) {
    const password = window.prompt(
      `Mật khẩu tạm mới cho ${account.full_name} (tối thiểu 12 ký tự):`,
    );
    if (!password) return;
    if (password.length < 12) {
      setError("Mật khẩu phải có ít nhất 12 ký tự.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await accountApi(
        `/api/authorization/accounts/${encodeURIComponent(account.id)}/reset-password`,
        "POST",
        { password },
      );
      setMessage(
        `Đã đặt lại mật khẩu cho ${account.full_name}. Người dùng phải đổi ở lần đăng nhập tới.`,
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể đặt lại mật khẩu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}

      <SectionCard
        title="Danh sách tài khoản"
        description="Dữ liệu tài khoản hiện tại từ hệ thống"
        contentClassName="px-0 pb-0"
        action={
          canEdit ? (
            <Button size="sm" onClick={() => setShowCreate((value) => !value)}>
              <Plus />
              Tạo tài khoản
            </Button>
          ) : null
        }
      >
        {showCreate && (
          <form
            onSubmit={(event) => void submitCreate(event)}
            className="grid gap-3 border-b px-4 pb-4 md:grid-cols-3"
          >
            <div className="space-y-1">
              <Label htmlFor="account-username">Tên đăng nhập</Label>
              <Input
                id="account-username"
                required
                maxLength={100}
                placeholder="nguyen.van.a"
                value={draft.username}
                onChange={(event) => setDraft({ ...draft, username: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="account-fullname">Họ tên</Label>
              <Input
                id="account-fullname"
                required
                maxLength={200}
                value={draft.fullName}
                onChange={(event) => setDraft({ ...draft, fullName: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="account-officer">Mã cán bộ</Label>
              <Input
                id="account-officer"
                required
                maxLength={64}
                placeholder="CB-A10"
                value={draft.officerId}
                onChange={(event) => setDraft({ ...draft, officerId: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="account-role">Vai trò</Label>
              <select
                id="account-role"
                className={selectClass}
                required
                value={draft.role}
                onChange={(event) => setDraft({ ...draft, role: event.target.value })}
              >
                <option value="">Chọn vai trò</option>
                {roles.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.code} — {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="account-unit">Đơn vị</Label>
              <select
                id="account-unit"
                className={selectClass}
                value={draft.unitId}
                onChange={(event) => setDraft({ ...draft, unitId: event.target.value })}
              >
                <option value="">Không gán phạm vi đơn vị</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="account-password">Mật khẩu tạm</Label>
              <Input
                id="account-password"
                type="password"
                required
                minLength={12}
                maxLength={256}
                value={draft.password}
                onChange={(event) => setDraft({ ...draft, password: event.target.value })}
              />
            </div>
            <div className="flex items-end gap-2 md:col-span-3">
              <Button type="submit" size="sm" disabled={busy}>
                Lưu tài khoản
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
                Hủy
              </Button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <Input
            className="max-w-xs"
            placeholder="Tìm theo tên đăng nhập, họ tên, mã cán bộ"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setPage(1);
                setQuery(search);
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setPage(1);
              setQuery(search);
            }}
          >
            <Search />
            Tìm
          </Button>
        </div>

        {loading ? (
          <p role="status" className="px-4 pb-4 text-sm">
            Đang tải tài khoản…
          </p>
        ) : accounts.length === 0 ? (
          <p className="px-4 pb-4 text-sm">Chưa có tài khoản.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên đăng nhập</TableHead>
                  <TableHead>Cán bộ</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Phạm vi</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-mono text-xs">{account.username}</TableCell>
                    <TableCell>
                      {account.full_name}
                      <span className="text-muted-foreground block text-xs">
                        {account.officer_id}
                      </span>
                    </TableCell>
                    <TableCell>{account.role_code}</TableCell>
                    <TableCell className="text-xs">
                      {account.unit_name ?? "—"}
                      <span className="text-muted-foreground block">
                        {account.region_count ?? 0} khu vực · {account.facility_count ?? 0} cơ sở
                      </span>
                    </TableCell>
                    <TableCell>{statusNames[account.status]}</TableCell>
                    <TableCell>
                      {canEdit && account.id !== currentAccountId && (
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void openEdit(account)}
                          >
                            <Pencil />
                            Sửa
                          </Button>
                          {account.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void changeStatus(account, "locked")}
                            >
                              Khóa
                            </Button>
                          )}
                          {account.status === "locked" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void changeStatus(account, "active")}
                            >
                              Mở khóa
                            </Button>
                          )}
                          {account.status !== "inactive" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void changeStatus(account, "inactive")}
                            >
                              Ngưng
                            </Button>
                          )}
                          {account.status === "inactive" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void changeStatus(account, "active")}
                            >
                              Kích hoạt
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void resetPassword(account)}
                          >
                            <KeyRound />
                            Mật khẩu
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
          <span>
            Trang {page} · {total} tài khoản
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={loading || page === 1}
              onClick={() => setPage(page - 1)}
            >
              Trước
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loading || page * 20 >= total}
              onClick={() => setPage(page + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      </SectionCard>

      {editing && (
        <SectionCard
          title={`Sửa tài khoản ${editing.account.username}`}
          description="Thay đổi vai trò hoặc phạm vi sẽ thu hồi phiên đăng nhập hiện tại của tài khoản."
          action={
            <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
              Đóng
            </Button>
          }
        >
          <form onSubmit={(event) => void submitEdit(event)} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="edit-fullname">Họ tên</Label>
              <Input
                id="edit-fullname"
                required
                maxLength={200}
                value={editing.fullName}
                onChange={(event) => setEditing({ ...editing, fullName: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-officer">Mã cán bộ</Label>
              <Input
                id="edit-officer"
                required
                maxLength={64}
                value={editing.officerId}
                onChange={(event) => setEditing({ ...editing, officerId: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-role">Vai trò</Label>
              <select
                id="edit-role"
                className={selectClass}
                value={editing.role}
                onChange={(event) => setEditing({ ...editing, role: event.target.value })}
              >
                {roles.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.code} — {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-unit">Đơn vị</Label>
              <select
                id="edit-unit"
                className={selectClass}
                value={editing.unitId}
                onChange={(event) => setEditing({ ...editing, unitId: event.target.value })}
              >
                <option value="">Không gán phạm vi đơn vị</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
              {editing.scopeCount > 1 && (
                <p className="text-muted-foreground text-xs">
                  Các phạm vi khu vực/cơ sở hiện có được giữ nguyên.
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <Button type="submit" size="sm" disabled={busy}>
                Lưu thay đổi
              </Button>
            </div>
          </form>
        </SectionCard>
      )}
    </div>
  );
}
