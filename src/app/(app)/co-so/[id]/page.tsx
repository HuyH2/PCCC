import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Building2, CalendarClock, ClipboardCheck, FileText, MapPin,
  Paperclip, Pencil, Phone, ShieldAlert, User2,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ViPhamForm } from "@/components/forms/vi-pham-form";
import {
  canBoTheoId, coSoList, coSoTheoId, cuocKiemTraList, dieuKienCuaCoSo,
  donViTheoId, khuVucTheoId, nhanSuCuaCoSo, viPhamList,
} from "@/data/mock";
import { daysUntil, formatDate, formatNumber } from "@/lib/utils";

export function generateStaticParams() {
  return coSoList.slice(0, 60).map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cs = coSoTheoId.get(id);
  return { title: cs ? cs.ten : "Không tìm thấy cơ sở" };
}

function DongThongTin({ icon: Icon, nhan, children }: { icon: typeof MapPin; nhan: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <div className="text-muted-foreground text-xs">{nhan}</div>
        <div className="text-[13px] font-medium break-words">{children}</div>
      </div>
    </div>
  );
}

export default async function TrangChiTietCoSo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cs = coSoTheoId.get(id);
  if (!cs) notFound();

  const khuVuc = khuVucTheoId.get(cs.khuVucId);
  const phuong = donViTheoId.get(cs.phuongId);
  const canBo = canBoTheoId.get(cs.canBoPhuTrachId);
  const dieuKien = dieuKienCuaCoSo(cs.id);
  const nhanSu = nhanSuCuaCoSo(cs);
  const kiemTra = cuocKiemTraList.filter((k) => k.coSoId === cs.id);
  const viPham = viPhamList.filter((v) => v.coSoId === cs.id);

  const batBuocThieu = dieuKien.filter((d) => d.batBuoc && d.trangThai === "Chưa có");
  const daCo = dieuKien.filter((d) => d.trangThai === "Đã có").length;

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/co-so">
          <ArrowLeft />
          Danh sách cơ sở
        </Link>
      </Button>

      <PageHeader
        title={cs.ten}
        description={`${cs.ma} · ${cs.loaiHinh}`}
        module="M03"
        useCases={["UC-FAC-02", "UC-FAC-04", "UC-FAC-08"]}
        actions={
          <>
            <ViPhamForm
              coSoId={cs.id}
              trigger={
                <Button variant="outline" size="sm">
                  <ShieldAlert />
                  Ghi nhận vi phạm
                </Button>
              }
            />
            <Button variant="outline" size="sm">
              <Paperclip />
              Đính kèm tài liệu
            </Button>
            <Button size="sm" asChild>
              <Link href={`/co-so/${cs.id}/sua`}>
                <Pencil />
                Cập nhật hồ sơ
              </Link>
            </Button>
          </>
        }
      />

      {batBuocThieu.length > 0 && (
        <div className="border-destructive/25 bg-destructive/5 text-destructive flex items-start gap-2.5 rounded-xl border p-3 text-[13px]">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong className="font-semibold">Thiếu {batBuocThieu.length} điều kiện bắt buộc:</strong>{" "}
            {batBuocThieu.map((d) => d.ten).join("; ")}. Theo BR-02, hồ sơ chưa đủ điều kiện để chuyển
            trạng thái hoàn thành.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
            <DongThongTin icon={MapPin} nhan="Địa chỉ">
              {cs.diaChi}
            </DongThongTin>
            <DongThongTin icon={Building2} nhan="Khu phố / Phường">
              {khuVuc?.ten} · {phuong?.ten}
            </DongThongTin>
            <DongThongTin icon={User2} nhan="Người đứng đầu cơ sở">
              {cs.nguoiDungDau}
            </DongThongTin>
            <DongThongTin icon={Phone} nhan="Điện thoại liên hệ">
              <a href={`tel:${cs.dienThoai.replace(/\s/g, "")}`} className="text-primary hover:underline">
                {cs.dienThoai}
              </a>
            </DongThongTin>
            <DongThongTin icon={User2} nhan="Cán bộ phụ trách">
              {canBo ? `${canBo.capBac} ${canBo.hoTen}` : "Chưa phân công"}
            </DongThongTin>
            <DongThongTin icon={Building2} nhan="Quy mô">
              {cs.soTang} tầng · {formatNumber(cs.dienTich)} m²
            </DongThongTin>
            <DongThongTin icon={ClipboardCheck} nhan="Kiểm tra gần nhất">
              {cs.ngayKiemTraGanNhat ? formatDate(cs.ngayKiemTraGanNhat) : "Chưa kiểm tra"}
            </DongThongTin>
            <DongThongTin icon={CalendarClock} nhan="Kiểm tra kế tiếp (dự kiến)">
              {cs.ngayKiemTraKeTiep ? formatDate(cs.ngayKiemTraKeTiep) : "—"}
            </DongThongTin>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-5">
            <div>
              <div className="text-muted-foreground text-xs">Trạng thái hoạt động</div>
              <div className="mt-1.5">
                <StatusBadge value={cs.trangThai} className="text-sm" />
              </div>
            </div>
            <Separator />
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground text-xs">Mức hoàn thiện hồ sơ</span>
                <span className="text-lg font-bold tabular-nums">{cs.mucDoHoanThienHoSo}%</span>
              </div>
              <Progress
                value={cs.mucDoHoanThienHoSo}
                className="mt-2 h-2"
                indicatorClassName={
                  cs.mucDoHoanThienHoSo >= 90 ? "bg-success" : cs.mucDoHoanThienHoSo >= 70 ? "bg-warning" : "bg-destructive"
                }
              />
              <p className="text-muted-foreground mt-2 text-xs">
                {daCo}/{dieuKien.length} mục điều kiện đã có hồ sơ
              </p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-xl font-bold tabular-nums">{kiemTra.length}</div>
                <div className="text-muted-foreground text-xs">Lượt kiểm tra</div>
              </div>
              <div>
                <div className={`text-xl font-bold tabular-nums ${viPham.length > 0 ? "text-destructive" : ""}`}>
                  {viPham.length}
                </div>
                <div className="text-muted-foreground text-xs">Hồ sơ vi phạm</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dieu-kien">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="dieu-kien">Điều kiện PCCC</TabsTrigger>
          <TabsTrigger value="nhan-su">Nhân sự</TabsTrigger>
          <TabsTrigger value="kiem-tra">Kiểm tra</TabsTrigger>
          <TabsTrigger value="vi-pham">Vi phạm</TabsTrigger>
          <TabsTrigger value="lich-su">Lịch sử</TabsTrigger>
        </TabsList>

        <TabsContent value="dieu-kien">
          <SectionCard
            title="Checklist điều kiện và hồ sơ PCCC"
            description="UC-FAC-04 · Checklist chi tiết theo loại hình cơ sở cần đơn vị cung cấp (điểm cần xác nhận Q05)."
            contentClassName="px-0 pb-0"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nội dung</TableHead>
                  <TableHead className="w-[90px] text-center">Bắt buộc</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Cập nhật</TableHead>
                  <TableHead>Hạn hiệu lực</TableHead>
                  <TableHead className="text-center">Tài liệu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dieuKien.map((dk) => {
                  const conHan = dk.hanHieuLuc ? daysUntil(dk.hanHieuLuc) : null;
                  return (
                    <TableRow key={dk.id}>
                      <TableCell className="max-w-[320px]">
                        <div className="font-medium">{dk.ten}</div>
                        {dk.ghiChu && <div className="text-destructive text-xs">{dk.ghiChu}</div>}
                      </TableCell>
                      <TableCell className="text-center">
                        {dk.batBuoc ? <Badge variant="outline">Bắt buộc</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={dk.trangThai} />
                      </TableCell>
                      <TableCell className="text-[13px] whitespace-nowrap">{formatDate(dk.ngayCapNhat)}</TableCell>
                      <TableCell className="text-[13px] whitespace-nowrap">
                        {dk.hanHieuLuc ? (
                          <>
                            {formatDate(dk.hanHieuLuc)}
                            {conHan !== null && conHan < 0 && (
                              <span className="text-destructive ml-1 text-xs font-semibold">(hết hạn)</span>
                            )}
                            {conHan !== null && conHan >= 0 && conHan <= 60 && (
                              <span className="text-warning-foreground ml-1 text-xs font-semibold">(còn {conHan}n)</span>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {dk.soFileDinhKem > 0 ? (
                          <Badge variant="secondary" className="gap-1">
                            <Paperclip className="size-3" />
                            {dk.soFileDinhKem}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="nhan-su">
          <SectionCard
            title="Người đứng đầu và nhân sự cơ sở"
            description="UC-FAC-03, UC-FAC-05 · Khi thay đổi nhân sự thì kết thúc hiệu lực thay vì xóa (BR-03)."
            contentClassName="px-0 pb-0"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Họ và tên</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Điện thoại</TableHead>
                  <TableHead>Huấn luyện nghiệp vụ</TableHead>
                  <TableHead>Hạn chứng nhận</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nhanSu.map((ns) => (
                  <TableRow key={ns.id}>
                    <TableCell className="font-medium">{ns.hoTen}</TableCell>
                    <TableCell className="text-[13px]">{ns.vaiTro}</TableCell>
                    <TableCell>
                      <a href={`tel:${ns.dienThoai.replace(/\s/g, "")}`} className="text-primary text-[13px] hover:underline">
                        {ns.dienThoai}
                      </a>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={ns.trangThaiHuanLuyen} />
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {ns.hanChungNhan ? formatDate(ns.hanChungNhan) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="kiem-tra">
          <SectionCard
            title="Lịch sử kiểm tra"
            description="UC-INS-03, UC-INS-08 · Hồ sơ cuộc kiểm tra, biên bản và kết quả hậu kiểm."
            contentClassName="px-0 pb-0"
          >
            {kiemTra.length === 0 ? (
              <p className="text-muted-foreground px-5 py-10 text-center text-sm">
                Cơ sở chưa có hồ sơ kiểm tra nào trong hệ thống.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã</TableHead>
                    <TableHead>Ngày kiểm tra</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Trưởng đoàn</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Kết quả</TableHead>
                    <TableHead>Biên bản</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kiemTra.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-mono text-xs">{k.ma}</TableCell>
                      <TableCell className="text-[13px] whitespace-nowrap">
                        {formatDate(k.ngayKiemTra)}
                        {k.ngayGoc && (
                          <div className="text-warning-foreground text-xs">
                            dời từ {formatDate(k.ngayGoc)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={k.loai} />
                      </TableCell>
                      <TableCell className="text-[13px]">{canBoTheoId.get(k.truongDoanId)?.hoTen}</TableCell>
                      <TableCell>
                        <StatusBadge value={k.trangThai} />
                      </TableCell>
                      <TableCell>{k.ketQua ? <StatusBadge value={k.ketQua} /> : "—"}</TableCell>
                      <TableCell className="text-[13px]">
                        {k.soBienBan ? (
                          <span className="inline-flex items-center gap-1">
                            <FileText className="text-muted-foreground size-3.5" />
                            {k.soBienBan}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="vi-pham">
          <SectionCard
            title="Hồ sơ vi phạm và khắc phục"
            description="UC-VIO-01..05 · Cơ sở đình chỉ chỉ hoạt động lại khi đủ hồ sơ và được duyệt (BR-09)."
            contentClassName="px-0 pb-0"
          >
            {viPham.length === 0 ? (
              <p className="text-muted-foreground px-5 py-10 text-center text-sm">
                Cơ sở chưa ghi nhận vi phạm.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã</TableHead>
                    <TableHead>Loại vi phạm</TableHead>
                    <TableHead>Mức độ</TableHead>
                    <TableHead>Ngày phát hiện</TableHead>
                    <TableHead>Quyết định</TableHead>
                    <TableHead>Hạn khắc phục</TableHead>
                    <TableHead className="w-[130px]">Tiến độ</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viPham.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">{v.ma}</TableCell>
                      <TableCell className="text-[13px]">{v.loai}</TableCell>
                      <TableCell>
                        <StatusBadge value={v.mucDo} />
                      </TableCell>
                      <TableCell className="text-[13px] whitespace-nowrap">{formatDate(v.ngayPhatHien)}</TableCell>
                      <TableCell className="text-[13px]">{v.soQuyetDinh ?? "—"}</TableCell>
                      <TableCell className="text-[13px] whitespace-nowrap">
                        {v.hanKhacPhuc ? formatDate(v.hanKhacPhuc) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={v.tienDoKhacPhuc} className="h-1.5" />
                          <span className="w-8 shrink-0 text-right text-xs tabular-nums">{v.tienDoKhacPhuc}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={v.trangThai} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="lich-su">
          <SectionCard
            title="Lịch sử thay đổi hồ sơ"
            description="UC-FAC-08 · Lưu người thực hiện, thời gian, trạng thái trước/sau theo BR-03."
          >
            <ol className="relative space-y-5 border-l pl-5">
              {[
                { t: cs.ngayKiemTraGanNhat ?? "2026-06-01", ai: canBo?.hoTen ?? "Cán bộ phụ trách", vc: "Cập nhật kết quả kiểm tra định kỳ", ct: "Ghi nhận biên bản và các tồn tại cần khắc phục." },
                { t: "2026-04-18", ai: "Bùi Thị Lan Anh", vc: "Bổ sung tài liệu scan", ct: "Tải lên phương án chữa cháy và quyết định thành lập đội PCCC cơ sở." },
                { t: "2026-02-10", ai: "Đỗ Thu Trang", vc: "Import dữ liệu từ Excel", ct: "Khởi tạo hồ sơ cơ sở từ đợt số hóa dữ liệu ban đầu." },
              ].map((m, i) => (
                <li key={i} className="relative">
                  <span className="bg-primary absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-[var(--background)]" />
                  <div className="text-muted-foreground text-xs">{formatDate(m.t)} · {m.ai}</div>
                  <div className="text-[13px] font-semibold">{m.vc}</div>
                  <p className="text-muted-foreground text-[13px]">{m.ct}</p>
                </li>
              ))}
            </ol>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
