"use client";

import Link from "next/link";
import { CheckCircle2, FileWarning, Paperclip, Plus, ShieldAlert, ShieldX, Timer } from "lucide-react";

import { ViPhamForm } from "@/components/forms/vi-pham-form";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canBoDiaBan, canBoTheoId, coSoTheoId, viPhamList } from "@/data/mock";
import { thongKeViPham } from "@/data/thong-ke";
import type { ViPham } from "@/data/types";
import { daysUntil, deaccent, formatDate } from "@/lib/utils";

const boLoc: BoLoc[] = [
  {
    key: "trangThai",
    label: "Trạng thái",
    options: ["Mới ghi nhận", "Đang khắc phục", "Chờ duyệt", "Đã hoàn thành", "Trả lại"].map((v) => ({ value: v, label: v })),
  },
  {
    key: "mucDo",
    label: "Mức độ",
    options: ["Nhẹ", "Trung bình", "Nghiêm trọng"].map((v) => ({ value: v, label: v })),
    width: "w-[150px]",
  },
  {
    key: "dinhChi",
    label: "Đình chỉ",
    options: [
      { value: "co", label: "Đang đình chỉ" },
      { value: "khong", label: "Không đình chỉ" },
    ],
    width: "w-[160px]",
  },
  {
    key: "canBo",
    label: "Cán bộ theo dõi",
    options: canBoDiaBan.map((c) => ({ value: c.id, label: c.hoTen })),
    width: "w-[190px]",
  },
  {
    key: "han",
    label: "Hạn khắc phục",
    options: [
      { value: "qua-han", label: "Đã quá hạn" },
      { value: "sap-han", label: "Còn ≤ 15 ngày" },
    ],
    width: "w-[180px]",
  },
];

function locViPham(v: ViPham, tuKhoa: string, gt: Record<string, string>) {
  if (tuKhoa) {
    const q = deaccent(tuKhoa);
    const cs = coSoTheoId.get(v.coSoId);
    if (
      !v.ma.toLowerCase().includes(q) &&
      !deaccent(v.loai).includes(q) &&
      !(cs && deaccent(cs.ten).includes(q)) &&
      !(cs && deaccent(cs.diaChi).includes(q)) &&
      !(v.soQuyetDinh?.toLowerCase().includes(q) ?? false)
    )
      return false;
  }
  if (gt.trangThai && gt.trangThai !== "all" && v.trangThai !== gt.trangThai) return false;
  if (gt.mucDo && gt.mucDo !== "all" && v.mucDo !== gt.mucDo) return false;
  if (gt.dinhChi === "co" && !v.dinhChi) return false;
  if (gt.dinhChi === "khong" && v.dinhChi) return false;
  if (gt.canBo && gt.canBo !== "all" && v.canBoTheoDoiId !== gt.canBo) return false;
  if (gt.han === "qua-han" && !(v.hanKhacPhuc && daysUntil(v.hanKhacPhuc) < 0 && v.trangThai !== "Đã hoàn thành")) return false;
  if (gt.han === "sap-han") {
    if (!v.hanKhacPhuc) return false;
    const con = daysUntil(v.hanKhacPhuc);
    if (con < 0 || con > 15) return false;
  }
  return true;
}

