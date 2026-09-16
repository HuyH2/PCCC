import { ArrowRightLeft, History, UserCog } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canBoTheoId, coSoList, donViTheoId, khuVucList } from "@/data/mock";
import { coSoTheoCanBo } from "@/data/thong-ke";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata = { title: "Phân công phụ trách" };

export default function TrangPhanCong() {
  const maxCoSo = Math.max(...coSoTheoCanBo.map((c) => c.tong));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Phân công cán bộ phụ trách địa bàn"
        description="Phạm vi phân công được dùng để giới hạn quyền xem và cập nhật dữ liệu. Khi thay đổi phân công, hệ thống giữ nguyên lịch sử của cán bộ cũ (BR-03, UC-ADM-04)."
        module="M02"
        useCases={["UC-ORG-03", "UC-ADM-04"]}
        actions={
          <>
            <Button variant="outline" size="sm">
              <ArrowRightLeft />
              Chuyển giao phạm vi
            </Button>
            <Button size="sm">
              <UserCog />
              Phân công mới
            </Button>
          </>
        }
      />

      <div className="border-success/40 bg-success/8 flex items-start gap-2.5 rounded-xl border p-3 text-[13px]">
        <Badge variant="success" className="shrink-0 font-mono">Q03</Badge>
        <p className="text-muted-foreground">
          <strong className="text-foreground font-semibold">Đã chốt:</strong> mỗi khu phố và mỗi cơ sở có
          đúng một cán bộ phụ trách. Khi cần đổi người, dùng chức năng chuyển giao phạm vi để giữ nguyên
          lịch sử của cán bộ cũ (BR-03).
        </p>
      </div>

      <SectionCard
        title="Khối lượng địa bàn theo cán bộ"
        description="R01 — dùng để cân đối lại phân công khi chênh lệch lớn"
        contentClassName="px-0 pb-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cán bộ</TableHead>
              <TableHead>Khu phố phụ trách</TableHead>
              <TableHead className="w-[200px]">Khối lượng cơ sở</TableHead>
              <TableHead className="text-right">Có vi phạm</TableHead>
              <TableHead className="text-right">Hồ sơ chưa đủ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coSoTheoCanBo.map((r) => {
              const dsKhuPho = khuVucList.filter((k) => k.canBoPhuTrachId === r.canBoId);
              const cb = canBoTheoId.get(r.canBoId)!;
              return (
                <TableRow key={r.canBoId}>
                  <TableCell>
                    <div className="font-medium">{r.hoTen}</div>
                    <div className="text-muted-foreground text-xs">
                      {cb.capBac} · {cb.chucVu}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <div className="flex flex-wrap gap-1">
                      {dsKhuPho.length === 0 ? (
                        <Badge variant="warning">Chưa phân công</Badge>
                      ) : (
                        dsKhuPho.map((k) => (
                          <Badge key={k.id} variant="outline" className="font-normal">
                            {k.ten.replace("Khu phố ", "KP")}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={(r.tong / maxCoSo) * 100} className="h-1.5" />
                      <span className="w-8 shrink-0 text-right text-[13px] font-semibold tabular-nums">
                        {r.tong}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.viPham > 0 ? <span className="text-destructive font-semibold">{r.viPham}</span> : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.hoSoChuaDu}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Chi tiết phân công theo khu phố"
          description="UC-ORG-03 — hệ thống hiển thị số cơ sở trước khi xác nhận phân công"
          contentClassName="px-0 pb-0"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Khu phố</TableHead>
                <TableHead>Phường</TableHead>
                <TableHead>Cán bộ</TableHead>
                <TableHead className="text-right">Cơ sở</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {khuVucList.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{k.ten}</TableCell>
                  <TableCell className="text-[13px]">
                    {donViTheoId.get(k.phuongId)?.ten.replace("Phường ", "")}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {k.canBoPhuTrachId ? canBoTheoId.get(k.canBoPhuTrachId)?.hoTen : "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{k.soCoSo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard
          title="Lịch sử chuyển giao gần đây"
          description="UC-ADM-04 — chuyển người phụ trách hiện tại nhưng giữ nguyên lịch sử dữ liệu"
        >
          <ol className="relative space-y-5 border-l pl-5">
            {[
              { ngay: "2026-08-01", cu: "Hoàng Minh Khôi", moi: "Trịnh Văn Sơn", pv: "KP3, KP4 - Vườn Lài", lyDo: "Cán bộ cũ nghỉ phép dài ngày" },
              { ngay: "2026-05-15", cu: "Ngô Đức Thắng", moi: "Đặng Hoài Nam", pv: "KP2 - Diên Hồng", lyDo: "Cân đối lại khối lượng địa bàn" },
              { ngay: "2026-01-04", cu: "—", moi: "Phạm Thị Hồng Nhung", pv: "KP1, KP2 - Hòa Hưng", lyDo: "Phân công lần đầu khi khởi tạo dữ liệu" },
            ].map((m, i) => (
              <li key={i} className="relative">
                <span className="bg-primary absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-[var(--background)]" />
                <div className="text-muted-foreground text-xs">{formatDate(m.ngay)}</div>
                <div className="text-[13px] font-semibold">
                  {m.cu} <ArrowRightLeft className="mx-1 inline size-3" /> {m.moi}
                </div>
                <p className="text-muted-foreground text-[13px]">
                  Phạm vi: {m.pv} — {m.lyDo}
                </p>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </div>
  );
}
