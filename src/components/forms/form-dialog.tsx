"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Khung hộp thoại dùng chung cho các biểu mẫu thêm/sửa nhanh.
 * Phần thân cuộn được để biểu mẫu dài vẫn dùng tốt trên điện thoại.
 */
export function FormDialog({
  trigger,
  title,
  description,
  children,
  onSubmit,
  dangLuu,
  nhanLuu = "Lưu",
  open,
  onOpenChange,
  className,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  dangLuu?: boolean;
  nhanLuu?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={cn("max-h-[90svh] gap-0 overflow-hidden p-0 sm:max-w-2xl", className)}>
        <form onSubmit={onSubmit} className="flex max-h-[90svh] flex-col">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

          <DialogFooter className="border-t px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange?.(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={dangLuu}>
              {dangLuu && <Loader2 className="animate-spin" />}
              {dangLuu ? "Đang lưu…" : nhanLuu}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Hook gom trạng thái mở/đóng + đang lưu cho hộp thoại biểu mẫu. */
export function useFormDialog() {
  const [open, setOpen] = React.useState(false);
  const [dangLuu, setDangLuu] = React.useState(false);

  /** Mô phỏng lưu về server: bản demo chưa có API. */
  const luu = React.useCallback((viec: () => void) => {
    setDangLuu(true);
    setTimeout(() => {
      setDangLuu(false);
      setOpen(false);
      viec();
    }, 450);
  }, []);

  return { open, setOpen, dangLuu, luu };
}
