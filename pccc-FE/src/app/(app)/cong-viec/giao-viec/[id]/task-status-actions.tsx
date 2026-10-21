"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TaskRecord } from "@/lib/task-contract";

const labels: Record<TaskRecord["status"], string> = {
  open: "Đang thực hiện",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

export function TaskStatusActions({
  task,
  currentUserId,
  canEdit,
}: {
  task: TaskRecord;
  currentUserId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const canComplete =
    canEdit &&
    task.status === "open" &&
    (task.assigned_to === currentUserId || task.assigned_by === currentUserId);
  const canCancel = canEdit && task.status === "open" && task.assigned_by === currentUserId;
  const canReopen = canEdit && task.status !== "open" && task.assigned_by === currentUserId;

  async function change(status: "open" | "completed" | "cancelled") {
    if (
      status === "cancelled" &&
      !window.confirm("Hủy công việc này? Công việc vẫn được lưu để tra cứu.")
    )
      return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Không thể đổi trạng thái.");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể đổi trạng thái.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        variant={
          task.status === "completed"
            ? "success"
            : task.status === "cancelled"
              ? "danger"
              : "warning"
        }
      >
        {labels[task.status]}
      </Badge>
      {canComplete && (
        <Button size="sm" disabled={busy} onClick={() => void change("completed")}>
          {busy ? "Đang lưu..." : "Hoàn thành công việc"}
        </Button>
      )}
      {canCancel && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void change("cancelled")}
        >
          Hủy công việc
        </Button>
      )}
      {canReopen && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void change("open")}>
          Mở lại công việc
        </Button>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
