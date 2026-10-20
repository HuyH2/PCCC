"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { TaskRecord } from "@/lib/task-contract";

interface ProgressEvent {
  id: number;
  actor_name: string;
  occurred_at: number;
  before: { progress: number };
  after: { progress: number; note: string };
}

export function TaskProgress({
  task,
  isAssignee,
  canUpdate,
}: {
  task: TaskRecord;
  isAssignee: boolean;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [progress, setProgress] = React.useState(task.progress);
  const [note, setNote] = React.useState("");
  const [history, setHistory] = React.useState<ProgressEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [revision, setRevision] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/tasks/${encodeURIComponent(task.id)}/progress-history?pageSize=20`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error?.message ?? "Không thể tải lịch sử tiến độ.");
        if (!controller.signal.aborted) setHistory(result.items);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : "Không thể tải lịch sử tiến độ.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [task.id, revision]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress, note: note.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Không thể cập nhật tiến độ.");
      setNote("");
      setRevision((value) => value + 1);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể cập nhật tiến độ.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border p-4">
      <h2 className="font-semibold">Tiến độ công việc</h2>
      <p className="text-sm">
        Người thực hiện: {task.assignee_name} · Hạn hoàn thành:{" "}
        {task.due_at
          ? new Date(task.due_at).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
          : "Chưa có"}
      </p>
      <div className="flex items-center gap-3">
        <progress
          className="h-3 w-full max-w-sm accent-red-700"
          value={task.progress}
          max={100}
          aria-label="Tiến độ hiện tại"
        />
        <strong>{task.progress}%</strong>
      </div>
      {!canUpdate && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm">
          {task.status !== "open"
            ? "Công việc đã đóng nên không thể cập nhật tiến độ."
            : isAssignee
              ? "Tài khoản của bạn chưa có quyền sửa công việc (M07.edit), nên chưa thể ghi nhận tiến độ."
              : `Chỉ người thực hiện (${task.assignee_name}) được ghi nhận tiến độ. Cán bộ đăng nhập, mở công việc này, nhập phần trăm và ghi chú; người giao sẽ thấy kết quả tại đây.`}
        </p>
      )}
      {canUpdate && (
        <form onSubmit={save} className="space-y-3 rounded-md border p-3">
          <h3 className="text-sm font-semibold">Ghi nhận tiến độ</h3>
          <label className="block space-y-1 text-sm">
            Tiến độ mới (%){" "}
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={progress}
              onChange={(event) => setProgress(Number(event.target.value))}
              className="block w-32 rounded-md border p-2"
            />
          </label>
          <label className="block space-y-1 text-sm">
            Nội dung đã thực hiện / ghi chú{" "}
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={1000}
              rows={2}
              className="block w-full rounded-md border p-2"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Ghi nhận tiến độ"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Lịch sử tiến độ</h3>
        {loading ? (
          <p role="status" className="text-sm">
            Đang tải lịch sử...
          </p>
        ) : history.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {task.code.startsWith("CV-DEMO-") && task.progress > 0
              ? "Đây là tiến độ khởi tạo của dữ liệu mẫu. Nhật ký sẽ xuất hiện khi người thực hiện ghi nhận thay đổi."
              : "Chưa có lần cập nhật. Mỗi lần người thực hiện lưu tiến độ sẽ hiện ở đây."}
          </p>
        ) : (
          history.map((entry) => (
            <div key={entry.id} className="rounded-md border p-3 text-sm">
              <strong>{entry.actor_name}</strong> ·{" "}
              {new Date(entry.occurred_at).toLocaleString("vi-VN")} · {entry.before.progress}% →{" "}
              {entry.after.progress}%
              {entry.after.note && <p className="mt-1">{entry.after.note}</p>}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
