import * as React from "react";
import { cn } from "@/lib/utils";

/** Một nhóm trường trong biểu mẫu, có tiêu đề và mô tả ngắn. */
export function FormSection({
  title,
  description,
  children,
  className,
  cols = 2,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  cols?: 1 | 2 | 3;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="space-y-0.5">
        <h3 className="text-primary text-[13px] font-bold tracking-wide uppercase">{title}</h3>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
      <div
        className={cn(
          "grid gap-4",
          cols === 2 && "sm:grid-cols-2",
          cols === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** Ô chiếm trọn chiều ngang trong lưới của FormSection. */
export function FormSpan({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("sm:col-span-2 lg:col-span-3", className)}>{children}</div>;
}
