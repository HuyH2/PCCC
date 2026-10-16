import { CalendarClock, ClipboardCheck, Flame, Plus, Siren } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canBoTheoId, congViecList, coSoTheoId, cuocKiemTraList, NGAY_HE_THONG } from "@/data/mock";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Lịch công tác" };

const tenThu = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

function ngayISO(offset: number) {
  const d = new Date(NGAY_HE_THONG);
  d.setDate(d.getDate() + offset);
  return { iso: d.toISOString().slice(0, 10), thu: tenThu[d.getDay()], la: d };
}

export default function TrangLichCongTac() {
  const ngay7 = Array.from({ length: 7 }, (_, i) => ngayISO(i));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lịch công tác hàng ngày"
        description="Tổng hợp lịch kiểm tra và công việc đến hạn của Đội Khu vực 10 trong 7 ngày tới, giúp chỉ huy nắm nhanh khối lượng công tác từng ngày."
        module="M07"
        useCases={["UC-WRK-01"]}
        actions={
          <Button size="sm">
            <Plus />
            Thêm lịch công tác
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {ngay7.map((n, idx) => {
          const kiemTra = cuocKiemTraList.filter((k) => k.ngayKiemTra === n.iso);
          const congViec = congViecList.filter((c) => c.hanHoanThanh === n.iso);
          const tong = kiemTra.length + congViec.length;
          return (
            <SectionCard
              key={n.iso}
              className={idx === 0 ? "border-primary/40 ring-primary/10 ring-2" : undefined}
              title={idx === 0 ? `Hôm nay · ${n.thu}` : n.thu}
              description={formatDate(n.iso)}
              action={
                <Badge variant={tong === 0 ? "muted" : tong > 4 ? "danger" : "secondary"}>
                  {tong} việc
                </Badge>
              }
              contentClassName="space-y-2"
            >
              {tong === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-[13px]">Không có lịch</p>
              ) : (
                <>
                  {kiemTra.slice(0, 4).map((k) => {
                    const cs = coSoTheoId.get(k.coSoId)!;
                    return (
                      <div key={k.id} className="border-l-primary bg-accent/40 rounded-r-md border-l-2 px-2.5 py-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                          <ClipboardCheck className="text-primary size-3" />
                          Kiểm tra {k.loai.toLowerCase()}
                        </div>
                        <div className="truncate text-[13px] font-medium">{cs.ten}</div>
                        <div className="text-muted-foreground truncate text-xs">
                          {canBoTheoId.get(k.truongDoanId)?.hoTen}
                        </div>
                      </div>
                    );
                  })}
                  {congViec.slice(0, 3).map((c) => (
                    <div key={c.id} className="border-l-warning bg-warning/8 rounded-r-md border-l-2 px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                        <CalendarClock className="text-warning-foreground size-3" />
                        Hạn công việc
                      </div>
                      <div className="truncate text-[13px] font-medium">{c.tieuDe}</div>
                      <div className="text-muted-foreground truncate text-xs">
                        {canBoTheoId.get(c.nguoiThucHienId)?.hoTen}
                      </div>
                    </div>
                  ))}
                  {tong > 7 && (
                    <p className="text-muted-foreground pt-1 text-center text-xs">+{tong - 7} việc khác</p>
                  )}
                </>
              )}
            </SectionCard>
          );
        })}
      </div>

      <SectionCard
        title="Ghi chú vận hành"
        description="Nội dung được xác định trong URD, cần chốt khi triển khai thật"
      >
        <ul className="text-muted-foreground space-y-2 text-[13px]">
          <li className="flex gap-2">
            <Siren className="text-primary mt-0.5 size-4 shrink-0" />
            Cảnh báo và chuông nhắc việc do phần mềm lập trình; push notification cần đánh giá riêng
            (URD mục 10).
          </li>
          <li className="flex gap-2">
            <Flame className="text-primary mt-0.5 size-4 shrink-0" />
            Số ngày báo trước của từng loại hạn được cấu hình theo BR-07 và nhắc đến khi công việc hoàn
            thành hoặc được đóng.
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}
