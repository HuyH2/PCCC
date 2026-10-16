import Link from "next/link";
import { Map, MapPin, Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canBoTheoId, coSoList, donViList, khuVucList } from "@/data/mock";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "Khu vực - Khu phố" };

export default function TrangKhuVuc() {
  const phuongList = donViList.filter((d) => d.cap === "Phường");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Khu vực - Khu phố"
        description="Danh mục khu phố thuộc 3 phường Hòa Hưng, Diên Hồng và Vườn Lài — phạm vi nhập liệu ban đầu của Đội Khu vực 10."
        module="M02"
        useCases={["UC-ORG-03"]}
        actions={
          <Button size="sm">
            <Plus />
            Thêm khu phố
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Số phường" value={phuongList.length} icon={MapPin} />
        <StatCard label="Số khu phố" value={khuVucList.length} icon={Map} tone="info" />
        <StatCard
          label="Cơ sở bình quân / khu phố"
          value={Math.round(coSoList.length / khuVucList.length)}
          icon={Map}
          tone="warning"
        />
      </div>

      {phuongList.map((p) => {
        const dsKhuPho = khuVucList.filter((k) => k.phuongId === p.id);
        const tongCoSo = dsKhuPho.reduce((s, k) => s + k.soCoSo, 0);
        return (
          <SectionCard
            key={p.id}
            title={p.ten}
            description={`${dsKhuPho.length} khu phố · ${formatNumber(tongCoSo)} cơ sở trong phạm vi mẫu`}
            contentClassName="px-0 pb-0"
            action={<Badge variant="outline" className="font-mono">{p.ma}</Badge>}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Mã khu phố</TableHead>
                  <TableHead>Tên khu phố</TableHead>
                  <TableHead>Cán bộ phụ trách</TableHead>
                  <TableHead className="text-right">Số cơ sở</TableHead>
                  <TableHead className="text-right">Cơ sở có vi phạm</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {dsKhuPho.map((k) => {
                  const cb = k.canBoPhuTrachId ? canBoTheoId.get(k.canBoPhuTrachId) : null;
                  const viPham = coSoList.filter((c) => c.khuVucId === k.id && c.coViPham).length;
                  return (
                    <TableRow key={k.id}>
                      <TableCell className="font-mono text-xs">{k.ma}</TableCell>
                      <TableCell className="font-medium">{k.ten}</TableCell>
                      <TableCell className="text-[13px]">
                        {cb ? (
                          <>
                            {cb.hoTen}
                            <span className="text-muted-foreground"> · {cb.capBac}</span>
                          </>
                        ) : (
                          <Badge variant="warning">Chưa phân công</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{k.soCoSo}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {viPham > 0 ? <span className="text-destructive font-semibold">{viPham}</span> : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/co-so?khuPho=${k.id}`}>Xem cơ sở</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </SectionCard>
        );
      })}
    </div>
  );
}
