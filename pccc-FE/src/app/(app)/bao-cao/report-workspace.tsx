"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AuthUser } from "@/lib/auth-contract";

type ReportType = { id: string; name: string; cycle: string; warning_days: number; active: number };
type Assignee = { id: string; full_name: string };
type Request = {
  id: string;
  title: string;
  type_name: string;
  assignee_name: string;
  due_date: string;
  status: string;
  deadline_status: string;
  recipient: string;
  reference_number: string | null;
};
type Schedule = {
  id: string;
  type_name: string;
  assignee_name: string;
  requester_id: string;
  next_due_date: string;
  active: number;
};
const cycleNames: Record<string, string> = {
  once: "Đột xuất",
  weekly: "Tuần",
  monthly: "Tháng",
  quarterly: "Quý",
  yearly: "Năm",
};
async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? "Không thể tải dữ liệu.");
  return data;
}
function vnDate(value: string) {
  return new Date(`${value}T00:00:00+07:00`).toLocaleDateString("vi-VN");
}
function todayVN() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function ReportWorkspace({ user }: { user: AuthUser }) {
  const router = useRouter();
  const canCreate =
    user.permissions.includes("M08.create") && ["A01", "A02", "A04", "A05"].includes(user.role);
  const canManageTypes =
    canCreate && user.role === "A05" && user.scopes.some((s) => s.kind === "all");
  const [types, setTypes] = React.useState<ReportType[]>([]);
  const [assignees, setAssignees] = React.useState<Assignee[]>([]);
  const [items, setItems] = React.useState<Request[]>([]);
  const [schedules, setSchedules] = React.useState<Schedule[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [bucket, setBucket] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [panel, setPanel] = React.useState<"" | "request" | "type" | "schedule">("");
  const [typeId, setTypeId] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [recipient, setRecipient] = React.useState("");
  const [referenceNumber, setReferenceNumber] = React.useState("");
  const [dueDate, setDueDate] = React.useState(todayVN());
  const [typeName, setTypeName] = React.useState("");
  const [cycle, setCycle] = React.useState("once");
  const [warningDays, setWarningDays] = React.useState(5);
  const [editingTypeId, setEditingTypeId] = React.useState("");
  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const search = new URLSearchParams({ page: String(page), pageSize: "20", bucket });
      if (query.trim()) search.set("q", query.trim());
      const [requests, typeResult, scheduleResult] = await Promise.all([
        api<{ items: Request[]; total: number }>(`/reports/requests?${search}`),
        api<{ items: ReportType[] }>("/reports/types"),
        api<{ items: Schedule[] }>("/reports/schedules"),
      ]);
      setItems(requests.items);
      setTotal(requests.total);
      setTypes(typeResult.items);
      setSchedules(scheduleResult.items);
      if (canCreate) setAssignees((await api<{ items: Assignee[] }>("/reports/assignees")).items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải báo cáo.");
    } finally {
      setLoading(false);
    }
  }, [page, bucket, query, canCreate]);
  React.useEffect(() => {
    void load();
  }, [load]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      if (panel === "type") {
        if (editingTypeId) {
          await api(`/reports/types/${editingTypeId}`, "PUT", { name: typeName, warningDays });
          toast.success("Đã cập nhật loại báo cáo");
        } else {
          await api("/reports/types", "POST", { name: typeName, cycle, warningDays });
          toast.success("Đã thêm loại báo cáo");
        }
      } else if (panel === "schedule") {
        await api("/reports/schedules", "POST", {
          reportTypeId: typeId,
          assigneeId,
          recipient,
          referenceNumber,
          firstDueDate: dueDate,
        });
        toast.success("Đã tạo lịch định kỳ. Chọn Sinh kỳ để giao kỳ đầu.");
      } else {
        const result = await api<{ request: Request }>("/reports/requests", "POST", {
          reportTypeId: typeId,
          title,
          recipient,
          referenceNumber,
          assigneeId,
          dueDate,
        });
        toast.success("Đã giao yêu cầu báo cáo");
        router.push(`/bao-cao/${result.request.id}`);
      }
      setPanel("");
      setEditingTypeId("");
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Không thể lưu.");
    } finally {
      setBusy(false);
    }
  }
  async function generate(id: string) {
    setBusy(true);
    try {
      await api(`/reports/schedules/${id}/generate`, "POST");
      toast.success("Đã sinh kỳ báo cáo mới");
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Không thể sinh kỳ.");
    } finally {
      setBusy(false);
    }
  }
  async function toggleSchedule(schedule: Schedule) {
    setBusy(true);
    try {
      await api(`/reports/schedules/${schedule.id}`, "PUT", { active: !schedule.active });
      toast.success(schedule.active ? "Đã tạm dừng lịch" : "Đã mở lại lịch");
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Không thể cập nhật lịch.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <PageHeader
        title="Báo cáo & deadline"
        module="M08"
        useCases={["UC-RPT-01", "UC-RPT-02", "UC-RPT-03", "UC-RPT-04", "UC-RPT-05"]}
        description="Giao yêu cầu, theo dõi hạn nộp, tiếp nhận file và xác nhận hoàn thành."
        actions={
          canCreate ? (
            <div className="flex flex-wrap gap-2">
              {canManageTypes && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingTypeId("");
                    setTypeName("");
                    setPanel("type");
                  }}
                >
                  Loại báo cáo
                </Button>
              )}
              <Button variant="outline" onClick={() => setPanel("schedule")}>
                Lịch định kỳ
              </Button>
              <Button onClick={() => setPanel("request")}>+ Tạo yêu cầu</Button>
            </div>
          ) : undefined
        }
      />
      {panel && (
        <Card className="p-4 sm:p-5">
          <h2 className="font-semibold">
            {panel === "type"
              ? editingTypeId
                ? "Sửa loại báo cáo"
                : "Thêm loại báo cáo"
              : panel === "schedule"
                ? "Tạo lịch định kỳ"
                : "Tạo yêu cầu báo cáo"}
          </h2>
          <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {panel === "type" ? (
              <>
                <label className="text-sm">
                  Tên loại báo cáo
                  <Input
                    required
                    maxLength={200}
                    value={typeName}
                    onChange={(e) => setTypeName(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  Chu kỳ
                  <select
                    disabled={Boolean(editingTypeId)}
                    className="mt-1 h-9 w-full rounded-md border px-2"
                    value={cycle}
                    onChange={(e) => setCycle(e.target.value)}
                  >
                    {Object.entries(cycleNames).map(([value, name]) => (
                      <option key={value} value={value}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Báo trước (ngày)
                  <Input
                    type="number"
                    min={0}
                    max={90}
                    value={warningDays}
                    onChange={(e) => setWarningDays(Number(e.target.value))}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="text-sm">
                  Loại báo cáo
                  <select
                    required
                    className="mt-1 h-9 w-full rounded-md border px-2"
                    value={typeId}
                    onChange={(e) => setTypeId(e.target.value)}
                  >
                    <option value="">Chọn loại</option>
                    {types
                      .filter(
                        (type) => type.active && (panel !== "schedule" || type.cycle !== "once"),
                      )
                      .map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name} ({cycleNames[type.cycle]})
                        </option>
                      ))}
                  </select>
                </label>
                {panel === "request" && (
                  <label className="text-sm">
                    Tên báo cáo
                    <Input
                      required
                      maxLength={200}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                )}
                <label className="text-sm">
                  Người thực hiện
                  <select
                    required
                    className="mt-1 h-9 w-full rounded-md border px-2"
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                  >
                    <option value="">Chọn cán bộ</option>
                    {assignees.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Nơi nhận
                  <Input
                    required
                    maxLength={200}
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  Số văn bản đến (nếu có)
                  <Input
                    maxLength={100}
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  {panel === "schedule" ? "Hạn kỳ đầu" : "Deadline"}
                  <Input
                    required
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </label>
              </>
            )}
            <div className="flex items-end gap-2">
              <Button disabled={busy} type="submit">
                {busy ? "Đang lưu…" : "Lưu"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setPanel("")}>
                Hủy
              </Button>
            </div>
          </form>
        </Card>
      )}
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          <Input
            aria-label="Tìm báo cáo"
            className="max-w-xs"
            placeholder="Tìm tên hoặc số văn bản…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="Lọc hạn báo cáo"
            className="h-9 rounded-md border px-2"
            value={bucket}
            onChange={(e) => {
              setBucket(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tất cả hạn</option>
            <option value="due_soon">Sắp đến hạn</option>
            <option value="overdue">Quá hạn</option>
          </select>
        </div>
        {error && (
          <p role="alert" className="text-destructive">
            {error}{" "}
            <Button variant="outline" onClick={() => void load()}>
              Thử lại
            </Button>
          </p>
        )}
        {loading ? (
          <p>Đang tải báo cáo…</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground">Không có báo cáo phù hợp.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">Báo cáo</th>
                  <th className="p-2">Người thực hiện</th>
                  <th className="p-2">Deadline</th>
                  <th className="p-2">Trạng thái</th>
                  <th className="p-2">Nơi nhận</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-2">
                      <Link
                        className="text-primary font-medium underline"
                        href={`/bao-cao/${item.id}`}
                      >
                        {item.title}
                      </Link>
                      <span className="text-muted-foreground block text-xs">
                        {item.type_name}
                        {item.reference_number ? ` · ${item.reference_number}` : ""}
                      </span>
                    </td>
                    <td className="p-2">{item.assignee_name}</td>
                    <td className="p-2">{vnDate(item.due_date)}</td>
                    <td className="p-2">
                      {item.deadline_status === "overdue"
                        ? "Quá hạn"
                        : item.deadline_status === "due_soon"
                          ? "Sắp đến hạn"
                          : (
                              {
                                open: "Chờ nộp",
                                submitted: "Đã nộp",
                                completed: "Hoàn thành",
                              } as Record<string, string>
                            )[item.status]}
                    </td>
                    <td className="p-2">{item.recipient}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span>
            {total} yêu cầu · Trang {page}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Trước
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page * 20 >= total}
            onClick={() => setPage(page + 1)}
          >
            Sau
          </Button>
        </div>
      </Card>
      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 font-semibold">Danh mục loại báo cáo</h2>
        <div className="space-y-2">
          {types.map((type) => (
            <div
              key={type.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm"
            >
              <span>
                {type.name} · {cycleNames[type.cycle]} · Nhắc trước {type.warning_days} ngày ·{" "}
                {type.active ? "Đang dùng" : "Ngừng dùng"}
              </span>
              {canManageTypes && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingTypeId(type.id);
                    setTypeName(type.name);
                    setCycle(type.cycle);
                    setWarningDays(type.warning_days);
                    setPanel("type");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Sửa
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 font-semibold">Lịch báo cáo định kỳ</h2>
        {schedules.length === 0 ? (
          <p className="text-muted-foreground text-sm">Chưa có lịch.</p>
        ) : (
          <div className="space-y-2">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm"
              >
                <span>
                  {schedule.type_name} · {schedule.assignee_name} · Kỳ tới{" "}
                  {vnDate(schedule.next_due_date)}
                </span>
                {canCreate && (schedule.requester_id === user.id || user.role === "A05") && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || !schedule.active}
                      onClick={() => void generate(schedule.id)}
                    >
                      Sinh kỳ mới
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void toggleSchedule(schedule)}
                    >
                      {schedule.active ? "Tạm dừng" : "Mở lại"}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
