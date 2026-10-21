"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Notification = {
  id: string;
  feature: string;
  kind: string;
  title: string;
  body: string;
  target_path: string | null;
  created_at: number;
  read_at: number | null;
};
export function NotificationCenter() {
  const [items, setItems] = React.useState<Notification[]>([]);
  const [total, setTotal] = React.useState(0);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [onlyUnread, setOnlyUnread] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const load = React.useCallback(async () => {
    try {
      const response = await fetch(
        `/api/notifications?page=${page}&pageSize=20&unread=${onlyUnread ? 1 : 0}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Không thể tải thông báo.");
      setItems(data.items);
      setTotal(data.total);
      setUnreadCount(data.unreadCount);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải thông báo.");
    } finally {
      setLoading(false);
    }
  }, [page, onlyUnread]);
  React.useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  }, [load]);
  async function mark(path: string) {
    try {
      const response = await fetch(`/api${path}`, { method: "POST" });
      if (!response.ok) throw new Error("Không thể đánh dấu đã đọc.");
      await load();
      window.dispatchEvent(new Event("pccc-notifications-changed"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể cập nhật.");
    }
  }
  return (
    <div className="space-y-5">
      <PageHeader
        title="Cảnh báo & nhắc việc"
        module="M10"
        useCases={["UC-SYS-03"]}
        description="Thông báo giao báo cáo, sắp đến hạn, quá hạn, đã nộp và hoàn thành. Chuông tự làm mới mỗi 30 giây."
        actions={
          <Button
            variant="outline"
            onClick={() => void mark("/notifications/read-all")}
            disabled={unreadCount === 0}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        }
      />
      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="text-sm">
            <input
              type="checkbox"
              checked={onlyUnread}
              onChange={(e) => {
                setOnlyUnread(e.target.checked);
                setPage(1);
              }}
            />{" "}
            Chỉ chưa đọc
          </label>
          <span className="text-muted-foreground text-sm">
            {unreadCount} chưa đọc · {total} thông báo theo bộ lọc
          </span>
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
          <p>Đang tải thông báo…</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground">Không có thông báo phù hợp.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`flex flex-wrap items-start justify-between gap-2 border-b py-3 ${item.read_at ? "opacity-70" : ""}`}
            >
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm">{item.body}</p>
                <p className="text-muted-foreground text-xs">
                  {new Date(item.created_at).toLocaleString("vi-VN")} · {item.feature}
                </p>
                {item.target_path && (
                  <Link className="text-primary text-sm underline" href={item.target_path}>
                    Mở hồ sơ
                  </Link>
                )}
              </div>
              {!item.read_at && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void mark(`/notifications/${item.id}/read`)}
                >
                  Đã đọc
                </Button>
              )}
            </div>
          ))
        )}
        <div className="mt-3 flex items-center gap-2 text-sm">
          Trang {page}
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Trước
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page * 20 >= total}
            onClick={() => setPage(page + 1)}
          >
            Sau
          </Button>
        </div>
      </Card>
    </div>
  );
}
