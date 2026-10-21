"use client";
import { Button } from "@/components/ui/button";
export default function DocumentError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="space-y-3 p-5">
      <p>Không thể tải dữ liệu văn bản. Vui lòng kiểm tra kết nối và thử lại.</p>
      <Button onClick={reset}>Thử lại</Button>
    </div>
  );
}
