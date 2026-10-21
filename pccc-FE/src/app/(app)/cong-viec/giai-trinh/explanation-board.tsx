"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toBusinessDate } from "@/lib/date";
import { type ExplanationRecord, type ExplanationStatus } from "@/lib/explanation-contract";
import { formatDate } from "@/lib/utils";

const statusLabels: Record<ExplanationStatus, string> = {
  requested: "Chờ giải trình",
  submitted: "Đã phản hồi",
  accepted: "Đã chấp nhận",
  rejected: "Không chấp nhận",
};

const statusTone: Record<ExplanationStatus, "warning" | "info" | "success" | "danger"> = {
  requested: "warning",
  submitted: "info",
  accepted: "success",
  rejected: "danger",
};

export function ExplanationBoard({
  items,
  accounts,
  currentUserId,
  canRequest,
  canReviewAll,
}: {
  items: ExplanationRecord[];
  accounts: Array<{ id: string; full_name: string; username: string }>;
  currentUserId: string;
  canRequest: boolean;
  canReviewAll: boolean;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = React.useState(accounts[0]?.id ?? "");
  const [period, setPeriod] = React.useState(toBusinessDate().slice(0, 7));
  const [reason, setReason] = React.useState("");
  const [responses, setResponses] = React.useState<Record<number, string>>({});
  const [reviews, setReviews] = React.useState<Record<number, string>>({});
  const [busy, setBusy] = React.useState<number | "create" | null>(null);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");

  async function call(url: string, method: string, body: unknown) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message ?? "Không thể xử lý giải trình.");
    return result;
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    setError("");
    setMessage("");
    try {
      await call("/api/explanations", "POST", { accountId, period, reason: reason.trim() });
      setReason("");
      setMessage("Đã gửi yêu cầu giải trình.");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể gửi yêu cầu.");
    } finally {
      setBusy(null);
    }
  }

  async function submitResponse(id: number) {
    setBusy(id);
    setError("");
    setMessage("");
    try {
      await call(`/api/explanations/${id}/response`, "PUT", {
        response: (responses[id] ?? "").trim(),
      });
      setMessage("Đã gửi nội dung giải trình.");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể gửi giải trình.");
    } finally {
      setBusy(null);
    }
  }

  async function review(id: number, decision: "accepted" | "rejected") {
    setBusy(id);
    setError("");
    setMessage("");
    try {
      await call(`/api/explanations/${id}/review`, "PUT", {
        decision,
        note: (reviews[id] ?? "").trim(),
      });
      setMessage(decision === "accepted" ? "Đã chấp nhận giải trình." : "Đã từ chối giải trình.");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể xử lý giải trình.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 rounded-md border p-3 text-sm"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800"
        >
          {message}
        </p>
      )}

      {canRequest && accounts.length > 0 && (
        <SectionCard
          title="Yêu cầu giải trình mới"
          description="Yêu cầu theo kỳ KPI; nội dung và thời hạn do chỉ huy quyết định."
        >
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="explanation-account">Cán bộ</Label>
              <select
                id="explanation-account"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.full_name} ({account.username})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="explanation-period">Kỳ KPI</Label>
              <Input
                id="explanation-period"
                type="month"
                required
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-3">
              <Label htmlFor="explanation-reason">Lý do yêu cầu</Label>
              <textarea
                id="explanation-reason"
                required
                maxLength={2000}
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="border-input bg-background w-full rounded-md border p-2 text-sm"
              />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={busy === "create" || !accountId}>
                {busy === "create" ? "Đang gửi..." : "Gửi yêu cầu"}
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      {items.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border p-8 text-center text-sm">
          Chưa có yêu cầu giải trình nào.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => {
            const canRespond = item.account_id === currentUserId && item.status === "requested";
            const canReview =
              canRequest &&
              item.status === "submitted" &&
              (item.requested_by === currentUserId || canReviewAll);
            return (
              <SectionCard
                key={item.id}
                title={item.task_title ?? `Giải trình KPI kỳ ${item.period}`}
                description={`${item.account_name} · ${item.task_code ?? item.period ?? ""} · ${formatDate(
                  new Date(item.requested_at).toISOString(),
                )}`}
                action={
                  <Badge variant={statusTone[item.status]}>{statusLabels[item.status]}</Badge>
                }
                contentClassName="space-y-3"
              >
                <div className="border-destructive/20 bg-destructive/5 rounded-lg border p-3">
                  <p className="text-destructive mb-1 text-xs font-semibold">
                    Yêu cầu từ {item.requester_name}
                  </p>
                  <p className="text-[13px]">{item.reason}</p>
                </div>
                {item.response && (
                  <div className="bg-muted/60 rounded-lg border p-3">
                    <p className="text-muted-foreground mb-1 text-xs font-semibold">
                      Phản hồi của {item.account_name}
                    </p>
                    <p className="text-[13px] whitespace-pre-wrap">{item.response}</p>
                  </div>
                )}
                {item.review_note && (
                  <p className="text-muted-foreground text-xs">Ghi chú xử lý: {item.review_note}</p>
                )}
                {canRespond && (
                  <div className="space-y-2 rounded-lg border p-3">
                    <Label htmlFor={`response-${item.id}`}>Nội dung giải trình</Label>
                    <textarea
                      id={`response-${item.id}`}
                      rows={3}
                      maxLength={4000}
                      value={responses[item.id] ?? ""}
                      onChange={(event) =>
                        setResponses((value) => ({ ...value, [item.id]: event.target.value }))
                      }
                      className="border-input bg-background w-full rounded-md border p-2 text-sm"
                    />
                    <Button
                      size="sm"
                      disabled={busy === item.id || !(responses[item.id] ?? "").trim()}
                      onClick={() => void submitResponse(item.id)}
                    >
                      {busy === item.id ? "Đang gửi..." : "Gửi giải trình"}
                    </Button>
                  </div>
                )}
                {canReview && (
                  <div className="space-y-2 rounded-lg border p-3">
                    <Label htmlFor={`review-${item.id}`}>Ghi chú xử lý</Label>
                    <Input
                      id={`review-${item.id}`}
                      value={reviews[item.id] ?? ""}
                      onChange={(event) =>
                        setReviews((value) => ({ ...value, [item.id]: event.target.value }))
                      }
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === item.id}
                        onClick={() => void review(item.id, "rejected")}
                      >
                        Không chấp nhận
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy === item.id}
                        onClick={() => void review(item.id, "accepted")}
                      >
                        Chấp nhận
                      </Button>
                    </div>
                  </div>
                )}
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
