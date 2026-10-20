"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { TaskRecord } from "@/lib/task-contract";

interface Assignee {
  id: string;
  full_name: string;
  username: string;
  role_code: string;
}

export function TaskCreateForm() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [assignees, setAssignees] = React.useState<Assignee[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/tasks/assignees", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message ?? "Không thể tải cán bộ.");
        if (!controller.signal.aborted) setAssignees(result.items);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : "Không thể tải cán bộ.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(fields.get("title") ?? "").trim(),
          description: String(fields.get("description") ?? "").trim(),
          kind: String(fields.get("kind") ?? ""),
          dueDate: String(fields.get("dueDate") ?? ""),
          assigneeId: String(fields.get("assigneeId") ?? ""),
        }),
      });
      const result = (await response.json()) as { task?: TaskRecord; error?: { message?: string } };
      if (!response.ok || !result.task)
        throw new Error(result.error?.message ?? "Không thể tạo công việc.");
      router.push(`/cong-viec/giao-viec/${encodeURIComponent(result.task.id)}`);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tạo công việc.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border p-4">
      <button
        type="button"
        className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {open ? "Đóng form" : "+ Giao công việc"}
      </button>
      {open && (
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            Tên công việc{" "}
            <input name="title" required maxLength={200} className="w-full rounded-md border p-2" />
          </label>
          <label className="space-y-1 text-sm">
            Loại công việc{" "}
            <select name="kind" className="w-full rounded-md border p-2">
              <option value="assigned">Được giao</option>
              <option value="routine">Thường xuyên</option>
              <option value="unscheduled">Đột xuất</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            Người thực hiện{" "}
            <select
              name="assigneeId"
              required
              className="w-full rounded-md border p-2"
              disabled={loading}
            >
              <option value="">Chọn cán bộ</option>
              {assignees.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name} ({person.username})
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            Hạn hoàn thành{" "}
            <input type="date" name="dueDate" required className="w-full rounded-md border p-2" />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            Nội dung{" "}
            <textarea
              name="description"
              required
              maxLength={4000}
              rows={3}
              className="w-full rounded-md border p-2"
            />
          </label>
          {loading && (
            <p role="status" className="text-sm">
              Đang tải danh sách cán bộ...
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700 sm:col-span-2">
              {error}
            </p>
          )}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving || loading || assignees.length === 0}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Giao việc"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
