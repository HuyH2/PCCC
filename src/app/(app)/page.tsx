import Link from "next/link";
import {
  AlertTriangle, ArrowRight, Building2, CalendarClock, ClipboardCheck,
  FileSpreadsheet, Flame, ShieldAlert, Target, Users,
} from "lucide-react";

import { BieuDoLoaiHinh, BieuDoSuCo, BieuDoTheoPhuong, BieuDoTienDoKiemTra } from "@/components/charts/dashboard-charts";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canhBaoList, coSoTheoId, khuVucTheoId } from "@/data/mock";
import {
  baoCaoSapHan, chatLuongHoSo, coSoCanChuY, coSoTheoCanBo, coSoTheoLoaiHinh,
  coSoTheoPhuong, coSoTheoTrangThai, congViecQuaHan, kiemTraSapToi,
  kiemTraTheoTrangThai, suCoTheoThang, tenCanBo, thongKeBaoCao, thongKeCongViec,
  thongKeGiaiTrinh, thongKeSuCo, thongKeViPham, tienDoKiemTraTheoThang,
  tongCoSo, tongHopKeHoach,
} from "@/data/thong-ke";
import { daysUntil, formatDate, formatNumber } from "@/lib/utils";

export const metadata = { title: "Tổng quan điều hành" };

function MoTaHan({ iso }: { iso: string }) {
  const con = daysUntil(iso);
  if (con < 0)
    return <span className="text-destructive font-semibold">Quá hạn {Math.abs(con)} ngày</span>;
  if (con === 0) return <span className="text-destructive font-semibold">Đến hạn hôm nay</span>;
  if (con <= 3) return <span className="text-warning-foreground font-semibold">Còn {con} ngày</span>;
  return <span className="text-muted-foreground">Còn {con} ngày</span>;
}

