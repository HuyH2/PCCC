import { Flame, ShieldCheck } from "lucide-react";

import { DangNhapForm } from "./dang-nhap-form";

export const metadata = { title: "Đăng nhập" };

export default function TrangDangNhap() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Cột thương hiệu */}
      <div className="bg-sidebar text-sidebar-foreground relative hidden flex-col justify-between p-10 lg:flex">
        <div className="flex items-center gap-3">
          <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-11 items-center justify-center rounded-xl">
            <Flame className="size-6" />
          </span>
          <div>
            <div className="text-lg font-bold tracking-tight">PCCC &amp; CNCH</div>
            <div className="text-sidebar-foreground/70 text-xs">PC07 · Đội Khu vực 10</div>
          </div>
        </div>

        <div className="max-w-md space-y-4">
          <h1 className="text-3xl leading-tight font-bold tracking-tight">
            Hệ thống quản lý công tác phòng cháy, chữa cháy và cứu nạn, cứu hộ
          </h1>
          <p className="text-sidebar-foreground/80 text-sm leading-relaxed">
            Số hóa và tập trung dữ liệu tổ chức — cán bộ — địa bàn — cơ sở — hồ sơ; chuẩn hóa quy trình
            kiểm tra, vi phạm và phê duyệt; theo dõi công việc, KPI, báo cáo và sự cố trên một nguồn dữ
            liệu dùng chung.
          </p>
          <ul className="space-y-2 text-sm">
            {[
              "Tra cứu nhanh theo cán bộ, khu vực hoặc cơ sở",
              "Cảnh báo sớm hạn kiểm tra, báo cáo và chứng nhận",
              "Giữ lịch sử đầy đủ để dễ chuyển giao cán bộ",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sidebar-foreground/60 text-xs">
          URD v1.0 · Bản dự thảo để xem xét — cần người sử dụng xác nhận
        </p>
      </div>

      {/* Cột biểu mẫu */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center lg:hidden">
            <span className="bg-primary text-primary-foreground mx-auto flex size-12 items-center justify-center rounded-xl">
              <Flame className="size-6" />
            </span>
            <h1 className="text-xl font-bold">Hệ thống PCCC &amp; CNCH</h1>
            <p className="text-muted-foreground text-sm">PC07 · Đội Khu vực 10</p>
          </div>

          <DangNhapForm />
        </div>
      </div>
    </div>
  );
}
