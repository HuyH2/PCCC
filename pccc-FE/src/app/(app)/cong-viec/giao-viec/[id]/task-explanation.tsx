"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { TaskRecord } from "@/lib/task-contract";

export function TaskExplanationRequest({
  task,
  canRequest,
}: {
  task: TaskRecord;
  canRequest: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  if (!canRequest || task.status === "cancelled") return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/explanations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: task.assigned_to,
          taskId: task.id,
          reason: reason.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Không thể gửi yêu cầu.");
      setDone(true);
      setReason("");
      setOpen(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể gửi yêu cầu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      {!open ? (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Yêu cầu giải trình
        </Button>
      ) : (
        <form onSubmit={submit} className="space-y-2 rounded-lg border p-3">
          <label htmlFor="task-explanation-reason" className="text-sm font-medium">
            Lý do yêu cầu {task.assignee_name} giải trình
          </label>
          <textarea
            id="task-explanation-reason"
            required
            rows={2}
            maxLength={2000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="border-input bg-background w-full rounded-md border p-2 text-sm"
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" size="sm" disabled={saving || !reason.trim()}>
              {saving ? "Đang gửi..." : "Gửi yêu cầu"}
            </Button>
          </div>
        </form>
      )}
      {done && (
        <p className="text-sm text-green-700">
          Đã gửi yêu cầu. Theo dõi tại{" "}
          <Link href="/cong-viec/giai-trinh" className="underline">
            màn hình giải trình
          </Link>
          .
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
