import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function KhongTimThay() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full">
        <FileQuestion className="size-7" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Không tìm thấy nội dung</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          Trang hoặc bản ghi bạn truy cập không tồn tại, đã bị xóa, hoặc nằm ngoài phạm vi dữ liệu được
          phân quyền cho tài khoản của bạn.
        </p>
      </div>
      <Button asChild>
        <Link href="/">
          <Home />
          Về trang tổng quan
        </Link>
      </Button>
    </div>
  );
}
