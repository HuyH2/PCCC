"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/shared/section-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { accountApi, type ManagedAccount } from "@/lib/account-transfer-contract";

const statusNames = { active: "Hoạt động", locked: "Đã khóa", inactive: "Ngưng hoạt động" };

export function AccountList({
  canEdit,
  currentAccountId,
}: {
  canEdit: boolean;
  currentAccountId: string;
}) {
  const [accounts, setAccounts] = React.useState<ManagedAccount[]>([]);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await accountApi<{ items: ManagedAccount[]; total: number }>(
        `/api/authorization/accounts?page=${page}&pageSize=20`,
      );
      setAccounts(data.items);
      setTotal(data.total);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tải tài khoản.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(account: ManagedAccount) {
    const action = account.status === "active" ? "lock" : "unlock";
    const label = action === "lock" ? "khóa" : "mở khóa";
    if (!window.confirm(`Xác nhận ${label} tài khoản ${account.full_name}?`)) return;
    setBusyId(account.id);
    setError(null);
    setMessage(null);
    try {
      await accountApi(
        `/api/authorization/accounts/${encodeURIComponent(account.id)}/${action}`,
        "POST",
      );
      setMessage(`Đã ${label} tài khoản ${account.full_name}.`);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể cập nhật tài khoản.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SectionCard
      title="Danh sách tài khoản"
      description="Dữ liệu tài khoản hiện tại từ hệ thống"
      contentClassName="px-0 pb-0"
    >
      {error && (
        <p role="alert" className="text-destructive px-4 pb-3 text-sm">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="px-4 pb-3 text-sm">
          {message}
        </p>
      )}
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
                <TableHead>Trạng thái</TableHead>
                <TableHead>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-mono text-xs">{account.username}</TableCell>
                  <TableCell>
                    {account.full_name}
                    <span className="text-muted-foreground block text-xs">{account.id}</span>
                  </TableCell>
                  <TableCell>{account.role_code}</TableCell>
                  <TableCell>{statusNames[account.status]}</TableCell>
                  <TableCell>
                    {canEdit &&
                      account.status !== "inactive" &&
                      account.id !== currentAccountId && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId !== null}
                          onClick={() => void changeStatus(account)}
                        >
                          {busyId === account.id
                            ? "Đang lưu…"
                            : account.status === "active"
                              ? "Khóa"
                              : "Mở khóa"}
                        </Button>
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
  );
}
