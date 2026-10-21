"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/shared/section-card";
import {
  accountApi,
  type AccountTransfer,
  type ManagedAccount,
  type ManagedItem,
} from "@/lib/account-transfer-contract";

const selectClass = "border-input bg-background h-10 w-full rounded-md border px-3 text-sm";

export function TransferManager({ canEdit }: { canEdit: boolean }) {
  const [accounts, setAccounts] = React.useState<ManagedAccount[]>([]);
  const [sourceId, setSourceId] = React.useState("");
  const [targetId, setTargetId] = React.useState("");
  const [regions, setRegions] = React.useState<ManagedItem[]>([]);
  const [facilities, setFacilities] = React.useState<ManagedItem[]>([]);
  const [selectedRegions, setSelectedRegions] = React.useState<string[]>([]);
  const [selectedFacilities, setSelectedFacilities] = React.useState<string[]>([]);
  const [reason, setReason] = React.useState("");
  const [history, setHistory] = React.useState<AccountTransfer[]>([]);
  const [historyPage, setHistoryPage] = React.useState(1);
  const [historyTotal, setHistoryTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [loadingAssignments, setLoadingAssignments] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const loadHistory = React.useCallback(async () => {
    const result = await accountApi<{ items: AccountTransfer[]; total: number }>(
      `/api/account-transfers?page=${historyPage}&pageSize=10`,
    );
    setHistory(result.items);
    setHistoryTotal(result.total);
  }, [historyPage]);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      accountApi<{ items: ManagedAccount[] }>("/api/account-transfers/candidates"),
      accountApi<{ items: AccountTransfer[]; total: number }>(
        `/api/account-transfers?page=${historyPage}&pageSize=10`,
      ),
    ])
      .then(([candidates, transfers]) => {
        if (!active) return;
        setAccounts(candidates.items);
        setHistory(transfers.items);
        setHistoryTotal(transfers.total);
      })
      .catch((failure: Error) => {
        if (active) setError(failure.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [historyPage]);

  const loadAssignments = React.useCallback(async (id: string) => {
    if (!id) {
      setRegions([]);
      setFacilities([]);
      return;
    }
    setLoadingAssignments(true);
    try {
      const data = await accountApi<{ regions: ManagedItem[]; facilities: ManagedItem[] }>(
        `/api/account-transfers/assignments?sourceAccountId=${encodeURIComponent(id)}`,
      );
      setRegions(data.regions);
      setFacilities(data.facilities);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tải phạm vi.");
    } finally {
      setLoadingAssignments(false);
    }
  }, []);

  React.useEffect(() => {
    setSelectedRegions([]);
    setSelectedFacilities([]);
    setTargetId("");
    void loadAssignments(sourceId);
  }, [sourceId, loadAssignments]);

  function toggle(
    id: string,
    values: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) {
    setter(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const source = accounts.find((item) => item.id === sourceId);
    const target = accounts.find((item) => item.id === targetId);
    if (
      !source ||
      !target ||
      sourceId === targetId ||
      !reason.trim() ||
      selectedRegions.length + selectedFacilities.length === 0
    ) {
      setError("Chọn hai cán bộ khác nhau, ít nhất một phạm vi và nhập lý do.");
      return;
    }
    const count = selectedRegions.length + selectedFacilities.length;
    if (
      !window.confirm(
        `Chuyển giao ${count} khu vực/cơ sở từ ${source.full_name} sang ${target.full_name}? Thao tác có hiệu lực ngay.`,
      )
    )
      return;
    setBusy(true);
    try {
      await accountApi("/api/account-transfers", "POST", {
        sourceAccountId: sourceId,
        targetAccountId: targetId,
        regionIds: selectedRegions,
        facilityIds: selectedFacilities,
        reason: reason.trim(),
      });
      setMessage(`Đã chuyển giao ${count} khu vực/cơ sở cho ${target.full_name}.`);
      setSelectedRegions([]);
      setSelectedFacilities([]);
      setReason("");
      const [candidates] = await Promise.all([
        accountApi<{ items: ManagedAccount[] }>("/api/account-transfers/candidates"),
        loadHistory(),
      ]);
      setAccounts(candidates.items);
      setSourceId(targetId);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể chuyển giao.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionCard
        title="Chọn phạm vi chuyển giao"
        description="Có thể chọn toàn bộ hoặc từng khu vực/cơ sở riêng lẻ."
      >
        {error && (
          <p role="alert" className="text-destructive mb-3 text-sm">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mb-3 text-sm">
            {message}
          </p>
        )}
        {loading ? (
          <p role="status" className="text-sm">
            Đang tải dữ liệu…
          </p>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="transfer-source">Cán bộ chuyển giao</Label>
                <select
                  id="transfer-source"
                  className={selectClass}
                  value={sourceId}
                  onChange={(event) => setSourceId(event.target.value)}
                  required
                >
                  <option value="">Chọn cán bộ cũ</option>
                  {accounts
                    .filter((item) => item.facility_count || item.region_count)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.full_name} · {item.officer_id}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="transfer-target">Cán bộ nhận</Label>
                <select
                  id="transfer-target"
                  className={selectClass}
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                  required
                  disabled={!sourceId}
                >
                  <option value="">Chọn cán bộ mới</option>
                  {accounts
                    .filter((item) => item.id !== sourceId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.full_name} · {item.officer_id}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            {sourceId && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Phạm vi hiện phụ trách</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingAssignments}
                    onClick={() => {
                      setSelectedRegions(regions.map((item) => item.id));
                      setSelectedFacilities(facilities.map((item) => item.id));
                    }}
                  >
                    Chọn toàn bộ
                  </Button>
                </div>
                {loadingAssignments ? (
                  <p role="status" className="text-sm">
                    Đang tải khu vực và cơ sở…
                  </p>
                ) : regions.length + facilities.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Cán bộ này chưa phụ trách khu vực hoặc cơ sở nào.
                  </p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <h4 className="mb-2 font-medium">Khu vực ({regions.length})</h4>
                      <div className="max-h-64 space-y-2 overflow-auto">
                        {regions.map((item) => (
                          <label
                            key={item.id}
                            className="flex cursor-pointer items-start gap-2 text-sm"
                          >
                            <Input
                              type="checkbox"
                              className="mt-0.5 size-4"
                              checked={selectedRegions.includes(item.id)}
                              onChange={() => toggle(item.id, selectedRegions, setSelectedRegions)}
                            />
                            <span>
                              {item.name}
                              <span className="text-muted-foreground block text-xs">
                                {item.unit_name}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <h4 className="mb-2 font-medium">Cơ sở ({facilities.length})</h4>
                      <div className="max-h-64 space-y-2 overflow-auto">
                        {facilities.map((item) => (
                          <label
                            key={item.id}
                            className="flex cursor-pointer items-start gap-2 text-sm"
                          >
                            <Input
                              type="checkbox"
                              className="mt-0.5 size-4"
                              checked={selectedFacilities.includes(item.id)}
                              onChange={() =>
                                toggle(item.id, selectedFacilities, setSelectedFacilities)
                              }
                            />
                            <span>
                              {item.name}
                              <span className="text-muted-foreground block text-xs">
                                {item.region_name} · {item.address}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="transfer-reason">Lý do chuyển giao</Label>
              <Textarea
                id="transfer-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
                required
                placeholder="Ví dụ: thay đổi công tác"
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Chuyển giao đổi người phụ trách; quyền xem rộng theo khu vực, đơn vị hoặc toàn hệ
              thống của cán bộ cũ cần được quản trị rà soát riêng tại Vai trò & phạm vi.
            </p>
            {canEdit && (
              <Button type="submit" disabled={busy || !sourceId || !targetId || loadingAssignments}>
                {busy
                  ? "Đang chuyển giao…"
                  : `Xác nhận chuyển giao (${selectedRegions.length + selectedFacilities.length})`}
              </Button>
            )}
          </form>
        )}
      </SectionCard>
      <SectionCard
        title="Lịch sử chuyển giao"
        description="Giữ người phụ trách cũ, người nhận, người thực hiện và dấu vết audit."
      >
        {loading ? (
          <p role="status" className="text-sm">
            Đang tải lịch sử…
          </p>
        ) : history.length === 0 ? (
          <p className="text-muted-foreground text-sm">Chưa có lần chuyển giao nào.</p>
        ) : (
          <ol className="space-y-3">
            {history.map((transfer) => (
              <li key={transfer.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {transfer.source_name} → {transfer.target_name}
                </p>
                <p className="text-muted-foreground">
                  Hiệu lực{" "}
                  {new Intl.DateTimeFormat("vi-VN", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "Asia/Ho_Chi_Minh",
                  }).format(new Date(transfer.effective_at))}{" "}
                  · Thực hiện: {transfer.actor_name}
                </p>
                <p>Lý do: {transfer.reason}</p>
                <p>
                  Phạm vi:{" "}
                  {transfer.items
                    .map((item) => `${item.kind === "region" ? "Khu vực" : "Cơ sở"} ${item.name}`)
                    .join(", ")}
                </p>
                <p className="text-muted-foreground text-xs">Audit #{transfer.audit_log_id}</p>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-4 flex items-center justify-between text-sm">
          <span>
            Trang {historyPage} · {historyTotal} lần chuyển giao
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={historyPage === 1 || loading}
              onClick={() => setHistoryPage(historyPage - 1)}
            >
              Trước
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={historyPage * 10 >= historyTotal || loading}
              onClick={() => setHistoryPage(historyPage + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
