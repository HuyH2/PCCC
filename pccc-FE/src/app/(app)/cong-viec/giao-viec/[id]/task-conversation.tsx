"use client";

import * as React from "react";
import type { TaskMessagePage } from "@/lib/task-contract";

const pageSize = 20;

export function TaskConversation({
  taskId,
  currentUserId,
  canSend,
  canEdit,
}: {
  taskId: string;
  currentUserId: string;
  canSend: boolean;
  canEdit: boolean;
}) {
  const [messages, setMessages] = React.useState<TaskMessagePage | null>(null);
  const [page, setPage] = React.useState(1);
  const [draft, setDraft] = React.useState("");
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editBody, setEditBody] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [revision, setRevision] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(
          `/api/tasks/${encodeURIComponent(taskId)}/messages?page=${page}&pageSize=${pageSize}`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );
        if (!response.ok) throw new Error("Không thể tải trao đổi của công việc.");
        const result = (await response.json()) as TaskMessagePage;
        if (!controller.signal.aborted) {
          setMessages(result);
          setError("");
        }
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : "Không thể tải tin nhắn.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    setLoading(true);
    void load();
    const timer = page === 1 ? setInterval(() => void load(), 5000) : null;
    return () => {
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [taskId, page, revision]);

  async function mutate(url: string, method: "POST" | "PUT" | "DELETE", body?: string) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify({ body }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Không thể lưu tin nhắn.");
      setRevision((value) => value + 1);
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể lưu tin nhắn.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) {
      setError("Vui lòng nhập nội dung tin nhắn.");
      return;
    }
    if (await mutate(`/api/tasks/${encodeURIComponent(taskId)}/messages`, "POST", draft.trim())) {
      setDraft("");
      setPage(1);
    }
  }

  async function saveEdit(id: number) {
    if (!editBody.trim()) {
      setError("Nội dung tin nhắn không được để trống.");
      return;
    }
    if (
      await mutate(
        `/api/tasks/${encodeURIComponent(taskId)}/messages/${id}`,
        "PUT",
        editBody.trim(),
      )
    ) {
      setEditingId(null);
      setEditBody("");
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Xóa tin nhắn này? Nội dung sẽ không còn hiển thị.")) return;
    await mutate(`/api/tasks/${encodeURIComponent(taskId)}/messages/${id}`, "DELETE");
  }

  return (
    <section className="space-y-4 rounded-xl border p-4 sm:p-5" aria-labelledby="task-conversation">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="task-conversation" className="font-semibold">
          Trao đổi theo công việc
        </h2>
        <span className="text-muted-foreground text-xs">Tự cập nhật tin mới mỗi 5 giây</span>
      </div>
      {error && (
        <p role="alert" className="text-destructive rounded-md border p-3 text-sm">
          {error}
        </p>
      )}
      {loading && !messages && (
        <p role="status" className="text-muted-foreground text-sm">
          Đang tải tin nhắn…
        </p>
      )}
      {messages && messages.items.length === 0 && (
        <p className="text-muted-foreground rounded-md border p-4 text-sm">
          Chưa có tin nhắn. Hãy bắt đầu trao đổi.
        </p>
      )}
      <ol className="space-y-3" aria-label="Danh sách tin nhắn">
        {messages?.items.map((message) => (
          <li key={message.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <strong>{message.sender_name}</strong>
              <time
                className="text-muted-foreground"
                dateTime={new Date(message.created_at).toISOString()}
              >
                {new Date(message.created_at).toLocaleString("vi-VN")}
              </time>
            </div>
            {editingId === message.id ? (
              <div className="mt-2 space-y-2">
                <label htmlFor={`edit-message-${message.id}`} className="sr-only">
                  Sửa nội dung tin nhắn
                </label>
                <textarea
                  id={`edit-message-${message.id}`}
                  value={editBody}
                  onChange={(event) => setEditBody(event.target.value)}
                  maxLength={2000}
                  className="border-input bg-background w-full rounded-md border p-2 text-sm"
                />
                <div className="flex gap-3 text-sm">
                  <button
                    type="button"
                    disabled={saving}
                    className="text-primary hover:underline"
                    onClick={() => void saveEdit(message.id)}
                  >
                    Lưu sửa
                  </button>
                  <button type="button" onClick={() => setEditingId(null)}>
                    Hủy
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {message.deleted_at ? (
                  <em className="text-muted-foreground">Tin nhắn đã xóa</em>
                ) : (
                  message.body
                )}
              </p>
            )}
            {message.edited_at && !message.deleted_at && (
              <span className="text-muted-foreground text-xs">Đã chỉnh sửa</span>
            )}
            {canEdit &&
              message.sender_id === currentUserId &&
              !message.deleted_at &&
              editingId !== message.id && (
                <div className="mt-2 flex gap-4 text-xs">
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => {
                      setEditingId(message.id);
                      setEditBody(message.body ?? "");
                    }}
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    className="text-destructive hover:underline"
                    onClick={() => void remove(message.id)}
                  >
                    Xóa
                  </button>
                </div>
              )}
          </li>
        ))}
      </ol>
      {messages && messages.total > pageSize && (
        <nav className="flex items-center gap-4 text-sm" aria-label="Phân trang tin nhắn">
          {page * pageSize < messages.total && (
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setPage((value) => value + 1)}
            >
              Tin cũ hơn
            </button>
          )}
          {page > 1 && (
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setPage((value) => value - 1)}
            >
              Tin mới hơn
            </button>
          )}
        </nav>
      )}
      {canSend && (
        <form onSubmit={send} className="space-y-2 border-t pt-4">
          <label htmlFor="new-task-message" className="text-sm font-medium">
            Nội dung tin nhắn
          </label>
          <textarea
            id="new-task-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={2000}
            required
            rows={3}
            className="border-input bg-background w-full rounded-md border p-2 text-sm"
            placeholder="Nhập trao đổi về công việc…"
          />
          <button
            type="submit"
            disabled={saving}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50"
          >
            {saving ? "Đang gửi…" : "Gửi tin nhắn"}
          </button>
        </form>
      )}
    </section>
  );
}