export default function TrangViPham() {
  const ds = useDanhSach(viPhamList, locViPham);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vi phạm - Đình chỉ - Khắc phục"
        description="Theo dõi cơ sở vi phạm, hồ sơ đình chỉ và tiến độ khắc phục. Cơ sở đang đình chỉ chỉ được chuyển sang hoạt động trở lại sau khi đủ hồ sơ và được cấp có thẩm quyền phê duyệt (BR-09)."
        module="M04"
        useCases={["UC-VIO-01", "UC-VIO-02", "UC-VIO-04", "UC-VIO-05"]}
        actions={
          <ViPhamForm
            trigger={
              <Button size="sm">
                <Plus />
                Ghi nhận vi phạm
              </Button>
            }
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng hồ sơ vi phạm" value={thongKeViPham.tong} icon={FileWarning} />
        <StatCard
          label="Đang đình chỉ hoạt động"
          value={thongKeViPham.dangDinhChi}
          icon={ShieldX}
          tone="danger"
        />
        <StatCard
          label="Quá hạn khắc phục"
          value={thongKeViPham.quaHanKhacPhuc}
          icon={Timer}
          tone="danger"
          hint="Cần tham mưu biện pháp xử lý tiếp theo"
        />
        <StatCard
          label="Chờ phê duyệt hoạt động lại"
          value={thongKeViPham.choDuyet}
          icon={CheckCircle2}
          tone="info"
          hint={`${thongKeViPham.hoanThanh} hồ sơ đã hoàn thành`}
        />
      </div>

      <Tabs defaultValue="tat-ca">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="tat-ca" onClick={() => ds.doiGiaTri("trangThai", "all")}>
            Tất cả
          </TabsTrigger>
          <TabsTrigger value="dang-xu-ly" onClick={() => ds.doiGiaTri("trangThai", "Đang khắc phục")}>
            Đang khắc phục
          </TabsTrigger>
          <TabsTrigger value="cho-duyet" onClick={() => ds.doiGiaTri("trangThai", "Chờ duyệt")}>
            Chờ phê duyệt
          </TabsTrigger>
          <TabsTrigger value="hoan-thanh" onClick={() => ds.doiGiaTri("trangThai", "Đã hoàn thành")}>
            Đã hoàn thành
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="gap-0 py-0">
        <div className="p-3">
          <FilterBar
            tuKhoa={ds.tuKhoa}
            onTuKhoa={ds.doiTuKhoa}
            giaTri={ds.giaTri}
            onDoiGiaTri={ds.doiGiaTri}
            boLoc={boLoc}
            placeholder="Tìm theo mã hồ sơ, tên cơ sở, số quyết định…"
          />
        </div>

        {ds.ketQua.length === 0 ? (
          <EmptyState icon={ShieldAlert} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã hồ sơ</TableHead>
                <TableHead>Cơ sở</TableHead>
                <TableHead>Loại vi phạm</TableHead>
                <TableHead>Mức độ</TableHead>
                <TableHead>Quyết định</TableHead>
                <TableHead>Hạn khắc phục</TableHead>
                <TableHead className="w-[130px]">Tiến độ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Cán bộ</TableHead>
                <TableHead className="text-center">TL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ds.duLieuTrang.map((v) => {
                const cs = coSoTheoId.get(v.coSoId)!;
                const con = v.hanKhacPhuc ? daysUntil(v.hanKhacPhuc) : null;
                const quaHan = con !== null && con < 0 && v.trangThai !== "Đã hoàn thành";
                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {v.ma}
                      {v.dinhChi && (
                        <Badge variant="danger" className="ml-1.5">
                          Đình chỉ
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <Link href={`/co-so/${cs.id}`} className="hover:text-primary font-medium hover:underline">
                        {cs.ten}
                      </Link>
                      <div className="text-muted-foreground truncate text-xs">{cs.diaChi}</div>
                    </TableCell>
                    <TableCell className="max-w-[190px] text-[13px]">{v.loai}</TableCell>
                    <TableCell>
                      <StatusBadge value={v.mucDo} />
                    </TableCell>
                    <TableCell className="text-[13px] whitespace-nowrap">{v.soQuyetDinh ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {v.hanKhacPhuc ? (
                        <>
                          <div className="text-[13px]">{formatDate(v.hanKhacPhuc)}</div>
                          <div className="text-xs">
                            {quaHan ? (
                              <span className="text-destructive font-semibold">Quá hạn {Math.abs(con!)} ngày</span>
                            ) : con! <= 15 ? (
                              <span className="text-warning-foreground font-semibold">Còn {con} ngày</span>
                            ) : (
                              <span className="text-muted-foreground">Còn {con} ngày</span>
                            )}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={v.tienDoKhacPhuc}
                          className="h-1.5"
                          indicatorClassName={quaHan ? "bg-destructive" : v.tienDoKhacPhuc === 100 ? "bg-success" : "bg-warning"}
                        />
                        <span className="w-8 shrink-0 text-right text-xs tabular-nums">{v.tienDoKhacPhuc}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={v.trangThai} />
                    </TableCell>
                    <TableCell className="text-[13px] whitespace-nowrap">
                      {canBoTheoId.get(v.canBoTheoDoiId)?.hoTen}
                    </TableCell>
                    <TableCell className="text-center">
                      {v.soTaiLieu > 0 ? (
                        <Badge variant="secondary" className="gap-1">
                          <Paperclip className="size-3" />
                          {v.soTaiLieu}
                        </Badge>
                      ) : (
                        <span className="text-destructive text-xs" title="Thiếu tài liệu chứng minh (BR-02)">
                          0
                        </span>
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
          BR-02: hồ sơ không có tài liệu chứng minh thì không cho chuyển sang trạng thái hoàn thành.
          Danh mục vi phạm/đình chỉ và điều kiện hoạt động lại cần đơn vị xác nhận (Q07).
        </p>
      </Card>
    </div>
  );
}
