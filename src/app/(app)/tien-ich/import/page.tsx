import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, ShieldAlert, Upload, XCircle } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Import dữ liệu từ Excel" };

/** Mô phỏng kết quả kiểm tra file trước khi nhập (UC-FAC-07 bước 2-3) */
const dongPreview = [
  { dong: 2, ten: "Chung cư Hoa Sen 3", diaChi: "125 Tô Hiến Thành, Phường Hòa Hưng", loaiHinh: "Chung cư/Nhà cao tầng", khuPho: "PHV-KP02", trangThai: "hop-le" },
  { dong: 3, ten: "Karaoke Hoàng Tử 5", diaChi: "48 Bà Hạt, Phường Diên Hồng", loaiHinh: "Karaoke/Vũ trường", khuPho: "PDH-KP01", trangThai: "hop-le" },
  { dong: 4, ten: "Kho Tân Hưng 2", diaChi: "", loaiHinh: "Nhà xưởng/Kho", khuPho: "PVL-KP03", trangThai: "loi", loi: "Thiếu trường bắt buộc: Địa chỉ" },
  { dong: 5, ten: "Chung cư Hoa Sen 3", diaChi: "125 Tô Hiến Thành, Phường Hòa Hưng", loaiHinh: "Chung cư/Nhà cao tầng", khuPho: "PHV-KP02", trangThai: "canh-bao", loi: "Trùng tên + địa chỉ với dòng 2" },
  { dong: 6, ten: "CHXD Petrolimex 27", diaChi: "302 Cách Mạng Tháng 8, Phường Vườn Lài", loaiHinh: "Trạm xăng dầu", khuPho: "PVL-KP01", trangThai: "hop-le" },
  { dong: 7, ten: "Trường THCS Lê Lợi 1", diaChi: "12 Vườn Lài, Phường Vườn Lài", loaiHinh: "Cơ sở giáo dục", khuPho: "PVL-KP99", trangThai: "loi", loi: "Mã khu phố không tồn tại trong danh mục" },
];

const lichSuImport = [
  { ngay: "2026-09-10", file: "co-so-hoa-hung-t9.xlsx", nguoi: "Bùi Thị Lan Anh", tong: 186, thanhCong: 181, loi: 5 },
  { ngay: "2026-08-22", file: "danh-sach-can-bo-kv10.xlsx", nguoi: "Đỗ Thu Trang", tong: 11, thanhCong: 11, loi: 0 },
  { ngay: "2026-07-15", file: "co-so-dien-hong-vuon-lai.xlsx", nguoi: "Bùi Thị Lan Anh", tong: 402, thanhCong: 388, loi: 14 },
];

