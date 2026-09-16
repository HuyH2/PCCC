"use client";

import Link from "next/link";
import { Flame, HeartPulse, LifeBuoy, Plus, Siren, Zap } from "lucide-react";

import { BieuDoSuCo } from "@/components/charts/dashboard-charts";
import { SuCoForm } from "@/components/forms/su-co-form";
import { DataPagination } from "@/components/shared/data-pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar, useDanhSach, type BoLoc } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canBoTheoId, coSoTheoId, donViList, donViTheoId, suCoList } from "@/data/mock";
import { suCoTheoThang, thongKeSuCo } from "@/data/thong-ke";
import type { SuCo } from "@/data/types";
import { daysUntil, deaccent, formatNumber } from "@/lib/utils";

const boLoc: BoLoc[] = [
  {
    key: "loai",
    label: "Loại sự cố",
    options: ["Cháy", "Nổ", "Cứu nạn cứu hộ", "Hỗ trợ y tế", "Sự cố khác"].map((v) => ({ value: v, label: v })),
    width: "w-[180px]",
  },
  {
    key: "phuong",
    label: "Phường",
    options: donViList.filter((d) => d.cap === "Phường").map((d) => ({ value: d.id, label: d.ten })),
  },
  {
    key: "trangThai",
    label: "Trạng thái",
    options: ["Mới tiếp nhận", "Đang xử lý hồ sơ", "Hoàn thành", "Quá hạn"].map((v) => ({ value: v, label: v })),
    width: "w-[180px]",
  },
  {
    key: "thietHai",
    label: "Thiệt hại",
    options: [
      { value: "nguoi", label: "Có thiệt hại về người" },
      { value: "tai-san", label: "Có thiệt hại tài sản" },
    ],
    width: "w-[210px]",
  },
];

function locSuCo(s: SuCo, tuKhoa: string, gt: Record<string, string>) {
  if (tuKhoa) {
    const q = deaccent(tuKhoa);
    if (!s.ma.toLowerCase().includes(q) && !deaccent(s.diaChi).includes(q) && !deaccent(s.nguyenNhan).includes(q))
      return false;
  }
  if (gt.loai && gt.loai !== "all" && s.loai !== gt.loai) return false;
  if (gt.phuong && gt.phuong !== "all" && s.phuongId !== gt.phuong) return false;
  if (gt.trangThai && gt.trangThai !== "all" && s.trangThai !== gt.trangThai) return false;
  if (gt.thietHai === "nguoi" && s.soNguoiChet + s.soNguoiBiThuong === 0) return false;
  if (gt.thietHai === "tai-san" && s.thietHaiTaiSan === 0) return false;
  return true;
}

function dinhDangGio(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export default function TrangSuCo() {
  const ds = useDanhSach(
    [...suCoList].sort((a, b) => b.thoiDiem.localeCompare(a.thoiDiem)),
    locSuCo,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sự cố cháy, nổ và CNCH"
        description="Ghi nhận vụ cháy, nổ, cứu nạn cứu hộ và hỗ trợ y tế trên địa bàn; thống kê thiệt hại về người, tài sản và theo dõi hạn xử lý hồ sơ (BR-11)."
        module="M09"
        useCases={["UC-INC-01", "UC-INC-02", "UC-INC-03", "UC-INC-05", "UC-INC-06"]}
        actions={
          <SuCoForm
            trigger={
              <Button size="sm">
                <Plus />
                Ghi nhận sự cố
              </Button>
            }
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Tổng số vụ" value={thongKeSuCo.tong} icon={Siren} />
        <StatCard label="Cháy / Nổ" value={`${thongKeSuCo.chay} / ${thongKeSuCo.no}`} icon={Flame} tone="danger" />
        <StatCard label="CNCH / Hỗ trợ y tế" value={`${thongKeSuCo.cnch} / ${thongKeSuCo.hoTroYTe}`} icon={LifeBuoy} tone="info" />
        <StatCard
          label="Thiệt hại về người"
          value={`${thongKeSuCo.nguoiChet} / ${thongKeSuCo.nguoiBiThuong}`}
          icon={HeartPulse}
          tone="danger"
          hint="Số người chết / bị thương"
        />
        <StatCard
          label="Thiệt hại tài sản"
          value={formatNumber(thongKeSuCo.thietHai)}
          unit="tr.đ"
          icon={Zap}
          tone="warning"
          hint={`${thongKeSuCo.quaHan} hồ sơ quá hạn xử lý`}
        />
      </div>

      <SectionCard title="Diễn biến sự cố theo tháng" description="R09 — thống kê theo thời gian và loại sự cố">
        <BieuDoSuCo data={suCoTheoThang} />
      </SectionCard>

      <Card className="gap-0 py-0">
        <div className="p-3">
          <FilterBar
            tuKhoa={ds.tuKhoa}
            onTuKhoa={ds.doiTuKhoa}
            giaTri={ds.giaTri}
            onDoiGiaTri={ds.doiGiaTri}
            boLoc={boLoc}
            placeholder="Tìm theo mã vụ việc, địa chỉ, nguyên nhân…"
          />
        </div>

        {ds.ketQua.length === 0 ? (
          <EmptyState icon={Siren} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Thời điểm</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Địa điểm</TableHead>
                <TableHead>Nguyên nhân</TableHead>
                <TableHead className="text-center">Chết/Bị thương</TableHead>
                <TableHead className="text-right">Thiệt hại (tr.đ)</TableHead>
                <TableHead>Cán bộ xử lý</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ds.duLieuTrang.map((s) => {
                const cs = s.coSoId ? coSoTheoId.get(s.coSoId) : null;
                const conHan = daysUntil(s.hanXuLy);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{s.ma}</TableCell>
                    <TableCell className="text-[13px] whitespace-nowrap">{dinhDangGio(s.thoiDiem)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
                        {s.loai === "Cháy" && <Flame className="text-destructive size-3.5" />}
                        {s.loai === "Nổ" && <Zap className="text-destructive size-3.5" />}
                        {s.loai === "Cứu nạn cứu hộ" && <LifeBuoy className="text-info size-3.5" />}
                        {s.loai === "Hỗ trợ y tế" && <HeartPulse className="text-info size-3.5" />}
                        {s.loai}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      <div className="truncate text-[13px]">{s.diaChi}</div>
                      {cs && (
                        <Link href={`/co-so/${cs.id}`} className="text-primary truncate text-xs hover:underline">
                          {cs.ten}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[180px] text-[13px]">{s.nguyenNhan}</TableCell>
                    <TableCell className="text-center whitespace-nowrap tabular-nums">
                      {s.soNguoiChet + s.soNguoiBiThuong === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={s.soNguoiChet > 0 ? "text-destructive font-bold" : "font-semibold"}>
                          {s.soNguoiChet} / {s.soNguoiBiThuong}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.thietHaiTaiSan > 0 ? s.thietHaiTaiSan.toFixed(1) : "—"}
                    </TableCell>
                    <TableCell className="text-[13px] whitespace-nowrap">
                      {canBoTheoId.get(s.canBoXuLyId)?.hoTen}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={s.trangThai} />
                      {s.trangThai !== "Hoàn thành" && conHan < 0 && (
                        <div className="text-destructive mt-0.5 text-xs font-semibold">
                          Quá {Math.abs(conHan)} ngày
                        </div>
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

        <p className="text-muted-foreground border-t px-3 py-2 text-xs">
          Danh mục sự cố và thời hạn xử lý từng loại cần đơn vị xác nhận (Q11).
        </p>
      </Card>
    </div>
  );
}
