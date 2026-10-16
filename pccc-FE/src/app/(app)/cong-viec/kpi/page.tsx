import { AlertTriangle, Gauge, Target, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canBoDiaBan, canBoTheoId, congViecList, cuocKiemTraList, keHoachKiemTraList } from "@/data/mock";
import { thongKeCongViec, thongKeGiaiTrinh, tongHopKeHoach } from "@/data/thong-ke";

export const metadata = { title: "KPI & nợ chỉ tiêu" };

export default function TrangKPI() {
  const bangKPI = canBoDiaBan.map((cb) => {
    const kh = keHoachKiemTraList.find((k) => k.canBoId === cb.id)!;
    const cv = congViecList.filter((c) => c.nguoiThucHienId === cb.id);
    const hoanThanh = cv.filter((c) => c.trangThai === "Hoàn thành").length;
    const quaHan = cv.filter((c) => c.trangThai === "Quá hạn").length;
    const kt = cuocKiemTraList.filter((k) => k.truongDoanId === cb.id);
    const tyLeKiemTra = Math.round((kh.daThucHien / kh.chiTieuNam) * 100);
    const tyLeCongViec = cv.length === 0 ? 100 : Math.round((hoanThanh / cv.length) * 100);
    // KPI tổng hợp: 60% tiến độ kiểm tra + 40% tỷ lệ hoàn thành công việc, trừ điểm việc quá hạn
    const kpi = Math.max(0, Math.min(100, Math.round(tyLeKiemTra * 0.6 + tyLeCongViec * 0.4 - quaHan * 3)));
    return { cb, kh, soCongViec: cv.length, hoanThanh, quaHan, soKiemTra: kt.length, tyLeKiemTra, tyLeCongViec, kpi };
  }).sort((a, b) => b.kpi - a.kpi);

  const kpiTrungBinh = Math.round(bangKPI.reduce((s, r) => s + r.kpi, 0) / bangKPI.length);

  return (
    <div className="space-y-5">
      <PageHeader
        title="KPI & nợ chỉ tiêu"
        description="Theo dõi kết quả thực hiện chỉ tiêu kiểm tra và công việc được giao. Phần thiếu chuyển thành nợ và tiếp tục hiển thị ở kỳ sau đến khi được xử lý hoặc điều chỉnh (BR-05)."
        module="M07"
        useCases={["UC-WRK-04"]}
      />

      <div className="border-warning/40 bg-warning/8 flex items-start gap-2.5 rounded-xl border p-3 text-[13px]">
        <Badge variant="warning" className="shrink-0 font-mono">Q09</Badge>
        <p className="text-muted-foreground">
          <strong className="text-foreground font-semibold">Cần xác nhận:</strong> công thức KPI/OKR chính
          thức, cách tính nợ chỉ tiêu và quy tắc chấp nhận giải trình. Bản demo tạm tính KPI = 60% tiến độ
          kiểm tra + 40% tỷ lệ hoàn thành công việc, trừ 3 điểm cho mỗi việc quá hạn.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="KPI trung bình đội" value={`${kpiTrungBinh}%`} icon={Gauge} tone={kpiTrungBinh >= 75 ? "success" : "warning"} />
        <StatCard label="Nợ chỉ tiêu kiểm tra" value={tongHopKeHoach.noChiTieu} unit="lượt" icon={Target} tone="danger" />
        <StatCard label="Công việc quá hạn" value={thongKeCongViec.quaHan} icon={AlertTriangle} tone="danger" />
        <StatCard
          label="Giải trình chờ phản hồi"
          value={thongKeGiaiTrinh.choPhanHoi}
          icon={TrendingUp}
          tone="warning"
          hint={`${thongKeGiaiTrinh.tong} yêu cầu đã phát hành`}
        />
      </div>

      <SectionCard
        title="Bảng KPI theo cán bộ"
        description="R06 — giao việc, thường xuyên, đột xuất, hoàn thành, quá hạn"
        contentClassName="px-0 pb-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] text-center">#</TableHead>
              <TableHead>Cán bộ</TableHead>
              <TableHead className="text-right">Kiểm tra</TableHead>
              <TableHead className="w-[150px]">Tiến độ chỉ tiêu</TableHead>
              <TableHead className="text-right">Nợ</TableHead>
              <TableHead className="text-right">Công việc</TableHead>
              <TableHead className="text-right">Hoàn thành</TableHead>
              <TableHead className="text-right">Quá hạn</TableHead>
              <TableHead className="w-[160px]">KPI tổng hợp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bangKPI.map((r, i) => (
              <TableRow key={r.cb.id}>
                <TableCell className="text-muted-foreground text-center text-xs tabular-nums">{i + 1}</TableCell>
                <TableCell>
                  <div className="font-medium">{r.cb.hoTen}</div>
                  <div className="text-muted-foreground text-xs">{r.cb.capBac} · {r.cb.chucVu}</div>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {r.kh.daThucHien}
                  <span className="text-muted-foreground">/{r.kh.chiTieuNam}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={r.tyLeKiemTra}
                      className="h-1.5"
                      indicatorClassName={r.tyLeKiemTra >= 75 ? "bg-success" : r.tyLeKiemTra >= 55 ? "bg-warning" : "bg-destructive"}
                    />
                    <span className="w-9 shrink-0 text-right text-xs tabular-nums">{r.tyLeKiemTra}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {r.kh.noChiTieu > 0 ? (
                    <span className="text-destructive font-semibold tabular-nums">{r.kh.noChiTieu}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.soCongViec}</TableCell>
                <TableCell className="text-success text-right font-semibold tabular-nums">{r.hoanThanh}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.quaHan > 0 ? <span className="text-destructive font-semibold">{r.quaHan}</span> : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={r.kpi}
                      className="h-2"
                      indicatorClassName={r.kpi >= 80 ? "bg-success" : r.kpi >= 60 ? "bg-warning" : "bg-destructive"}
                    />
                    <span className="w-10 shrink-0 text-right text-[13px] font-bold tabular-nums">{r.kpi}%</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
