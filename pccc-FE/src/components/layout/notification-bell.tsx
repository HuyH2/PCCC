"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Notification = {
  id: string;
  title: string;
  body: string;
  target_path: string | null;
  read_at: number | null;
};
export function NotificationBell() {
  const [items, setItems] = React.useState<Notification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [error, setError] = React.useState("");
  const load = React.useCallback(async () => {
    try {
      const response = await fetch("/api/notifications?pageSize=5", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Không thể tải thông báo.");
      setItems(data.items);
      setUnread(data.unreadCount);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải thông báo.");
    }
  }, []);
  React.useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30000);
    window.addEventListener("pccc-notifications-changed", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pccc-notifications-changed", load);
    };
  }, [load]);
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void load();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={`Thông báo (${unread} chưa đọc)`}
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-3">
        <p className="mb-2 font-semibold">Thông báo</p>
        {error && (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        )}
        {items.length === 0 && !error && (
          <p className="text-muted-foreground text-sm">Chưa có thông báo.</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="border-t py-2 text-sm">
            <p className={item.read_at ? "" : "font-semibold"}>{item.title}</p>
            <p className="text-muted-foreground text-xs">{item.body}</p>
            {item.target_path && (
              <Link className="text-primary underline" href={item.target_path}>
                Mở hồ sơ
              </Link>
            )}
          </div>
        ))}
        <Link className="text-primary mt-2 block border-t pt-2 text-sm underline" href="/canh-bao">
          Xem tất cả
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
