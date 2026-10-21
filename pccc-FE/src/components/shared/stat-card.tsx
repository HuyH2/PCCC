import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";

type Tone = "default" | "danger" | "warning" | "success" | "info";

const toneStyles: Record<Tone, { icon: string; value: string }> = {
  default: { icon: "bg-primary/10 text-primary", value: "text-foreground" },
  danger: { icon: "bg-destructive/12 text-destructive", value: "text-destructive" },
  warning: { icon: "bg-warning/18 text-warning-foreground", value: "text-foreground" },
  success: { icon: "bg-success/12 text-success", value: "text-foreground" },
  info: { icon: "bg-info/12 text-info", value: "text-foreground" },
};

interface StatCardProps {
  label: string;
  value: number | string;
  unit?: string;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
  delta?: { value: number; label: string };
}

export function StatCard({ label, value, unit, hint, icon: Icon, tone = "default", delta }: StatCardProps) {
  const styles = toneStyles[tone];
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground truncate text-[13px] font-medium">{label}</p>
          <p className={cn("text-2xl font-bold tracking-tight tabular-nums", styles.value)}>
            {typeof value === "number" ? formatNumber(value) : value}
            {unit && <span className="text-muted-foreground ml-1 text-sm font-medium">{unit}</span>}
          </p>
        </div>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", styles.icon)}>
          <Icon className="size-4.5" />
        </span>
      </div>
      {(hint || delta) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-semibold",
                delta.value >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {delta.value >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {delta.value > 0 ? "+" : ""}
              {delta.value}%
            </span>
          )}
          {hint && <span className="text-muted-foreground truncate">{hint}</span>}
          {delta && !hint && <span className="text-muted-foreground truncate">{delta.label}</span>}
        </div>
      )}
    </Card>
  );
}
