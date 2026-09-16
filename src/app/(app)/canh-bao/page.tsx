import Link from "next/link";
import {
  AlertTriangle, ArrowRight, BellRing, CalendarClock, CheckCheck, FileSpreadsheet,
  ShieldAlert, Siren, Settings2,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canhBaoList } from "@/data/mock";
import type { LoaiCanhBao } from "@/data/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Cảnh báo & nhắc việc" };

const iconTheoLoai: Record<LoaiCanhBao, typeof BellRing> = {
  "Hạn kiểm tra": CalendarClock,
  "Hạn báo cáo": FileSpreadsheet,
  "Chứng nhận hết hạn": AlertTriangle,
  "Vi phạm quá hạn khắc phục": ShieldAlert,
  "Công việc quá hạn": CalendarClock,
  "Sự cố cần xử lý": Siren,
};

/** Cấu hình số ngày báo trước theo BR-07 */
const cauHinhNhac = [
  { loai: "Hạn kiểm tra", truoc: 7, doiTuong: "Cán bộ phụ trách, Tổ trưởng" },
  { loai: "Hạn báo cáo", truoc: 5, doiTuong: "Cán bộ tổng hợp, Chỉ huy" },
  { loai: "Chứng nhận hết hạn", truoc: 30, doiTuong: "Cán bộ phụ trách địa bàn" },
  { loai: "Vi phạm quá hạn khắc phục", truoc: 3, doiTuong: "Cán bộ theo dõi, Chỉ huy" },
  { loai: "Công việc quá hạn", truoc: 2, doiTuong: "Người thực hiện, Người giao việc" },
  { loai: "Sự cố cần xử lý", truoc: 3, doiTuong: "Cán bộ xử lý hồ sơ" },
];

export default function TrangCanhBao() {
  const chuaDoc = canhBaoList.filter((c) => !c.daDoc);
  const mucCao = canhBaoList.filter((c) => c.mucDo === "Cao").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cảnh báo & nhắc việc"
        description="Chuông nhắc việc do hệ thống tự sinh dựa trên hạn kiểm tra, hạn báo cáo, thời hạn chứng nhận, vi phạm và sự cố. Cảnh báo tiếp tục nhắc đến khi công việc hoàn thành hoặc được đóng (BR-07)."
        module="M10"
        useCases={["UC-SYS-03"]}
        actions={
          <>
            <Button variant="outline" size="sm">
              <CheckCheck />
              Đánh dấu đã đọc
            </Button>
            <Button size="sm">
              <Settings2 />
              Cấu hình nhắc việc
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Cảnh báo chưa đọc" value={chuaDoc.length} icon={BellRing} tone="danger" />
        <StatCard label="Mức độ cao" value={mucCao} icon={AlertTriangle} tone="danger" />
        <StatCard label="Tổng cảnh báo đang mở" value={canhBaoList.length} icon={BellRing} />
      </div>

      <div className="space-y-2.5">
        {canhBaoList.map((cb) => {
          const Icon = iconTheoLoai[cb.loai];
          return (
            <Link key={cb.id} href={cb.duongDan}>
              <Card
                className={cn(
                  "hover:border-primary/50 flex-row items-start gap-3 p-3.5 transition-colors",
                  !cb.daDoc && "border-primary/30 bg-primary/[0.03]",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    cb.mucDo === "Cao"
                      ? "bg-destructive/12 text-destructive"
                      : cb.mucDo === "Trung bình"
                        ? "bg-warning/18 text-warning-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{cb.tieuDe}</span>
                    {!cb.daDoc && <Badge variant="default">Mới</Badge>}
                    <Badge variant="outline">{cb.loai}</Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-[13px]">{cb.moTa}</p>
                </div>
                <ArrowRight className="text-muted-foreground mt-2 size-4 shrink-0" />
              </Card>
            </Link>
          );
        })}
      </div>

      <SectionCard
        title="Cấu hình số ngày báo trước"
        description="BR-07 — mỗi loại hạn có ngưỡng cảnh báo riêng và đối tượng nhận thông báo"
        contentClassName="px-0 pb-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loại cảnh báo</TableHead>
              <TableHead className="text-right">Báo trước (ngày)</TableHead>
              <TableHead>Đối tượng nhận</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cauHinhNhac.map((c) => (
              <TableRow key={c.loai}>
                <TableCell className="font-medium">{c.loai}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{c.truoc}</TableCell>
                <TableCell className="text-muted-foreground text-[13px]">{c.doiTuong}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-muted-foreground border-t px-3 py-2 text-xs">
          Chuông/cảnh báo do phần mềm lập trình; tên miền chỉ là điểm truy cập. Push notification trên
          điện thoại cần đánh giá riêng (URD mục 10).
        </p>
      </SectionCard>
    </div>
  );
}
