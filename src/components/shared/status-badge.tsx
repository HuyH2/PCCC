import * as React from "react";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";

type Variant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/**
 * Bảng quy ước màu trạng thái dùng chung toàn hệ thống.
 * Đỏ = cần xử lý/nghiêm trọng, vàng = sắp tới hạn, xanh = đã xong.
 */
const bangMau: Record<string, Variant> = {
  // Cơ sở
  "Đang hoạt động": "success",
  "Đang đình chỉ": "danger",
  "Tạm ngừng": "warning",
  "Không phép": "danger",
  // Chung
  "Hoạt động": "success",
  "Ngưng hoạt động": "muted",
  "Đang công tác": "success",
  "Nghỉ phép": "warning",
  "Chuyển công tác": "muted",
  Khóa: "danger",
  Ngưng: "muted",
  // Vi phạm
  "Mới ghi nhận": "info",
  "Đang khắc phục": "warning",
  "Chờ duyệt": "info",
  "Đã hoàn thành": "success",
  "Trả lại": "danger",
  Nhẹ: "muted",
  "Trung bình": "warning",
  "Nghiêm trọng": "danger",
  // Kiểm tra
  "Lên kế hoạch": "muted",
  "Đã thông báo": "info",
  "Đã dời lịch": "warning",
  "Chờ biên bản": "warning",
  "Hoàn thành": "success",
  "Đạt": "success",
  "Đạt có điều kiện": "warning",
  "Không đạt": "danger",
  "Định kỳ": "info",
  "Đột xuất": "warning",
  "Chuyên đề": "secondary",
  // Công việc
  "Mới giao": "info",
  "Đang thực hiện": "warning",
  "Quá hạn": "danger",
  "Thường xuyên": "muted",
  "Được giao": "info",
  // Báo cáo
  "Chưa làm": "muted",
  "Đang soạn": "warning",
  "Đã nộp": "success",
  "Nộp trễ": "warning",
  // Sự cố
  "Mới tiếp nhận": "info",
  "Đang xử lý hồ sơ": "warning",
  // Giải trình
  "Chờ giải trình": "warning",
  "Đã phản hồi": "info",
  "Đã chấp nhận": "success",
  "Không chấp nhận": "danger",
  // Điều kiện PCCC / huấn luyện
  "Đã có": "success",
  "Chưa có": "danger",
  "Không áp dụng": "muted",
  "Còn hạn": "success",
  "Sắp hết hạn": "warning",
  "Hết hạn": "danger",
  "Chưa huấn luyện": "danger",
  // Mức độ cảnh báo
  Cao: "danger",
  Thấp: "muted",
};

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  return (
    <Badge variant={bangMau[value] ?? "secondary"} className={className}>
      {value}
    </Badge>
  );
}