export default function TrangTongQuan() {
  const tyLeThucHien = Math.round((tongHopKeHoach.daThucHien / tongHopKeHoach.chiTieuNam) * 100);
  const canhBaoUuTien = canhBaoList.filter((c) => c.mucDo === "Cao");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tổng quan điều hành"
        description="Bức tranh chung về địa bàn, tiến độ kiểm tra, vi phạm, công việc và sự cố của Đội Khu vực 10. Số liệu tổng hợp từ một nguồn dùng chung theo quy tắc BR-01."
        module="M10"
        useCases={["UC-SYS-02"]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/tien-ich/export">
                <FileSpreadsheet />
                Kết xuất số liệu
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/canh-bao">
                <AlertTriangle />
                Cảnh báo ({canhBaoUuTien.length})
              </Link>
            </Button>
          </>
        }
      />

      {/* Dải cảnh báo ưu tiên cao */}
      {canhBaoUuTien.length > 0 && (
        <div className="border-destructive/25 bg-destructive/5 flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:gap-4">
          <span className="text-destructive flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4 shrink-0" />
            Cần xử lý ngay
          </span>
          <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
            {canhBaoUuTien.map((c) => (
              <li key={c.id} className="min-w-0">
                <Link href={c.duongDan} className="hover:text-primary truncate text-[13px] underline-offset-4 hover:underline">
                  {c.tieuDe}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* R01, R03, R04, R09 — chỉ số chính */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tổng số cơ sở quản lý"
          value={tongCoSo}
          icon={Building2}
          hint={`${formatNumber(coSoTheoTrangThai.dangHoatDong)} đang hoạt động`}
          delta={{ value: 3, label: "so với kỳ trước" }}
        />
        <StatCard
          label="Cơ sở vi phạm / đình chỉ"
          value={coSoTheoTrangThai.dangDinhChi + coSoTheoTrangThai.khongPhep}
          icon={ShieldAlert}
          tone="danger"
          hint={`${thongKeViPham.quaHanKhacPhuc} hồ sơ quá hạn khắc phục`}
        />
        <StatCard
          label="Tiến độ kiểm tra năm 2026"
          value={`${tyLeThucHien}%`}
          icon={Target}
          tone={tyLeThucHien >= 75 ? "success" : "warning"}
          hint={`${formatNumber(tongHopKeHoach.daThucHien)}/${formatNumber(tongHopKeHoach.chiTieuNam)} lượt · nợ ${tongHopKeHoach.noChiTieu}`}
        />
        <StatCard
          label="Sự cố đã ghi nhận"
          value={thongKeSuCo.tong}
          icon={Flame}
          tone="warning"
          hint={`${thongKeSuCo.chay} cháy · ${thongKeSuCo.cnch} CNCH · thiệt hại ${formatNumber(thongKeSuCo.thietHai)} triệu`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Công việc quá hạn"
          value={thongKeCongViec.quaHan}
          icon={CalendarClock}
          tone="danger"
          hint={`${thongKeGiaiTrinh.choPhanHoi} yêu cầu giải trình chờ phản hồi`}
        />
        <StatCard
          label="Báo cáo sắp đến hạn"
          value={thongKeBaoCao.sapHan}
          icon={FileSpreadsheet}
          tone="warning"
          hint={`${thongKeBaoCao.quaHan} quá hạn · ${thongKeBaoCao.nopTre} nộp trễ`}
        />
        <StatCard
          label="Kiểm tra chờ biên bản"
          value={kiemTraTheoTrangThai.choBienBan}
          icon={ClipboardCheck}
          tone="info"
          hint={`${kiemTraTheoTrangThai.daThongBao} đã thông báo · ${kiemTraTheoTrangThai.daDoiLich} đã dời lịch`}
        />
        <StatCard
          label="Mức hoàn thiện hồ sơ TB"
          value={`${chatLuongHoSo.trungBinh}%`}
          icon={Users}
          tone={chatLuongHoSo.trungBinh >= 80 ? "success" : "warning"}
          hint={`${chatLuongHoSo.thieu} cơ sở thiếu hồ sơ dưới 70%`}
        />
      </div>

      {/* Biểu đồ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Tình hình sự cố 9 tháng gần nhất"
          description="R09 — thống kê theo thời gian và loại sự cố"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/su-co">
                Chi tiết <ArrowRight />
              </Link>
            </Button>
          }
        >
          <BieuDoSuCo data={suCoTheoThang} />
        </SectionCard>

        <SectionCard
          title="Chỉ tiêu và kết quả kiểm tra"
          description="R04 — chỉ tiêu tối thiểu so với lượt kiểm tra đã thực hiện"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/kiem-tra/ke-hoach">
                Chi tiết <ArrowRight />
              </Link>
            </Button>
          }
        >
          <BieuDoTienDoKiemTra data={tienDoKiemTraTheoThang} />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Cơ sở theo loại hình" description="R01 — cơ cấu địa bàn Kv10">
          <BieuDoLoaiHinh data={coSoTheoLoaiHinh} />
        </SectionCard>
        <SectionCard title="Cơ sở theo phường" description="R01 — phân bố và tình trạng theo địa bàn">
          <BieuDoTheoPhuong data={coSoTheoPhuong} />
        </SectionCard>
      </div>

      {/* R01 — theo cán bộ */}
      <SectionCard
        title="Địa bàn theo cán bộ phụ trách"
        description="R01 — số cơ sở, khu phố và hồ sơ chưa đầy đủ của từng cán bộ quản lý địa bàn"
        contentClassName="px-0 pb-0"
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/to-chuc/phan-cong">
              Phân công <ArrowRight />
            </Link>
          </Button>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cán bộ</TableHead>
              <TableHead className="text-right">Khu phố</TableHead>
              <TableHead className="text-right">Cơ sở</TableHead>
              <TableHead className="text-right">Có vi phạm</TableHead>
              <TableHead className="w-[180px]">Hồ sơ chưa đầy đủ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coSoTheoCanBo.map((r) => {
              const tyLeThieu = Math.round((r.hoSoChuaDu / Math.max(1, r.tong)) * 100);
              return (
                <TableRow key={r.canBoId}>
                  <TableCell>
                    <div className="font-medium">{r.hoTen}</div>
                    <div className="text-muted-foreground text-xs">{r.capBac}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.soKhuPho}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatNumber(r.tong)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.viPham > 0 ? (
                      <span className="text-destructive font-semibold">{r.viPham}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={tyLeThieu}
                        className="h-1.5"
                        indicatorClassName={tyLeThieu > 40 ? "bg-destructive" : "bg-warning"}
                      />
                      <span className="text-muted-foreground w-12 shrink-0 text-right text-xs tabular-nums">
                        {r.hoSoChuaDu}/{r.tong}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* R05 — Kiểm tra sắp tới */}
        <SectionCard
          title="Kiểm tra dự kiến trong 14 ngày"
          description="R05 — lịch kiểm tra sắp tới và trạng thái thông báo"
          contentClassName="px-0 pb-0"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/kiem-tra/cuoc-kiem-tra">
                Tất cả <ArrowRight />
              </Link>
            </Button>
          }
        >
          {kiemTraSapToi.length === 0 ? (
            <EmptyState title="Chưa có cuộc kiểm tra nào trong 14 ngày tới" description="Lập kế hoạch tại màn hình Kế hoạch & chỉ tiêu." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cơ sở</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kiemTraSapToi.slice(0, 6).map((k) => {
                  const cs = coSoTheoId.get(k.coSoId)!;
                  return (
                    <TableRow key={k.id}>
                      <TableCell className="max-w-[220px]">
                        <Link href={`/co-so/${cs.id}`} className="hover:text-primary font-medium hover:underline">
                          {cs.ten}
                        </Link>
                        <div className="text-muted-foreground truncate text-xs">{cs.diaChi}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="text-[13px] font-medium">{formatDate(k.ngayKiemTra)}</div>
                        <div className="text-xs">
                          <MoTaHan iso={k.ngayKiemTra} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={k.loai} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={k.trangThai} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        {/* R08 — Báo cáo sắp hạn */}
        <SectionCard
          title="Báo cáo & deadline gần nhất"
          description="R08 — báo cáo chưa nộp, sắp xếp theo hạn"
          contentClassName="px-0 pb-0"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/bao-cao">
                Tất cả <ArrowRight />
              </Link>
            </Button>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Báo cáo</TableHead>
                <TableHead>Nơi nhận</TableHead>
                <TableHead>Hạn nộp</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {baoCaoSapHan.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="max-w-[220px]">
                    <div className="truncate font-medium">{b.ten}</div>
                    <div className="text-muted-foreground text-xs">
                      {b.ma} · chu kỳ {b.chuKy.toLowerCase()}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[150px] truncate text-[13px]">
                    {b.noiNhan}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="text-[13px] font-medium">{formatDate(b.hanNop)}</div>
                    <div className="text-xs">
                      <MoTaHan iso={b.hanNop} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={b.trangThai} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* R11 — chất lượng dữ liệu */}
        <SectionCard
          title="Cơ sở cần chú ý"
          description="R03/R11 — cơ sở đang bị xử lý hoặc hồ sơ thiếu nhiều trường/tài liệu"
          contentClassName="px-0 pb-0"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cơ sở</TableHead>
                <TableHead>Khu phố</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-[130px]">Hoàn thiện hồ sơ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coSoCanChuY.map((cs) => (
                <TableRow key={cs.id}>
                  <TableCell className="max-w-[210px]">
                    <Link href={`/co-so/${cs.id}`} className="hover:text-primary font-medium hover:underline">
                      {cs.ten}
                    </Link>
                    <div className="text-muted-foreground truncate text-xs">{cs.loaiHinh}</div>
                  </TableCell>
                  <TableCell className="text-[13px]">{khuVucTheoId.get(cs.khuVucId)?.ten}</TableCell>
                  <TableCell>
                    <StatusBadge value={cs.trangThai} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={cs.mucDoHoanThienHoSo}
                        className="h-1.5"
                        indicatorClassName={cs.mucDoHoanThienHoSo < 60 ? "bg-destructive" : "bg-warning"}
                      />
                      <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums">
                        {cs.mucDoHoanThienHoSo}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>

        {/* R06 — công việc quá hạn */}
        <SectionCard
          title="Công việc quá hạn"
          description="R06/R07 — chỉ huy có thể yêu cầu giải trình theo BR-06"
          contentClassName="px-0 pb-0"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/cong-viec/giao-viec">
                Tất cả <ArrowRight />
              </Link>
            </Button>
          }
        >
          {congViecQuaHan.length === 0 ? (
            <EmptyState title="Không có công việc quá hạn" description="Toàn bộ công việc đang trong hạn xử lý." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Công việc</TableHead>
                  <TableHead>Người thực hiện</TableHead>
                  <TableHead>Hạn</TableHead>
                  <TableHead>Giải trình</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {congViecQuaHan.map((cv) => (
                  <TableRow key={cv.id}>
                    <TableCell className="max-w-[230px]">
                      <div className="truncate font-medium">{cv.tieuDe}</div>
                      <div className="text-muted-foreground text-xs">
                        {cv.ma} · {cv.loai.toLowerCase()}
                      </div>
                    </TableCell>
                    <TableCell className="text-[13px]">{tenCanBo(cv.nguoiThucHienId)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      <MoTaHan iso={cv.hanHoanThanh} />
                    </TableCell>
                    <TableCell>
                      {cv.canGiaiTrinh ? (
                        <Badge variant="danger">Đã yêu cầu</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
