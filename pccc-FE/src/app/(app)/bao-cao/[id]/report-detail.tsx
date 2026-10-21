"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AuthUser } from "@/lib/auth-contract";

type Request = {
  id: string;
  title: string;
  type_name: string;
  cycle: string;
  recipient: string;
  reference_number: string | null;
  assignee_id: string;
  assignee_name: string;
  requester_id: string;
  requester_name: string;
  due_date: string;
  warning_days: number;
  status: string;
  deadline_status: string;
};
type Submission = {
  id: string;
  file_name: string;
  file_size: number;
  note: string;
  submitter_name: string;
  submitted_at: number;
};
type Detail = { request: Request; submissions: Submission[] };
type Assignee = { id: string; full_name: string };
async function json(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? "Không thể xử lý yêu cầu.");
  return data;
}
export function ReportDetail({ id, user }: { id: string; user: AuthUser }) {
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [assignees, setAssignees] = React.useState<Assignee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [note, setNote] = React.useState("");
  const [editing, setEditing] = React.useState(false);
  const [assigneeId, setAssigneeId] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const load = React.useCallback(async () => {
    try {
      setError("");
      setDetail(await json(`/reports/requests/${id}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải báo cáo.");
    } finally {
      setLoading(false);
    }
  }, [id]);
  React.useEffect(() => {
    void load();
  }, [load]);
  const r = detail?.request;
  const canEdit =
    r?.status === "open" &&
    (r.requester_id === user.id || user.role === "A05") &&
    user.permissions.includes("M08.edit");
  const canSubmit =
    r?.status === "open" && r.assignee_id === user.id && user.permissions.includes("M08.edit");
  const canComplete =
    r?.status === "submitted" &&
    (r.requester_id === user.id || user.role === "A05") &&
    user.permissions.includes("M08.approve");
  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await json(`/reports/requests/${id}`, "PUT", { assigneeId, dueDate });
      setEditing(false);
      toast.success("Đã cập nhật yêu cầu");
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Không thể cập nhật.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/reports/requests/${id}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "X-File-Name": encodeURIComponent(file.name),
          "X-Report-Note": encodeURIComponent(note),
        },
        body: file,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Không thể nộp báo cáo.");
      toast.success("Đã nộp báo cáo");
      setFile(null);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Không thể nộp báo cáo.");
    } finally {
      setBusy(false);
    }
  }
  async function complete() {
    setBusy(true);
    try {
      await json(`/reports/requests/${id}/complete`, "POST");
      setConfirming(false);
      toast.success("Đã xác nhận hoàn thành");
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Không thể hoàn thành.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <Link className="text-primary text-sm underline" href="/bao-cao">
        ← Danh sách báo cáo
      </Link>
      {loading ? (
        <p>Đang tải báo cáo…</p>
      ) : error ? (
        <p role="alert" className="text-destructive">
          {error} <Button onClick={() => void load()}>Thử lại</Button>
        </p>
      ) : (
        r && (
          <>
            <PageHeader
              title={r.title}
              module="M08"
              useCases={["UC-RPT-04"]}
              description={`${r.type_name} · ${r.status === "open" ? "Chờ nộp" : r.status === "submitted" ? "Đã nộp" : "Hoàn thành"}`}
            />
            <Card className="grid gap-3 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <p>
                <b>Người yêu cầu:</b> {r.requester_name}
              </p>
              <p>
                <b>Người thực hiện:</b> {r.assignee_name}
              </p>
              <p>
                <b>Deadline:</b>{" "}
                {new Date(`${r.due_date}T00:00:00+07:00`).toLocaleDateString("vi-VN")}
              </p>
              <p>
                <b>Cảnh báo:</b> Trước {r.warning_days} ngày
              </p>
              <p>
                <b>Nơi nhận:</b> {r.recipient}
              </p>
              <p>
                <b>Số văn bản đến:</b> {r.reference_number || "—"}
              </p>
              <p>
                <b>Tình trạng hạn:</b>{" "}
                {r.deadline_status === "overdue"
                  ? "Quá hạn"
                  : r.deadline_status === "due_soon"
                    ? "Sắp đến hạn"
                    : "Bình thường/đã đóng"}
              </p>
            </Card>
            {canEdit && (
              <Card className="p-4">
                <Button
                  variant="outline"
                  onClick={async () => {
                    setEditing(!editing);
                    setAssigneeId(r.assignee_id);
                    setDueDate(r.due_date);
                    if (!editing)
                      try {
                        setAssignees((await json("/reports/assignees")).items);
                      } catch {}
                  }}
                >
                  Điều chỉnh người thực hiện / deadline
                </Button>
                {editing && (
                  <form onSubmit={saveEdit} className="mt-3 flex flex-wrap items-end gap-3">
                    <label className="text-sm">
                      Người thực hiện
                      <select
                        className="mt-1 block h-9 rounded-md border px-2"
                        value={assigneeId}
                        onChange={(e) => setAssigneeId(e.target.value)}
                      >
                        {assignees.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.full_name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      Deadline
                      <Input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </label>
                    <Button disabled={busy}>Lưu thay đổi</Button>
                  </form>
                )}
              </Card>
            )}
            {r.status === "open" && (
              <Card className="p-4">
                <h2 className="font-semibold">Nộp báo cáo</h2>
                {canSubmit ? (
                  <form onSubmit={submit} className="mt-3 grid max-w-xl gap-3">
                    <label className="text-sm">
                      File kết quả (PDF, PNG, JPEG, DOCX, XLSX; tối đa 10 MB)
                      <Input
                        required
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    <label className="text-sm">
                      Ghi chú
                      <Input
                        maxLength={1000}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </label>
                    <Button disabled={busy || !file} type="submit">
                      {busy ? "Đang nộp…" : "Nộp báo cáo"}
                    </Button>
                  </form>
                ) : (
                  <p className="text-muted-foreground mt-2 text-sm">
                    {r.assignee_id !== user.id
                      ? `Chỉ người thực hiện (${r.assignee_name}) được tải file và nộp báo cáo. Hãy đăng nhập tài khoản của người này${canEdit ? " hoặc điều chỉnh người thực hiện ở phía trên" : ""}.`
                      : "Tài khoản của bạn chưa có quyền sửa báo cáo (M08.edit), nên chưa thể tải file và nộp."}
                  </p>
                )}
              </Card>
            )}
            {canComplete && (
              <Card className="p-4">
                <p className="mb-3 text-sm">Báo cáo đã được nộp. Người yêu cầu xác nhận để đóng.</p>
                {confirming ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">Xác nhận đóng báo cáo này?</span>
                    <Button disabled={busy} onClick={() => void complete()}>
                      Đồng ý hoàn thành
                    </Button>
                    <Button variant="outline" onClick={() => setConfirming(false)}>
                      Hủy
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => setConfirming(true)}>Xác nhận hoàn thành</Button>
                )}
              </Card>
            )}
            <Card className="p-4">
              <h2 className="font-semibold">File đã nộp</h2>
              {detail?.submissions.length ? (
                detail.submissions.map((s) => (
                  <div key={s.id} className="border-b py-3 text-sm">
                    <a
                      className="text-primary underline"
                      href={`/api/reports/requests/${id}/submissions/${s.id}/file`}
                    >
                      {s.file_name}
                    </a>
                    <p className="text-muted-foreground">
                      {s.submitter_name} · {new Date(s.submitted_at).toLocaleString("vi-VN")} ·{" "}
                      {Math.ceil(s.file_size / 1024)} KB
                    </p>
                    {s.note && <p>{s.note}</p>}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground mt-2 text-sm">Chưa có file kết quả.</p>
              )}
            </Card>
          </>
        )
      )}
    </div>
  );
}
