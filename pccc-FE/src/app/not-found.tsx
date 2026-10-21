import Link from "next/link";
import { FileQuestion, Home, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * 404 cho các đường dẫn không khớp route nào.
 *
 * Không dựng khung sidebar vì người truy cập có thể chưa đăng nhập.
 * Trường hợp notFound() được gọi từ trong ứng dụng (ví dụ mã cơ sở không tồn tại)
 * sẽ dùng bản có khung ở "(app)/not-found.tsx".
 */
export default function KhongTimThay() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full">
        <FileQuestion className="size-7" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Không tìm thấy nội dung</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          Đường dẫn bạn truy cập không tồn tại hoặc đã bị thay đổi. Nếu bạn vừa đăng xuất, hãy đăng nhập
          lại để tiếp tục sử dụng hệ thống.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" asChild>
          <Link href="/dang-nhap">
            <LogIn />
            Đăng nhập
          </Link>
        </Button>
        <Button asChild>
          <Link href="/">
            <Home />
            Về trang tổng quan
          </Link>
        </Button>
      </div>
    </main>
  );
}
