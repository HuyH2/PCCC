import { Download, FileSpreadsheet, FileText, ShieldAlert, Table2 } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { baoCaoList, canBoList, coSoList, cuocKiemTraList, suCoList, viPhamList } from "@/data/mock";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "Kết xuất dữ liệu" };

const boDuLieu = [
  { ma: "R01", ten: "Danh sách cơ sở theo cán bộ/khu phố/trạng thái", soDong: coSoList.length, dinhDang: "Excel, CSV", phanHe: "M03" },
  { ma: "R02", ten: "Tình trạng hồ sơ PCCC và chứng nhận sắp hết hạn", soDong: coSoList.length, dinhDang: "Excel", phanHe: "M03" },
  { ma: "R03", ten: "Vi phạm, đình chỉ, không phép", soDong: viPhamList.length, dinhDang: "Excel, PDF", phanHe: "M04" },
  { ma: "R04", ten: "Kế hoạch kiểm tra: chỉ tiêu, thực hiện, nợ", soDong: 8, dinhDang: "Excel", phanHe: "M06" },
  { ma: "R05", ten: "Hồ sơ cuộc kiểm tra và kết quả", soDong: cuocKiemTraList.length, dinhDang: "Excel", phanHe: "M06" },
  { ma: "R06", ten: "Công việc và KPI theo cán bộ", soDong: 48, dinhDang: "Excel", phanHe: "M07" },
  { ma: "R08", ten: "Báo cáo và deadline", soDong: baoCaoList.length, dinhDang: "Excel", phanHe: "M08" },
  { ma: "R09", ten: "Thống kê sự cố theo thời gian và loại", soDong: suCoList.length, dinhDang: "Excel, PDF", phanHe: "M09" },
  { ma: "R10", ten: "Thiệt hại về người và tài sản", soDong: suCoList.length, dinhDang: "Excel", phanHe: "M09" },
  { ma: "R11", ten: "Chất lượng dữ liệu: hồ sơ thiếu trường/thiếu file", soDong: coSoList.length, dinhDang: "Excel", phanHe: "M11" },
  { ma: "R12", ten: "Nhật ký thay đổi theo người dùng/đối tượng", soDong: 40, dinhDang: "Excel", phanHe: "M01" },
];

export default function TrangExport() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Kết xuất số liệu & biểu mẫu"
        description="Xuất dữ liệu nghiệp vụ ra Excel/CSV/PDF để phục vụ báo cáo và đối soát giữa các nhóm. Quyền xuất dữ liệu được tách riêng khỏi quyền xem theo NFR-01."
        module="M11"
        useCases={["UC-RPT-06", "UC-SYS-04"]}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { nhan: "Cơ sở", so: coSoList.length, icon: Table2 },
          { nhan: "Cán bộ", so: canBoList.length, icon: Table2 },
          { nhan: "Hồ sơ kiểm tra", so: cuocKiemTraList.length, icon: Table2 },
          { nhan: "Hồ sơ vi phạm", so: viPhamList.length, icon: Table2 },
        ].map((x) => (
          <Card key={x.nhan} className="gap-0 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-[13px]">{x.nhan}</p>
                <p className="text-2xl font-bold tabular-nums">{formatNumber(x.so)}</p>
              </div>
              <Button variant="outline" size="icon-sm" aria-label={`Xuất ${x.nhan}`}>
                <Download className="size-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <SectionCard
        title="Bộ số liệu kết xuất chuẩn"
        description="Tương ứng danh mục báo cáo/dashboard R01–R12 trong URD mục 11"
        contentClassName="px-0 pb-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px]">Mã</TableHead>
              <TableHead>Bộ số liệu</TableHead>
              <TableHead className="w-[80px]">Phân hệ</TableHead>
              <TableHead className="text-right">Số bản ghi</TableHead>
              <TableHead>Định dạng</TableHead>
              <TableHead className="w-[110px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {boDuLieu.map((b) => (
              <TableRow key={b.ma}>
                <TableCell>
                  <Badge variant="secondary" className="font-mono">
                    {b.ma}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{b.ten}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {b.phanHe}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(b.soDong)}</TableCell>
                <TableCell className="text-muted-foreground text-[13px]">{b.dinhDang}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm">
                    <FileSpreadsheet />
                    Xuất
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      <Card>
        <CardContent className="flex items-start gap-2.5 pt-5 text-[13px]">
          <ShieldAlert className="text-destructive mt-0.5 size-4 shrink-0" />
          <p className="text-muted-foreground">
            <strong className="text-foreground font-semibold">Kiểm soát dữ liệu xuất:</strong> mỗi lần kết
            xuất đều ghi nhật ký người thực hiện, phạm vi và thời gian (NFR-03). Cần phân loại rõ dữ liệu
            được phép xuất, dữ liệu phải mã hóa và ai được quyền tải (URD mục 10, Q12).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
