"use client";

import Link from "next/link";
import { Mail, Phone, Plus, Upload, UserCog, Users } from "lucide-react";

import { CanBoForm } from "@/components/forms/can-bo-form";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar, useDanhSach, type BoLoc } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canBoList, coSoList, donViList, donViTheoId, khuVucList } from "@/data/mock";
import type { CanBo } from "@/data/types";
import { deaccent } from "@/lib/utils";

const tenVaiTro: Record<string, string> = {
  A01: "Chỉ huy/Đội trưởng",
  A02: "Phó chỉ huy/Tổ trưởng",
  A03: "Cán bộ kiểm tra/Quản lý địa bàn",
  A04: "Cán bộ tổng hợp",
  A05: "Quản trị hệ thống",
  A06: "Lãnh đạo cấp phòng/Người xem",
  A07: "Cấp phường (mở rộng)",
};

const boLoc: BoLoc[] = [
  {
    key: "donVi",
    label: "Đơn vị",
    options: donViList.map((d) => ({ value: d.id, label: d.ten })),
    width: "w-[210px]",
  },
  {
    key: "vaiTro",
    label: "Vai trò",
    options: Object.entries(tenVaiTro).map(([v, l]) => ({ value: v, label: `${v} · ${l}` })),
    width: "w-[230px]",
  },
  {
    key: "trangThai",
    label: "Trạng thái",
    options: [
      { value: "Đang công tác", label: "Đang công tác" },
      { value: "Nghỉ phép", label: "Nghỉ phép" },
      { value: "Chuyển công tác", label: "Chuyển công tác" },
    ],
  },
];

function locCanBo(cb: CanBo, tuKhoa: string, gt: Record<string, string>) {
  if (tuKhoa) {
    const q = deaccent(tuKhoa);
    if (
      !deaccent(cb.hoTen).includes(q) &&
      !cb.ma.toLowerCase().includes(q) &&
      !cb.dienThoai.replace(/\s/g, "").includes(tuKhoa.replace(/\s/g, "")) &&
      !deaccent(cb.chucVu).includes(q)
    )
      return false;
  }
  if (gt.donVi && gt.donVi !== "all" && cb.donViId !== gt.donVi) return false;
  if (gt.vaiTro && gt.vaiTro !== "all" && cb.vaiTro !== gt.vaiTro) return false;
  if (gt.trangThai && gt.trangThai !== "all" && cb.trangThai !== gt.trangThai) return false;
  return true;
}

function chuCaiDau(hoTen: string) {
  const tu = hoTen.trim().split(/\s+/);
  return (tu[tu.length - 2]?.[0] ?? "") + (tu[tu.length - 1]?.[0] ?? "");
}

export default function TrangCanBo() {
  const ds = useDanhSach(canBoList, locCanBo);
  const dangCongTac = canBoList.filter((c) => c.trangThai === "Đang công tác").length;
  const quanLyDiaBan = canBoList.filter((c) => c.vaiTro === "A03").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Danh bạ cán bộ"
        description="Hồ sơ Chỉ huy và Cán bộ quản lý của Đội Khu vực 10. Bảng Master gồm: mã số, họ tên, chức vụ, điện thoại, email, ghi chú — bảng Detail sẽ bổ sung sau khảo sát chi tiết."
        module="M02"
        useCases={["UC-ORG-02"]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/tien-ich/import">
                <Upload />
                Import danh sách
              </Link>
            </Button>
            <CanBoForm
              trigger={
                <Button size="sm">
                  <Plus />
                  Thêm cán bộ
                </Button>
              }
            />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng số cán bộ" value={canBoList.length} icon={Users} />
        <StatCard label="Đang công tác" value={dangCongTac} icon={Users} tone="success" />
        <StatCard label="Quản lý địa bàn (A03)" value={quanLyDiaBan} icon={UserCog} tone="info" hint={`Phụ trách ${khuVucList.length} khu phố`} />
        <StatCard
          label="Cơ sở / cán bộ (TB)"
          value={Math.round(coSoList.length / Math.max(1, quanLyDiaBan))}
          icon={Users}
          tone="warning"
          hint="Số cơ sở bình quân mỗi cán bộ địa bàn"
        />
      </div>

      <Card className="gap-0 py-0">
        <div className="p-3">
          <FilterBar
            tuKhoa={ds.tuKhoa}
            onTuKhoa={ds.doiTuKhoa}
            giaTri={ds.giaTri}
            onDoiGiaTri={ds.doiGiaTri}
            boLoc={boLoc}
            placeholder="Tìm theo họ tên, mã số, chức vụ, số điện thoại…"
          />
        </div>

        {ds.ketQua.length === 0 ? (
          <EmptyState icon={Users} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cán bộ</TableHead>
                <TableHead>Mã số</TableHead>
                <TableHead>Chức vụ</TableHead>
                <TableHead>Đơn vị</TableHead>
                <TableHead>Liên hệ</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Cơ sở phụ trách</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ds.ketQua.map((cb) => {
                const soCoSo = coSoList.filter((c) => c.canBoPhuTrachId === cb.id).length;
                return (
                  <TableRow key={cb.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {chuCaiDau(cb.hoTen)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{cb.hoTen}</div>
                          <div className="text-muted-foreground text-xs">{cb.capBac}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{cb.ma}</TableCell>
                    <TableCell className="text-[13px]">{cb.chucVu}</TableCell>
                    <TableCell className="text-[13px]">{donViTheoId.get(cb.donViId)?.ten}</TableCell>
                    <TableCell>
                      <a
                        href={`tel:${cb.dienThoai.replace(/\s/g, "")}`}
                        className="text-primary flex items-center gap-1.5 text-[13px] hover:underline"
                      >
                        <Phone className="size-3.5" />
                        {cb.dienThoai}
                      </a>
                      <a
                        href={`mailto:${cb.email}`}
                        className="text-muted-foreground hover:text-primary flex items-center gap-1.5 text-xs"
                      >
                        <Mail className="size-3" />
                        {cb.email}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" title={tenVaiTro[cb.vaiTro]}>
                        {cb.vaiTro}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={cb.trangThai} />
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {soCoSo > 0 ? (
                        <Link href={`/co-so?canBo=${cb.id}`} className="hover:text-primary hover:underline">
                          {soCoSo}
                        </Link>
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

        <p className="text-muted-foreground border-t px-3 py-2 text-xs">
          Trên thiết bị hỗ trợ, bấm trực tiếp vào số điện thoại để gọi (UC-ORG-02, luồng chính bước 5).
        </p>
      </Card>
    </div>
  );
}
