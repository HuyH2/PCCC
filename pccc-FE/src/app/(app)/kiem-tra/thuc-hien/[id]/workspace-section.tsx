"use client";
import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Shared frame for every block of the inspection workspace: header (title, state line, icon
 * action), body (dimmed while locked) and footer (actions aligned right: secondary, then primary).
 */
export function WorkspaceSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="gap-4 pb-5">
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction className="flex gap-1">{action}</CardAction>}
      </CardHeader>
      {children}
    </Card>
  );
}

export function SectionBody({
  locked = false,
  className,
  ...props
}: ComponentProps<"div"> & { locked?: boolean }) {
  return (
    <CardContent
      className={cn("space-y-4 pb-0 transition-opacity", locked && "opacity-60", className)}
      {...props}
    />
  );
}

export function SectionFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <CardFooter
      className={cn("flex-wrap justify-end gap-2 border-t pt-4 pb-0", className)}
      {...props}
    />
  );
}

export function SectionError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  );
}

export function SectionNotice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-lg border bg-muted/50 px-3 py-2 text-sm">
      {children}
    </p>
  );
}

/** Icon-only header action with an accessible name and a tooltip. */
export function IconAction({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
