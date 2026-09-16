import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { SearchX } from "lucide-react";

export function EmptyState({
  icon: Icon = SearchX,
  title = "Không có dữ liệu phù hợp",
  description = "Thử bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm.",
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
        <Icon className="size-5" />
      </span>
      <p className="font-semibold">{title}</p>
      <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
    </div>
  );
}