export default function TrangImport() {
  const hopLe = dongPreview.filter((d) => d.trangThai === "hop-le").length;
  const canhBao = dongPreview.filter((d) => d.trangThai === "canh-bao").length;
  const loi = dongPreview.filter((d) => d.trangThai === "loi").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Import dữ liệu từ Excel"
        description="Nhập hàng loạt dữ liệu cơ sở, cán bộ và khu phố từ file Excel. Hệ thống đọc file, kiểm tra và hiển thị preview lỗi/cảnh báo trước khi ghi nhận; mỗi lần nhập đều tạo log kết quả."
        module="M11"
        useCases={["UC-FAC-07", "UC-SYS-04"]}
        actions={
          <Button variant="outline" size="sm">
            <Download />
            Tải file mẫu
          </Button>
        }
      />

      <div className="border-destructive/25 bg-destructive/5 flex items-start gap-2.5 rounded-xl border p-3 text-[13px]">
        <ShieldAlert className="text-destructive mt-0.5 size-4 shrink-0" />
        <p className="text-muted-foreground">
          <strong className="text-destructive font-semibold">Lưu ý an toàn thông tin (BR-12, NFR-02):</strong>{" "}
          Không đưa tài liệu mật/bí mật nhà nước lên hạ tầng chưa được phê duyệt. Môi trường demo chỉ dùng
          dữ liệu mẫu hoặc dữ liệu đã được xử lý. Danh mục dữ liệu được phép upload cần đơn vị xác nhận (Q12).
        </p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="border-border hover:border-primary/50 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors">
            <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
              <Upload className="size-6" />
            </span>
            <div>
              <p className="font-semibold">Kéo thả file Excel vào đây</p>
              <p className="text-muted-foreground mt-0.5 text-[13px]">
                Định dạng .xlsx hoặc .xls · tối đa 10MB · hệ thống kiểm tra định dạng và dung lượng trước khi nhận (NFR-12)
              </p>
            </div>
            <Button>
              <FileSpreadsheet />
              Chọn file từ máy
            </Button>
          </div>
        </CardContent>
      </Card>

      <SectionCard
        title="Preview kết quả kiểm tra file"
        description="UC-FAC-07 · chỉ các dòng hợp lệ mới được nhập vào hệ thống; dòng lỗi được xuất ra file để sửa"
        contentClassName="px-0 pb-0"
        action={
          <div className="flex items-center gap-2">
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="size-3" />
              {hopLe} hợp lệ
            </Badge>
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="size-3" />
              {canhBao} cảnh báo
            </Badge>
            <Badge variant="danger" className="gap-1">
              <XCircle className="size-3" />
              {loi} lỗi
            </Badge>
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px] text-center">Dòng</TableHead>
              <TableHead>Tên cơ sở</TableHead>
              <TableHead>Địa chỉ</TableHead>
              <TableHead>Loại hình</TableHead>
              <TableHead>Mã khu phố</TableHead>
              <TableHead>Kết quả kiểm tra</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dongPreview.map((d) => (
              <TableRow
                key={d.dong}
                className={d.trangThai === "loi" ? "bg-destructive/5" : d.trangThai === "canh-bao" ? "bg-warning/8" : undefined}
              >
                <TableCell className="text-muted-foreground text-center text-xs tabular-nums">{d.dong}</TableCell>
                <TableCell className="font-medium">{d.ten}</TableCell>
                <TableCell className="text-[13px]">
                  {d.diaChi || <span className="text-destructive italic">(trống)</span>}
                </TableCell>
                <TableCell className="text-[13px]">{d.loaiHinh}</TableCell>
                <TableCell className="font-mono text-xs">{d.khuPho}</TableCell>
                <TableCell>
                  {d.trangThai === "hop-le" ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="size-3" />
                      Hợp lệ
                    </Badge>
                  ) : d.trangThai === "canh-bao" ? (
                    <span className="text-warning-foreground text-[13px] font-medium">{d.loi}</span>
                  ) : (
                    <span className="text-destructive text-[13px] font-medium">{d.loi}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex flex-wrap justify-end gap-2 border-t p-3">
          <Button variant="outline" size="sm">
            <Download />
            Tải danh sách dòng lỗi
          </Button>
          <Button size="sm">
            <CheckCircle2 />
            Xác nhận nhập {hopLe} dòng hợp lệ
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Lịch sử import"
        description="Mỗi lần nhập tạo log kết quả kèm người thực hiện và thời gian (BR-03)"
        contentClassName="px-0 pb-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ngày</TableHead>
              <TableHead>Tệp</TableHead>
              <TableHead>Người thực hiện</TableHead>
              <TableHead className="text-right">Tổng dòng</TableHead>
              <TableHead className="text-right">Thành công</TableHead>
              <TableHead className="text-right">Lỗi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lichSuImport.map((l) => (
              <TableRow key={l.file}>
                <TableCell className="text-[13px] whitespace-nowrap">{formatDate(l.ngay)}</TableCell>
                <TableCell className="font-mono text-xs">{l.file}</TableCell>
                <TableCell className="text-[13px]">{l.nguoi}</TableCell>
                <TableCell className="text-right tabular-nums">{l.tong}</TableCell>
                <TableCell className="text-success text-right font-semibold tabular-nums">{l.thanhCong}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {l.loi > 0 ? <span className="text-destructive font-semibold">{l.loi}</span> : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
