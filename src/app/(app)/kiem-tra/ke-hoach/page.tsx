import { AlertTriangle, CalendarRange, Plus, Target, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canBoTheoId, keHoachKiemTraList, khuVucList } from "@/data/mock";
import { tongHopKeHoach } from "@/data/thong-ke";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "Kế hoạch & chỉ tiêu kiểm tra" };

export default function TrangKeHoach() {
  const tyLe = Math.round((tongHopKeHoach.daThucHien / tongHopKeHoach.chiTieuNam) * 100);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kế hoạch kiểm tra & chỉ tiêu năm 2026"
        description="Chỉ tiêu kiểm tra là mức tối thiểu; kiểm tra đột xuất có thể làm số thực hiện cao hơn chỉ tiêu (BR-04). Phần còn thiếu chuyển thành nợ và tiếp tục hiển thị ở kỳ sau (BR-05)."
        module="M06"
        useCases={["UC-INS-01", "UC-INS-02"]}
        actions={
          <>
            <Button variant="outline" size="sm">
              <CalendarRange />
              Phân bổ theo tuần
            </Button>
            <Button size="sm">
              <Plus />
              Lập kế hoạch năm
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Chỉ tiêu năm" value={tongHopKeHoach.chiTieuNam} unit="lượt" icon={Target} />
        <StatCard
          label="Đã thực hiện"
          value={tongHopKeHoach.daThucHien}
          unit="lượt"
          icon={TrendingUp}
          tone={tyLe >= 75 ? "success" : "warning"}
          hint={`Đạt ${tyLe}% chỉ tiêu năm`}
        />
        <StatCard
          label="Kiểm tra đột xuất"
          value={tongHopKeHoach.dotXuat}
          unit="lượt"
          icon={AlertTriangle}
          tone="info"
          hint="Ngoài chỉ tiêu tối thiểu (BR-04)"
        />
        <StatCard
          label="Nợ chỉ tiêu lũy kế"
          value={tongHopKeHoach.noChiTieu}
          unit="lượt"
          icon={AlertTriangle}
          tone="danger"
          hint="Chuyển sang kỳ sau đến khi xử lý (BR-05)"
        />
      </div>

      <SectionCard
        title="Chỉ tiêu và kết quả theo cán bộ"
        description="R04 — chỉ tiêu, thực hiện và nợ chỉ tiêu của từng cán bộ quản lý địa bàn"
        contentClassName="px-0 pb-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cán bộ</TableHead>
              <TableHead>Khu phố</TableHead>
              <TableHead className="text-right">Chỉ tiêu năm</TableHead>
              <TableHead className="text-right">Đã thực hiện</TableHead>
              <TableHead className="text-right">Đột xuất</TableHead>
              <TableHead className="w-[170px]">Tiến độ năm</TableHead>
              <TableHead className="text-right">Tháng 9</TableHead>
              <TableHead className="text-right">Nợ chỉ tiêu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keHoachKiemTraList.map((kh) => {
              const cb = canBoTheoId.get(kh.canBoId)!;
              const soKhuPho = khuVucList.filter((k) => k.canBoPhuTrachId === kh.canBoId).length;
              const pct = Math.round((kh.daThucHien / kh.chiTieuNam) * 100);
              return (
                <TableRow key={kh.id}>
                  <TableCell>
                    <div className="font-medium">{cb.hoTen}</div>
                    <div className="text-muted-foreground text-xs">{cb.capBac}</div>
                  </TableCell>
                  <TableCell className="tabular-nums">{soKhuPho}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(kh.chiTieuNam)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatNumber(kh.daThucHien)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{kh.dotXuat}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={pct}
                        className="h-1.5"
                        indicatorClassName={pct >= 75 ? "bg-success" : pct >= 55 ? "bg-warning" : "bg-destructive"}
                      />
                      <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums">{pct}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    <span className={kh.thucHienThang >= kh.chiTieuThang ? "text-success font-semibold" : ""}>
                      {kh.thucHienThang}
                    </span>
                    <span className="text-muted-foreground">/{kh.chiTieuThang}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {kh.noChiTieu > 0 ? (
                      <Badge variant="danger">{kh.noChiTieu}</Badge>
                    ) : (
                      <Badge variant="success">Không nợ</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-semibold">
                Tổng cộng Kv10
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatNumber(tongHopKeHoach.chiTieuNam)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatNumber(tongHopKeHoach.daThucHien)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{tongHopKeHoach.dotXuat}</TableCell>
              <TableCell className="text-[13px] font-semibold">{tyLe}% chỉ tiêu năm</TableCell>
              <TableCell />
              <TableCell className="text-right font-semibold tabular-nums">{tongHopKeHoach.noChiTieu}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </SectionCard>

      <SectionCard title="Điểm cần xác nhận" description="URD mục 15 — liên quan tới kế hoạch và KPI">
        <ul className="space-y-2.5 text-[13px]">
          {[
            { ma: "Q08", nd: "Quy trình kiểm tra định kỳ/đột xuất, chu kỳ theo loại hình, hồ sơ bắt buộc và thẩm quyền phê duyệt." },
            { ma: "Q09", nd: "Công thức tính KPI/OKR, cách tính nợ chỉ tiêu và quy tắc chấp nhận giải trình." },
          ].map((q) => (
            <li key={q.ma} className="flex gap-2.5">
              <Badge variant="warning" className="shrink-0 font-mono">
                {q.ma}
              </Badge>
              <span className="text-muted-foreground">{q.nd}</span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
