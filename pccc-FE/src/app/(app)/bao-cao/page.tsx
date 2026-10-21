"use client";

import { AlertCircle, CheckCircle2, Clock, FileSpreadsheet, Plus, Upload } from "lucide-react";

import { BaoCaoForm } from "@/components/forms/bao-cao-form";
import { DataPagination } from "@/components/shared/data-pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar, useDanhSach, type BoLoc } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { baoCaoList, canBoTheoId } from "@/data/mock";
import { thongKeBaoCao } from "@/data/thong-ke";
import type { BaoCao } from "@/data/types";
import { daysUntil, deaccent, formatDate } from "@/lib/utils";

const noiNhanList = Array.from(new Set(baoCaoList.map((b) => b.noiNhan)));

const boLoc: BoLoc[] = [
  {
    key: "trangThai",
    label: "Trạng thái",
    options: ["Chưa làm", "Đang soạn", "Đã nộp", "Nộp trễ", "Quá hạn"].map((v) => ({ value: v, label: v })),
    width: "w-[170px]",
  },
  {
    key: "chuKy",
    label: "Chu kỳ",
    options: ["Tuần", "Tháng", "Quý", "Năm", "Đột xuất"].map((v) => ({ value: v, label: v })),
    width: "w-[155px]",
  },
  {
    key: "noiNhan",
    label: "Nơi nhận",
    options: noiNhanList.map((v) => ({ value: v, label: v })),
    width: "w-[230px]",
  },
  {
    key: "han",
    label: "Hạn nộp",
    options: [
      { value: "sap-han", label: "Sắp đến hạn" },
      { value: "qua-han", label: "Đã quá hạn" },
    ],
    width: "w-[165px]",
  },
];

function locBaoCao(b: BaoCao, tuKhoa: string, gt: Record<string, string>) {
  if (tuKhoa) {
    const q = deaccent(tuKhoa);
    if (
      !deaccent(b.ten).includes(q) &&
      !b.ma.toLowerCase().includes(q) &&
      !deaccent(b.noiNhan).includes(q) &&
      !(b.soVanBanYeuCau?.toLowerCase().includes(q) ?? false)
    )
      return false;
  }
  if (gt.trangThai && gt.trangThai !== "all" && b.trangThai !== gt.trangThai) return false;
  if (gt.chuKy && gt.chuKy !== "all" && b.chuKy !== gt.chuKy) return false;
  if (gt.noiNhan && gt.noiNhan !== "all" && b.noiNhan !== gt.noiNhan) return false;
  if (gt.han === "sap-han") {
    const con = daysUntil(b.hanNop);
    if (b.ngayNop !== null || con < 0 || con > b.soNgayCanhBao) return false;
  }
  if (gt.han === "qua-han" && b.trangThai !== "Quá hạn") return false;
  return true;
}

export default function TrangBaoCao() {
  const ds = useDanhSach(baoCaoList, locBaoCao);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Báo cáo & deadline"
        description="Quản lý danh mục chế độ báo cáo, văn bản đến, nơi nhận, biểu mẫu và cảnh báo hạn nộp. Số ngày báo trước được cấu hình cho từng báo cáo theo BR-07."
        module="M08"
        useCases={["UC-RPT-01", "UC-RPT-02", "UC-RPT-03", "UC-RPT-04"]}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Upload />
              Tiếp nhận văn bản đến
            </Button>
            <BaoCaoForm
              trigger={
                <Button size="sm">
                  <Plus />
                  Thêm báo cáo
                </Button>
              }
            />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng đầu việc báo cáo" value={thongKeBaoCao.tong} icon={FileSpreadsheet} />
        <StatCard label="Sắp đến hạn" value={thongKeBaoCao.sapHan} icon={Clock} tone="warning" hint="Trong ngưỡng cảnh báo cấu hình" />
        <StatCard label="Quá hạn chưa nộp" value={thongKeBaoCao.quaHan} icon={AlertCircle} tone="danger" />
        <StatCard label="Đã nộp" value={thongKeBaoCao.daNop} icon={CheckCircle2} tone="success" hint={`${thongKeBaoCao.nopTre} báo cáo nộp trễ`} />
      </div>

      <Card className="gap-0 py-0">
        <div className="p-3">
          <FilterBar
            tuKhoa={ds.tuKhoa}
            onTuKhoa={ds.doiTuKhoa}
            giaTri={ds.giaTri}
            onDoiGiaTri={ds.doiGiaTri}
            boLoc={boLoc}
            placeholder="Tìm theo tên báo cáo, mã, nơi nhận, số văn bản yêu cầu…"
          />
        </div>

        {ds.ketQua.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Tên báo cáo</TableHead>
                <TableHead>Chu kỳ</TableHead>
                <TableHead>Nơi nhận</TableHead>
                <TableHead>Văn bản yêu cầu</TableHead>
                <TableHead>Hạn nộp</TableHead>
                <TableHead>Người phụ trách</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-center">Biểu mẫu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ds.duLieuTrang.map((b) => {
                const con = daysUntil(b.hanNop);
                const trongNguong = b.ngayNop === null && con >= 0 && con <= b.soNgayCanhBao;
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{b.ma}</TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="font-medium">{b.ten}</div>
                      {b.ngayNop && (
                        <div className="text-muted-foreground text-xs">Đã nộp {formatDate(b.ngayNop)}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{b.chuKy}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[190px] text-[13px]">{b.noiNhan}</TableCell>
                    <TableCell className="text-[13px] whitespace-nowrap">{b.soVanBanYeuCau ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-[13px]">{formatDate(b.hanNop)}</div>
                      <div className="text-xs">
                        {b.ngayNop ? (
                          <span className="text-muted-foreground">Đã nộp</span>
                        ) : con < 0 ? (
                          <span className="text-destructive font-semibold">Quá {Math.abs(con)} ngày</span>
                        ) : trongNguong ? (
                          <span className="text-warning-foreground font-semibold">Còn {con} ngày</span>
                        ) : (
                          <span className="text-muted-foreground">Còn {con} ngày</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-[13px] whitespace-nowrap">
                      {canBoTheoId.get(b.nguoiPhuTrachId)?.hoTen}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={b.trangThai} />
                    </TableCell>
                    <TableCell className="text-center">
                      {b.coBieuMau ? (
                        <Badge variant="secondary">Có</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
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
          Danh mục báo cáo, nơi nhận, chu kỳ, deadline, mẫu và số ngày cảnh báo cần được đơn vị cung cấp
          để chốt cấu hình (Q10).
        </p>
      </Card>
    </div>
  );
}
