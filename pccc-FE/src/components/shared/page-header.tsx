import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ModuleCode } from "@/data/types";
import { tenPhanHe } from "@/lib/navigation";

interface PageHeaderProps {
  title: string;
  description?: string;
  module?: ModuleCode;
  useCases?: string[];
  actions?: React.ReactNode;
  className?: string;
}

/** Tiêu đề màn hình kèm mã phân hệ/Use Case để đối chiếu với URD. */
export function PageHeader({
  title,
  description,
  module,
  useCases,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          {module && (
            <Badge variant="secondary" title={tenPhanHe[module]}>
              {module}
            </Badge>
          )}
          {useCases?.map((uc) => (
            <Badge key={uc} variant="outline" className="font-mono text-[11px]">
              {uc}
            </Badge>
          ))}
        </div>
        {description && (
          <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
