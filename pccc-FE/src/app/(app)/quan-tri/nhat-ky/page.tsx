"use client";

import { ArrowRight, Download, History, ShieldCheck } from "lucide-react";

import { DataPagination } from "@/components/shared/data-pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar, useDanhSach, type BoLoc } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canBoList, canBoTheoId, nhatKyList } from "@/data/mock";
import type { NhatKy } from "@/data/types";
import { deaccent } from "@/lib/utils";

const hanhDongList = Array.from(new Set(nhatKyList.map((n) => n.hanhDong))).sort();

const boLoc: BoLoc[] = [
  {
    key: "nguoiDung",
    label: "Người dùng",
    options: canBoList.map((c) => ({ value: c.id, label: c.hoTen })),
    width: "w-[200px]",
  },
  {
    key: "hanhDong",
    label: "Hành động",
    options: hanhDongList.map((h) => ({ value: h, label: h })),
    width: "w-[235px]",
  },
];

function locNhatKy(n: NhatKy, tuKhoa: string, gt: Record<string, string>) {
  if (tuKhoa) {
    const q = deaccent(tuKhoa);
    const cb = canBoTheoId.get(n.nguoiDungId);
    if (
      !deaccent(n.hanhDong).includes(q) &&
      !deaccent(n.doiTuong).includes(q) &&
      !n.diaChiIp.includes(tuKhoa) &&
      !(cb && deaccent(cb.hoTen).includes(q))
    )
      return false;
  }
  if (gt.nguoiDung && gt.nguoiDung !== "all" && n.nguoiDungId !== gt.nguoiDung) return false;
  if (gt.hanhDong && gt.hanhDong !== "all" && n.hanhDong !== gt.hanhDong) return false;
  return true;
}

function dinhDangGio(iso: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(new Date(iso));
}

export default function TrangNhatKy() {
  const ds = useDanhSach(
    [...nhatKyList].sort((a, b) => b.thoiDiem.localeCompare(a.thoiDiem)),
    locNhatKy,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nhật ký thao tác"
        description="Ghi log đăng nhập và các thao tác quan trọng kèm trạng thái trước/sau. Người dùng thường không được sửa hoặc xóa nhật ký (NFR-03, BR-03)."
        module="M01"
        useCases={["UC-SYS-05"]}
        actions={
          <Button variant="outline" size="sm">
            <Download />
            Kết xuất nhật ký
          </Button>
        }
      />

      <Card className="gap-0 py-0">
        <div className="p-3">
          <FilterBar
            tuKhoa={ds.tuKhoa}
            onTuKhoa={ds.doiTuKhoa}
            giaTri={ds.giaTri}
            onDoiGiaTri={ds.doiGiaTri}
            boLoc={boLoc}
            placeholder="Tìm theo người dùng, hành động, đối tượng, địa chỉ IP…"
          />
        </div>

        {ds.ketQua.length === 0 ? (
          <EmptyState icon={History} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời điểm</TableHead>
                <TableHead>Người thực hiện</TableHead>
                <TableHead>Hành động</TableHead>
                <TableHead>Đối tượng</TableHead>
                <TableHead>Chuyển trạng thái</TableHead>
                <TableHead>Địa chỉ IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ds.duLieuTrang.map((n) => {
                const cb = canBoTheoId.get(n.nguoiDungId)!;
                return (
                  <TableRow key={n.id}>
                    <TableCell className="text-[13px] whitespace-nowrap tabular-nums">
                      {dinhDangGio(n.thoiDiem)}
                    </TableCell>
                    <TableCell>
                      <div className="text-[13px] font-medium">{cb.hoTen}</div>
                      <div className="text-muted-foreground text-xs">{cb.ma}</div>
                    </TableCell>
                    <TableCell className="text-[13px]">{n.hanhDong}</TableCell>
                    <TableCell className="font-mono text-xs">{n.doiTuong}</TableCell>
                    <TableCell className="text-[13px] whitespace-nowrap">
                      {n.truocDo && n.sauDo ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-muted-foreground">{n.truocDo}</span>
                          <ArrowRight className="size-3" />
                          <span className="font-medium">{n.sauDo}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{n.diaChiIp}</TableCell>
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

        <p className="text-muted-foreground flex items-center gap-1.5 border-t px-3 py-2 text-xs">
          <ShieldCheck className="size-3.5" />
          Nhật ký được lưu bất biến; chính sách thời gian lưu trữ và sao lưu theo hạ tầng chính thức (NFR-09).
        </p>
      </Card>
    </div>
  );
}
