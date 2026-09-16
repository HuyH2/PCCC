"use client";

import { Download, ExternalLink, Plus, Scale, ScrollText } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar, useDanhSach, type BoLoc } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { vanBanList } from "@/data/mock";
import type { VanBanPhapLuat } from "@/data/types";
import { deaccent, formatDate } from "@/lib/utils";

const coQuanList = Array.from(new Set(vanBanList.map((v) => v.coQuanBanHanh)));

const boLoc: BoLoc[] = [
  {
    key: "loai",
    label: "Loại văn bản",
    options: ["Luật", "Nghị định", "Thông tư", "Quy chuẩn/Tiêu chuẩn", "Công văn chỉ đạo", "Hướng dẫn nghiệp vụ"].map((v) => ({ value: v, label: v })),
    width: "w-[205px]",
  },
  {
    key: "coQuan",
    label: "Cơ quan ban hành",
    options: coQuanList.map((v) => ({ value: v, label: v })),
    width: "w-[215px]",
  },
  {
    key: "hieuLuc",
    label: "Hiệu lực",
    options: [
      { value: "con", label: "Còn hiệu lực" },
      { value: "het", label: "Hết hiệu lực" },
    ],
    width: "w-[170px]",
  },
];

function locVanBan(v: VanBanPhapLuat, tuKhoa: string, gt: Record<string, string>) {
  if (tuKhoa) {
    const q = deaccent(tuKhoa);
    if (!deaccent(v.trichYeu).includes(q) && !v.soKyHieu.toLowerCase().includes(q) && !deaccent(v.coQuanBanHanh).includes(q))
      return false;
  }
  if (gt.loai && gt.loai !== "all" && v.loai !== gt.loai) return false;
  if (gt.coQuan && gt.coQuan !== "all" && v.coQuanBanHanh !== gt.coQuan) return false;
  if (gt.hieuLuc === "con" && !v.conHieuLuc) return false;
  if (gt.hieuLuc === "het" && v.conHieuLuc) return false;
  return true;
}

export default function TrangVanBan() {
  const ds = useDanhSach(vanBanList, locVanBan);
  const conHieuLuc = vanBanList.filter((v) => v.conHieuLuc).length;
  const quyChuan = vanBanList.filter((v) => v.loai === "Quy chuẩn/Tiêu chuẩn").length;
  const huongDan = vanBanList.filter((v) => v.loai === "Hướng dẫn nghiệp vụ" || v.loai === "Công văn chỉ đạo").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kho văn bản pháp luật & quy chuẩn"
        description="Tra cứu luật, nghị định, thông tư, quy chuẩn kỹ thuật, công văn chỉ đạo và hướng dẫn nghiệp vụ dùng làm căn cứ khi kiểm tra và xử lý vi phạm."
        module="M05"
        useCases={["UC-DOC-01", "UC-DOC-02", "UC-INS-06"]}
        actions={
          <Button size="sm">
            <Plus />
            Thêm văn bản
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng số văn bản" value={vanBanList.length} icon={Scale} />
        <StatCard label="Còn hiệu lực" value={conHieuLuc} icon={ScrollText} tone="success" />
        <StatCard label="Quy chuẩn / Tiêu chuẩn" value={quyChuan} icon={ScrollText} tone="info" />
        <StatCard label="Chỉ đạo & hướng dẫn" value={huongDan} icon={ScrollText} tone="warning" />
      </div>

      <Card className="gap-0 py-0">
        <div className="p-3">
          <FilterBar
            tuKhoa={ds.tuKhoa}
            onTuKhoa={ds.doiTuKhoa}
            giaTri={ds.giaTri}
            onDoiGiaTri={ds.doiGiaTri}
            boLoc={boLoc}
            placeholder="Tìm theo trích yếu, số/ký hiệu, cơ quan ban hành…"
          />
        </div>

        {ds.ketQua.length === 0 ? (
          <EmptyState icon={Scale} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Số/Ký hiệu</TableHead>
                <TableHead>Trích yếu</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Cơ quan ban hành</TableHead>
                <TableHead>Ngày ban hành</TableHead>
                <TableHead>Ngày hiệu lực</TableHead>
                <TableHead>Hiệu lực</TableHead>
                <TableHead className="w-[90px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ds.ketQua.map((v) => (
                <TableRow key={v.id} className={v.conHieuLuc ? "" : "opacity-60"}>
                  <TableCell className="font-mono text-xs whitespace-nowrap">{v.soKyHieu}</TableCell>
                  <TableCell className="max-w-[360px] font-medium">{v.trichYeu}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{v.loai}</Badge>
                  </TableCell>
                  <TableCell className="text-[13px] whitespace-nowrap">{v.coQuanBanHanh}</TableCell>
                  <TableCell className="text-[13px] whitespace-nowrap">{formatDate(v.ngayBanHanh)}</TableCell>
                  <TableCell className="text-[13px] whitespace-nowrap">{formatDate(v.ngayHieuLuc)}</TableCell>
                  <TableCell>
                    {v.conHieuLuc ? (
                      <Badge variant="success">Còn hiệu lực</Badge>
                    ) : (
                      <Badge variant="muted">Hết hiệu lực</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon-sm" aria-label="Tải văn bản">
                        <Download className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Mở văn bản">
                        <ExternalLink className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <p className="text-muted-foreground border-t px-3 py-2 text-xs">
          Checklist, biểu mẫu và quy chuẩn cụ thể theo từng loại hình cơ sở sẽ do đơn vị cung cấp để chi
          tiết hóa (URD mục 14, Q05).
        </p>
      </Card>
    </div>
  );
}
