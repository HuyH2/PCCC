"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  facilityStatusNames,
  type FacilityRecord,
  type FacilityTimelinePage,
} from "@/lib/facility-contract";

type FilterType = "all" | "status" | "details";

function fieldSnapshot(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as { name?: string; address?: string };
  } catch {
    return null;
  }
}

export function FacilityHistoryPanel({
  facility,
  canEdit,
  canSuspend,
  canApproveRestoration,
}: {
  facility: FacilityRecord;
  canEdit: boolean;
  canSuspend: boolean;
  canApproveRestoration: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState(facility.status);
  const [nextStatus, setNextStatus] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [decisionReference, setDecisionReference] = React.useState("");
  const [remediationEvidence, setRemediationEvidence] = React.useState("");
  const [approvalConfirmed, setApprovalConfirmed] = React.useState(false);
  const [filterType, setFilterType] = React.useState<FilterType>("all");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [timeline, setTimeline] = React.useState<FacilityTimelinePage | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [revision, setRevision] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ type: filterType, page: String(page), pageSize: "10" });
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    setLoading(true);
    setError("");
    fetch(`/api/facilities/${encodeURIComponent(facility.id)}/timeline?${params}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể tải lịch sử cơ sở.");
        return response.json() as Promise<FacilityTimelinePage>;
      })
      .then(setTimeline)
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : "Không thể tải lịch sử.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [facility.id, filterType, from, to, page, revision]);

  async function submitStatus(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nextStatus || !reason.trim()) {
      setError("Cần chọn trạng thái mới và nhập lý do.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/facilities/${encodeURIComponent(facility.id)}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          reason: reason.trim(),
          ...(nextStatus === "suspended" || status === "suspended"
            ? { decisionReference: decisionReference.trim() }
            : {}),
          ...(status === "suspended"
            ? { remediationEvidence: remediationEvidence.trim(), approvalConfirmed }
            : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Không thể cập nhật trạng thái.");
      setStatus(result.status);
      setNextStatus("");
      setReason("");
      setDecisionReference("");
      setRemediationEvidence("");
      setApprovalConfirmed(false);
      setPage(1);
      setRevision((value) => value + 1);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể cập nhật trạng thái.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border p-5" aria-labelledby="facility-current-status">
        <h2 id="facility-current-status" className="font-semibold">
          Trạng thái hiện tại
        </h2>
        <p className="mt-2 text-lg font-semibold">{facilityStatusNames[status] ?? status}</p>
        <p className="text-muted-foreground mt-2 text-sm">
          Địa bàn: {facility.region_id} · Cán bộ phụ trách: {facility.officer_id}
        </p>
        {canEdit && (
          <Link
            className="text-primary mt-3 inline-block text-sm hover:underline"
            href={`/co-so/${encodeURIComponent(facility.id)}/sua`}
          >
            Cập nhật thông tin cơ sở
          </Link>
        )}
        {status === "suspended" && !canApproveRestoration && (
          <p className="text-muted-foreground mt-3 text-sm">
            Hoạt động lại cần hồ sơ khắc phục, số quyết định và Admin phê duyệt theo BR-09.
          </p>
        )}
        {((status === "suspended" && canApproveRestoration) ||
          (status !== "suspended" && (canEdit || canSuspend))) && (
          <form onSubmit={submitStatus} className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2">
            <div>
              <label htmlFor="next-status" className="text-sm font-medium">
                Chuyển trạng thái
              </label>
              <select
                id="next-status"
                value={nextStatus}
                onChange={(event) => setNextStatus(event.target.value)}
                required
                className="border-input bg-background mt-1 w-full rounded-md border p-2 text-sm"
              >
                <option value="">Chọn trạng thái mới</option>
                {Object.entries(facilityStatusNames)
                  .filter(([value]) =>
                    status === "suspended"
                      ? value === "active"
                      : value !== status &&
                        (value !== "suspended" || canSuspend) &&
                        (value === "suspended" || canEdit),
                  )
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label htmlFor="status-reason" className="text-sm font-medium">
                Lý do thay đổi
              </label>
              <input
                id="status-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                maxLength={1000}
                className="border-input bg-background mt-1 w-full rounded-md border p-2 text-sm"
              />
            </div>
            {(nextStatus === "suspended" || status === "suspended") && (
              <div>
                <label htmlFor="decision-reference" className="text-sm font-medium">
                  {status === "suspended"
                    ? "Số quyết định hoạt động lại"
                    : "Số quyết định đình chỉ"}
                </label>
                <input
                  id="decision-reference"
                  value={decisionReference}
                  onChange={(event) => setDecisionReference(event.target.value)}
                  required
                  maxLength={200}
                  className="border-input bg-background mt-1 w-full rounded-md border p-2 text-sm"
                />
              </div>
            )}
            {status === "suspended" && (
              <>
                <div className="sm:col-span-2">
                  <label htmlFor="remediation-evidence" className="text-sm font-medium">
                    Hồ sơ/bằng chứng khắc phục
                  </label>
                  <textarea
                    id="remediation-evidence"
                    value={remediationEvidence}
                    onChange={(event) => setRemediationEvidence(event.target.value)}
                    required
                    maxLength={2000}
                    className="border-input bg-background mt-1 w-full rounded-md border p-2 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={approvalConfirmed}
                    onChange={(event) => setApprovalConfirmed(event.target.checked)}
                    required
                  />
                  Admin xác nhận đã kiểm tra hồ sơ và phê duyệt hoạt động lại
                </label>
              </>
            )}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50"
              >
                {saving ? "Đang lưu…" : "Lưu trạng thái"}
              </button>
            </div>
          </form>
        )}
      </section>
      <section className="rounded-xl border p-5" aria-labelledby="facility-timeline">
        <h2 id="facility-timeline" className="font-semibold">
          Lịch sử hoạt động và cập nhật cơ sở
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <div>
            <label htmlFor="history-type" className="block text-sm">
              Loại thay đổi
            </label>
            <select
              id="history-type"
              value={filterType}
              onChange={(event) => {
                setFilterType(event.target.value as FilterType);
                setPage(1);
              }}
              className="border-input bg-background mt-1 rounded-md border p-2 text-sm"
            >
              <option value="all">Tất cả</option>
              <option value="status">Trạng thái</option>
              <option value="details">Thông tin cơ sở</option>
            </select>
          </div>
          <div>
            <label htmlFor="history-from" className="block text-sm">
              Từ thời gian
            </label>
            <input
              id="history-from"
              type="datetime-local"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className="border-input bg-background mt-1 rounded-md border p-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="history-to" className="block text-sm">
              Đến thời gian
            </label>
            <input
              id="history-to"
              type="datetime-local"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className="border-input bg-background mt-1 rounded-md border p-2 text-sm"
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="text-destructive mt-3 text-sm">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status" className="text-muted-foreground mt-4 text-sm">
            Đang tải lịch sử…
          </p>
        ) : timeline?.items.length ? (
          <ol className="mt-5 space-y-4 border-l pl-5">
            {timeline.items.map((item) => {
              const before = fieldSnapshot(item.before_json);
              const after = fieldSnapshot(item.after_json);
              return (
                <li key={`${item.type}-${item.id}`} className="relative text-sm">
                  <span className="bg-primary absolute top-2 -left-[25px] size-2 rounded-full" />
                  <p className="font-semibold">
                    {item.type === "status" ? "Thay đổi trạng thái" : "Cập nhật thông tin"}
                  </p>
                  <p className="text-muted-foreground">
                    {new Date(item.occurred_at).toLocaleString("vi-VN")} ·{" "}
                    {item.actor_name ?? item.actor_username ?? "Tài khoản đã xóa"}
                  </p>
                  {item.type === "status" ? (
                    <>
                      <p>
                        {facilityStatusNames[item.previous_status ?? ""] ?? item.previous_status} →{" "}
                        {facilityStatusNames[item.new_status ?? ""] ?? item.new_status}
                      </p>
                      <p>Lý do: {item.reason}</p>
                      {item.decision_reference && <p>Số quyết định: {item.decision_reference}</p>}
                    </>
                  ) : (
                    <div className="mt-1 space-y-1">
                      <p>
                        Trước: {before?.name} · {before?.address}
                      </p>
                      <p>
                        Sau: {after?.name} · {after?.address}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          !error && (
            <p className="text-muted-foreground mt-5 text-sm">Chưa có thay đổi phù hợp bộ lọc.</p>
          )
        )}
        <div className="mt-5 flex items-center gap-4 text-sm">
          <span>{timeline?.total ?? 0} thay đổi</span>
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="disabled:opacity-40"
          >
            Trước
          </button>
          <span>Trang {page}</span>
          <button
            disabled={!timeline || page * timeline.pageSize >= timeline.total}
            onClick={() => setPage(page + 1)}
            className="disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      </section>
    </div>
  );
}
