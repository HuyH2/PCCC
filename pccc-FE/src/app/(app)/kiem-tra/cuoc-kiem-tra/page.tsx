"use client";

import Link from "next/link";
import { CalendarClock, ClipboardCheck, ClipboardList, FileText, Plus, Send } from "lucide-react";

import { CuocKiemTraForm } from "@/components/forms/cuoc-kiem-tra-form";
import { DataPagination } from "@/components/shared/data-pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar, useDanhSach, type BoLoc } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canBoDiaBan, canBoTheoId, coSoTheoId, cuocKiemTraList, khuVucTheoId } from "@/data/mock";
import { kiemTraTheoTrangThai } from "@/data/thong-ke";
import type { CuocKiemTra } from "@/data/types";
import { daysUntil, deaccent, formatDate } from "@/lib/utils";

const boLoc: BoLoc[] = [
  {
    key: "trangThai",
    label: "Trạng thái",
    options: ["Lên kế hoạch", "Đã thông báo", "Đã dời lịch", "Chờ biên bản", "Hoàn thành"].map((v) => ({ value: v, label: v })),
    width: "w-[180px]",
  },
  {
    key: "loai",
    label: "Loại kiểm tra",
    options: ["Định kỳ", "Đột xuất", "Chuyên đề"].map((v) => ({ value: v, label: v })),
    width: "w-[170px]",
  },
  {
    key: "ketQua",
    label: "Kết quả",
    options: ["Đạt", "Đạt có điều kiện", "Không đạt"].map((v) => ({ value: v, label: v })),
    width: "w-[180px]",
  },
  {
    key: "truongDoan",
    label: "Trưởng đoàn",
    options: canBoDiaBan.map((c) => ({ value: c.id, label: c.hoTen })),
    width: "w-[190px]",
  },
  {
    key: "thoiGian",
    label: "Thời gian",
    options: [
      { value: "sap-toi", label: "Sắp tới (14 ngày)" },
      { value: "da-qua", label: "Đã diễn ra" },
    ],
    width: "w-[180px]",
  },
];

function locKiemTra(k: CuocKiemTra, tuKhoa: string, gt: Record<string, string>) {
  if (tuKhoa) {
    const q = deaccent(tuKhoa);
    const cs = coSoTheoId.get(k.coSoId);
    if (
      !k.ma.toLowerCase().includes(q) &&
      !(cs && deaccent(cs.ten).includes(q)) &&
      !(cs && deaccent(cs.diaChi).includes(q)) &&
      !(k.soBienBan?.toLowerCase().includes(q) ?? false)
    )
      return false;
  }
  if (gt.trangThai && gt.trangThai !== "all" && k.trangThai !== gt.trangThai) return false;
  if (gt.loai && gt.loai !== "all" && k.loai !== gt.loai) return false;
  if (gt.ketQua && gt.ketQua !== "all" && k.ketQua !== gt.ketQua) return false;
  if (gt.truongDoan && gt.truongDoan !== "all" && k.truongDoanId !== gt.truongDoan) return false;
  if (gt.thoiGian === "sap-toi") {
    const con = daysUntil(k.ngayKiemTra);
    if (con < 0 || con > 14) return false;
  }
  if (gt.thoiGian === "da-qua" && daysUntil(k.ngayKiemTra) >= 0) return false;
  return true;
}

export default function TrangCuocKiemTra() {
  const ds = useDanhSach(cuocKiemTraList, locKiemTra);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Hồ sơ cuộc kiểm tra"
        description="Quản lý quyết định thành lập đoàn, thông báo kiểm tra, dời lịch có lý do, checklist, biên bản và kết quả hậu kiểm."
        module="M06"
        useCases={["UC-INS-03", "UC-INS-04", "UC-INS-05", "UC-INS-07", "UC-INS-08"]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/van-ban">
                <ClipboardList />
                Checklist kiểm tra
              </Link>
            </Button>
            <CuocKiemTraForm
              trigger={
                <Button size="sm">
                  <Plus />
                  Tạo cuộc kiểm tra
                </Button>
              }
            />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Đang lên kế hoạch" value={kiemTraTheoTrangThai.lenKeHoach} icon={CalendarClock} />
        <StatCard label="Đã gửi thông báo" value={kiemTraTheoTrangThai.daThongBao} icon={Send} tone="info" />
        <StatCard label="Đã dời lịch" value={kiemTraTheoTrangThai.daDoiLich} icon={CalendarClock} tone="warning" hint="Có lý do và lưu lịch sử (BR-08)" />
        <StatCard label="Chờ biên bản" value={kiemTraTheoTrangThai.choBienBan} icon={FileText} tone="warning" />
        <StatCard label="Đã hoàn thành" value={kiemTraTheoTrangThai.hoanThanh} icon={ClipboardCheck} tone="success" />
      </div>

      <Card className="gap-0 py-0">
        <div className="p-3">
          <FilterBar
            tuKhoa={ds.tuKhoa}
            onTuKhoa={ds.doiTuKhoa}
            giaTri={ds.giaTri}
            onDoiGiaTri={ds.doiGiaTri}
            boLoc={boLoc}
            placeholder="Tìm theo mã cuộc kiểm tra, tên cơ sở, số biên bản…"
          />
        </div>

        {ds.ketQua.length === 0 ? (
          <EmptyState icon={ClipboardCheck} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Cơ sở</TableHead>
                <TableHead>Khu phố</TableHead>
                <TableHead>Ngày kiểm tra</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Trưởng đoàn</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Kết quả</TableHead>
                <TableHead>Biên bản</TableHead>
                <TableHead className="text-center">Tồn tại</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ds.duLieuTrang.map((k) => {
                const cs = coSoTheoId.get(k.coSoId)!;
                const con = daysUntil(k.ngayKiemTra);
                return (
                  <TableRow key={k.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{k.ma}</TableCell>
                    <TableCell className="max-w-[230px]">
                      <Link href={`/co-so/${cs.id}`} className="hover:text-primary font-medium hover:underline">
                        {cs.ten}
                      </Link>
                      <div className="text-muted-foreground truncate text-xs">{cs.diaChi}</div>
                    </TableCell>
                    <TableCell className="text-[13px] whitespace-nowrap">
                      {khuVucTheoId.get(cs.khuVucId)?.ten.replace("Khu phố ", "KP")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-[13px] font-medium">{formatDate(k.ngayKiemTra)}</div>
                      {k.ngayGoc ? (
                        <div className="text-warning-foreground text-xs" title={k.lyDoDoiLich ?? undefined}>
                          dời từ {formatDate(k.ngayGoc)}
                        </div>
                      ) : con >= 0 && con <= 14 ? (
                        <div className="text-muted-foreground text-xs">còn {con} ngày</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={k.loai} />
                    </TableCell>
                    <TableCell className="text-[13px] whitespace-nowrap">
                      {canBoTheoId.get(k.truongDoanId)?.hoTen}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={k.trangThai} />
                    </TableCell>
                    <TableCell>{k.ketQua ? <StatusBadge value={k.ketQua} /> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                    <TableCell className="text-[13px] whitespace-nowrap">{k.soBienBan ?? "—"}</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {k.soTonTai > 0 ? (
                        <span className="text-destructive font-semibold">{k.soTonTai}</span>
                      ) : k.trangThai === "Hoàn thành" ? (
                        <span className="text-success font-semibold">0</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
