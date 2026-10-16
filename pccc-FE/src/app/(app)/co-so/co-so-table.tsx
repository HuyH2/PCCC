"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, Eye, FileSpreadsheet, Plus, Upload } from "lucide-react";

import { DataPagination } from "@/components/shared/data-pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar, useDanhSach, type BoLoc } from "@/components/shared/filter-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canBoDiaBan, canBoTheoId, coSoList, donViList, khuVucList, khuVucTheoId } from "@/data/mock";
import type { CoSo } from "@/data/types";
import { deaccent, formatDate, formatNumber } from "@/lib/utils";

const loaiHinhOptions = Array.from(new Set(coSoList.map((c) => c.loaiHinh))).sort();

const boLoc: BoLoc[] = [
  {
    key: "phuong",
    label: "Phường",
    options: donViList.filter((d) => d.cap === "Phường").map((d) => ({ value: d.id, label: d.ten })),
  },
  {
    key: "khuPho",
    label: "Khu phố",
    options: khuVucList.map((k) => ({ value: k.id, label: k.ten })),
    width: "w-[190px]",
  },
  {
    key: "canBo",
    label: "Cán bộ",
    options: canBoDiaBan.map((c) => ({ value: c.id, label: c.hoTen })),
  },
  {
    key: "loaiHinh",
    label: "Loại hình",
    options: loaiHinhOptions.map((l) => ({ value: l, label: l })),
    width: "w-[200px]",
  },
  {
    key: "trangThai",
    label: "Trạng thái",
    options: [
      { value: "Đang hoạt động", label: "Đang hoạt động" },
      { value: "Đang đình chỉ", label: "Đang đình chỉ" },
      { value: "Tạm ngừng", label: "Tạm ngừng" },
      { value: "Không phép", label: "Không phép" },
    ],
  },
  {
    key: "hoSo",
    label: "Hồ sơ",
    options: [
      { value: "du", label: "Đầy đủ (≥90%)" },
      { value: "thieu", label: "Chưa đủ (<70%)" },
    ],
  },
];

function locCoSo(cs: CoSo, tuKhoa: string, gt: Record<string, string>) {
  if (tuKhoa) {
    const q = deaccent(tuKhoa);
    const khop =
      deaccent(cs.ten).includes(q) ||
      deaccent(cs.diaChi).includes(q) ||
      cs.ma.toLowerCase().includes(q) ||
      deaccent(cs.nguoiDungDau).includes(q);
    if (!khop) return false;
  }
  if (gt.phuong && gt.phuong !== "all" && cs.phuongId !== gt.phuong) return false;
  if (gt.khuPho && gt.khuPho !== "all" && cs.khuVucId !== gt.khuPho) return false;
  if (gt.canBo && gt.canBo !== "all" && cs.canBoPhuTrachId !== gt.canBo) return false;
  if (gt.loaiHinh && gt.loaiHinh !== "all" && cs.loaiHinh !== gt.loaiHinh) return false;
  if (gt.trangThai && gt.trangThai !== "all" && cs.trangThai !== gt.trangThai) return false;
  if (gt.hoSo === "du" && cs.mucDoHoanThienHoSo < 90) return false;
  if (gt.hoSo === "thieu" && cs.mucDoHoanThienHoSo >= 70) return false;
  return true;
}

export function CoSoTable() {
  const ds = useDanhSach(coSoList, locCoSo);

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-col gap-3 p-3">
        <FilterBar
          tuKhoa={ds.tuKhoa}
          onTuKhoa={ds.doiTuKhoa}
          giaTri={ds.giaTri}
          onDoiGiaTri={ds.doiGiaTri}
          boLoc={boLoc}
          placeholder="Tìm theo tên cơ sở, địa chỉ, mã, người đứng đầu…"
        >
          <Button variant="outline" size="sm" asChild>
            <Link href="/tien-ich/import">
              <Upload />
              <span className="hidden sm:inline">Import Excel</span>
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/tien-ich/export">
              <FileSpreadsheet />
              <span className="hidden sm:inline">Kết xuất</span>
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/co-so/them">
              <Plus />
              <span className="hidden sm:inline">Thêm cơ sở</span>
            </Link>
          </Button>
        </FilterBar>
      </div>

      {ds.ketQua.length === 0 ? (
        <EmptyState icon={Building2} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[52px] text-center">STT</TableHead>
              <TableHead>Cơ sở</TableHead>
              <TableHead>Loại hình</TableHead>
              <TableHead>Khu phố</TableHead>
              <TableHead>Cán bộ phụ trách</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="w-[140px]">Hồ sơ</TableHead>
              <TableHead className="whitespace-nowrap">Kiểm tra gần nhất</TableHead>
              <TableHead className="w-[56px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ds.duLieuTrang.map((cs, i) => (
              <TableRow key={cs.id}>
                <TableCell className="text-muted-foreground text-center text-xs tabular-nums">
                  {(ds.trang - 1) * ds.soDong + i + 1}
                </TableCell>
                <TableCell className="max-w-[260px]">
                  <Link href={`/co-so/${cs.id}`} className="hover:text-primary font-medium hover:underline">
                    {cs.ten}
                  </Link>
                  <div className="text-muted-foreground truncate text-xs">{cs.diaChi}</div>
                </TableCell>
                <TableCell className="text-[13px]">{cs.loaiHinh}</TableCell>
                <TableCell className="text-[13px] whitespace-nowrap">
                  {khuVucTheoId.get(cs.khuVucId)?.ten}
                </TableCell>
                <TableCell className="text-[13px] whitespace-nowrap">
                  {canBoTheoId.get(cs.canBoPhuTrachId)?.hoTen ?? "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge value={cs.trangThai} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={cs.mucDoHoanThienHoSo}
                      className="h-1.5"
                      indicatorClassName={
                        cs.mucDoHoanThienHoSo >= 90
                          ? "bg-success"
                          : cs.mucDoHoanThienHoSo >= 70
                            ? "bg-warning"
                            : "bg-destructive"
                      }
                    />
                    <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums">
                      {cs.mucDoHoanThienHoSo}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-[13px] whitespace-nowrap">
                  {cs.ngayKiemTraGanNhat ? formatDate(cs.ngayKiemTraGanNhat) : "—"}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-sm" asChild>
                    <Link href={`/co-so/${cs.id}`} aria-label={`Xem chi tiết ${cs.ten}`}>
                      <Eye className="size-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
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
        Tổng {formatNumber(coSoList.length)} cơ sở mẫu trên địa bàn Kv10 (3 phường Hòa Hưng, Diên Hồng,
        Vườn Lài). Quy mô thật khoảng 2.000 cơ sở theo giả định NFR-06.
      </p>
    </Card>
  );
}
