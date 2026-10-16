"use client";

import { CheckCircle2, ClipboardList, MessageSquare, Plus, Timer } from "lucide-react";

import { CongViecForm } from "@/components/forms/cong-viec-form";
import { DataPagination } from "@/components/shared/data-pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar, useDanhSach, type BoLoc } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canBoDiaBan, canBoTheoId, congViecList } from "@/data/mock";
import { thongKeCongViec } from "@/data/thong-ke";
import type { CongViec } from "@/data/types";
import { daysUntil, deaccent, formatDate } from "@/lib/utils";

const boLoc: BoLoc[] = [
  {
    key: "trangThai",
    label: "Trạng thái",
    options: ["Mới giao", "Đang thực hiện", "Chờ duyệt", "Hoàn thành", "Quá hạn"].map((v) => ({ value: v, label: v })),
    width: "w-[175px]",
  },
  {
    key: "loai",
    label: "Loại công việc",
    options: ["Thường xuyên", "Đột xuất", "Được giao"].map((v) => ({ value: v, label: v })),
    width: "w-[180px]",
  },
  {
    key: "nguoiThucHien",
    label: "Người thực hiện",
    options: canBoDiaBan.map((c) => ({ value: c.id, label: c.hoTen })),
    width: "w-[195px]",
  },
  {
    key: "giaiTrinh",
    label: "Giải trình",
    options: [{ value: "co", label: "Đã yêu cầu giải trình" }],
    width: "w-[200px]",
  },
];

function locCongViec(cv: CongViec, tuKhoa: string, gt: Record<string, string>) {
  if (tuKhoa) {
    const q = deaccent(tuKhoa);
    if (!deaccent(cv.tieuDe).includes(q) && !cv.ma.toLowerCase().includes(q)) return false;
  }
  if (gt.trangThai && gt.trangThai !== "all" && cv.trangThai !== gt.trangThai) return false;
  if (gt.loai && gt.loai !== "all" && cv.loai !== gt.loai) return false;
  if (gt.nguoiThucHien && gt.nguoiThucHien !== "all" && cv.nguoiThucHienId !== gt.nguoiThucHien) return false;
  if (gt.giaiTrinh === "co" && !cv.canGiaiTrinh) return false;
  return true;
}

export default function TrangGiaoViec() {
  const ds = useDanhSach(congViecList, locCongViec);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Giao việc & theo dõi tiến độ"
        description="Chỉ huy giao việc thường xuyên/đột xuất cho cán bộ, theo dõi tiến độ và yêu cầu giải trình khi chậm hạn (BR-06)."
        module="M07"
        useCases={["UC-WRK-02", "UC-WRK-03", "UC-WRK-06"]}
        actions={
          <CongViecForm
            trigger={
              <Button size="sm">
                <Plus />
                Giao việc mới
              </Button>
            }
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng công việc" value={thongKeCongViec.tong} icon={ClipboardList} />
        <StatCard label="Đang thực hiện" value={thongKeCongViec.dangThucHien} icon={Timer} tone="info" />
        <StatCard label="Hoàn thành" value={thongKeCongViec.hoanThanh} icon={CheckCircle2} tone="success" hint={`${thongKeCongViec.choDuyet} chờ duyệt`} />
        <StatCard label="Quá hạn" value={thongKeCongViec.quaHan} icon={Timer} tone="danger" />
      </div>

      <Card className="gap-0 py-0">
        <div className="p-3">
          <FilterBar
            tuKhoa={ds.tuKhoa}
            onTuKhoa={ds.doiTuKhoa}
            giaTri={ds.giaTri}
            onDoiGiaTri={ds.doiGiaTri}
            boLoc={boLoc}
            placeholder="Tìm theo mã hoặc tiêu đề công việc…"
          />
        </div>

        {ds.ketQua.length === 0 ? (
          <EmptyState icon={ClipboardList} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Công việc</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Người giao</TableHead>
                <TableHead>Người thực hiện</TableHead>
                <TableHead>Hạn hoàn thành</TableHead>
                <TableHead className="w-[130px]">Tiến độ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ds.duLieuTrang.map((cv) => {
                const con = daysUntil(cv.hanHoanThanh);
                const quaHan = cv.trangThai === "Quá hạn";
                return (
                  <TableRow key={cv.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{cv.ma}</TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="font-medium">{cv.tieuDe}</div>
                      {cv.canGiaiTrinh && (
                        <Badge variant="danger" className="mt-1">
                          Đã yêu cầu giải trình
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={cv.loai} />
                    </TableCell>
                    <TableCell className="text-[13px] whitespace-nowrap">
                      {canBoTheoId.get(cv.nguoiGiaoId)?.hoTen}
                    </TableCell>
                    <TableCell className="text-[13px] whitespace-nowrap">
                      {canBoTheoId.get(cv.nguoiThucHienId)?.hoTen}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-[13px]">{formatDate(cv.hanHoanThanh)}</div>
                      <div className="text-xs">
                        {quaHan ? (
                          <span className="text-destructive font-semibold">Quá {Math.abs(con)} ngày</span>
                        ) : con >= 0 && con <= 5 ? (
                          <span className="text-warning-foreground font-semibold">Còn {con} ngày</span>
                        ) : (
                          <span className="text-muted-foreground">
                            Giao {formatDate(cv.ngayGiao)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={cv.tienDo}
                          className="h-1.5"
                          indicatorClassName={quaHan ? "bg-destructive" : cv.tienDo === 100 ? "bg-success" : "bg-warning"}
                        />
                        <span className="w-8 shrink-0 text-right text-xs tabular-nums">{cv.tienDo}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={cv.trangThai} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" aria-label="Trao đổi theo công việc">
                        <MessageSquare className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <DataPagination
          tong={ds.ketQua.length}
          trang={ds.trang}
          soDong={ds.soDong}
          onDoiTrang={ds.setTrang}
          onDoiSoDong={ds.setSoDong}
        />
      </Card>
    </div>
  );
}
