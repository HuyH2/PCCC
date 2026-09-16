import { Check, Minus, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tenPhanHe } from "@/lib/navigation";
import type { ActorCode, ModuleCode } from "@/data/types";

export const metadata = { title: "Vai trò & phạm vi dữ liệu" };

const vaiTroList: { ma: ActorCode; ten: string; moTa: string; phamVi: string }[] = [
  { ma: "A01", ten: "Chỉ huy / Đội trưởng", moTa: "Xem tổng quan; giao việc; theo dõi KPI; yêu cầu giải trình; duyệt trạng thái; xem báo cáo.", phamVi: "Toàn bộ đội Kv10" },
  { ma: "A02", ten: "Phó chỉ huy / Tổ trưởng", moTa: "Theo dõi cán bộ/nhóm được giao; phối hợp điều hành và duyệt theo quyền.", phamVi: "Nhóm/tổ được giao" },
  { ma: "A03", ten: "Cán bộ kiểm tra / Quản lý địa bàn", moTa: "Quản lý cơ sở; cập nhật hồ sơ; thực hiện kiểm tra; xử lý việc/báo cáo.", phamVi: "Khu phố được phân công" },
  { ma: "A04", ten: "Cán bộ tổng hợp", moTa: "Quản lý số liệu, báo cáo, văn bản đến, sự cố và đối soát.", phamVi: "Toàn bộ đội Kv10 (đọc/ghi số liệu tổng hợp)" },
  { ma: "A05", ten: "Quản trị hệ thống", moTa: "Tài khoản, vai trò, danh mục, tham số, nhật ký và cấu hình.", phamVi: "Toàn hệ thống" },
  { ma: "A06", ten: "Lãnh đạo cấp phòng / Người xem", moTa: "Xem dashboard, báo cáo, dữ liệu theo quyền; không nhất thiết được sửa.", phamVi: "Chỉ xem, toàn PC07" },
  { ma: "A07", ten: "Cấp phường (mở rộng)", moTa: "Có thể cập nhật/phối hợp một số cơ sở nếu giai đoạn mở rộng được phê duyệt.", phamVi: "Phường được giao (giai đoạn 3)" },
];

type Quyen = "xem" | "them" | "sua" | "duyet" | "xuat";
const tenQuyen: Record<Quyen, string> = {
  xem: "Xem", them: "Thêm", sua: "Sửa", duyet: "Duyệt", xuat: "Xuất",
};

/** Ma trận quyền mức đề xuất — cần người dùng phê duyệt (UC-ADM-03) */
const maTran: Record<ModuleCode, Partial<Record<ActorCode, Quyen[]>>> = {
  M01: { A05: ["xem", "them", "sua", "duyet", "xuat"], A01: ["xem"] },
  M02: { A01: ["xem", "sua", "duyet"], A02: ["xem"], A04: ["xem", "xuat"], A05: ["xem", "them", "sua", "duyet"], A06: ["xem"] },
  M03: { A01: ["xem", "duyet", "xuat"], A02: ["xem"], A03: ["xem", "them", "sua"], A04: ["xem", "them", "sua", "xuat"], A05: ["xem"], A06: ["xem"], A07: ["xem", "sua"] },
  M04: { A01: ["xem", "duyet", "xuat"], A02: ["xem", "duyet"], A03: ["xem", "them", "sua"], A04: ["xem", "xuat"], A06: ["xem"] },
  M05: { A01: ["xem"], A02: ["xem"], A03: ["xem"], A04: ["xem", "them", "sua"], A05: ["xem", "them", "sua"], A06: ["xem"] },
  M06: { A01: ["xem", "them", "duyet", "xuat"], A02: ["xem", "them", "sua"], A03: ["xem", "them", "sua"], A04: ["xem", "xuat"], A06: ["xem"] },
  M07: { A01: ["xem", "them", "sua", "duyet", "xuat"], A02: ["xem", "them", "sua"], A03: ["xem", "sua"], A04: ["xem", "sua"], A06: ["xem"] },
  M08: { A01: ["xem", "duyet", "xuat"], A03: ["xem", "sua"], A04: ["xem", "them", "sua", "xuat"], A06: ["xem"] },
  M09: { A01: ["xem", "duyet", "xuat"], A03: ["xem", "them", "sua"], A04: ["xem", "them", "sua", "xuat"], A06: ["xem"] },
  M10: { A01: ["xem", "xuat"], A02: ["xem"], A03: ["xem"], A04: ["xem", "xuat"], A05: ["xem"], A06: ["xem", "xuat"] },
  M11: { A04: ["xem", "them", "xuat"], A05: ["xem", "them", "sua", "xuat"], A01: ["xem", "xuat"] },
};

export default function TrangVaiTro() {
  const moduleList = Object.keys(maTran) as ModuleCode[];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vai trò & phạm vi dữ liệu"
        description="Phân quyền theo vai trò kết hợp phạm vi dữ liệu (RBAC + data scope, NFR-01). Quyền xem/thêm/sửa/duyệt/xuất được tách riêng; cán bộ chỉ cập nhật cơ sở và công việc thuộc phạm vi được giao."
        module="M01"
        useCases={["UC-ADM-03"]}
      />

      <div className="border-warning/40 bg-warning/8 flex items-start gap-2.5 rounded-xl border p-3 text-[13px]">
        <Badge variant="warning" className="shrink-0 font-mono">Q02</Badge>
        <p className="text-muted-foreground">
          <strong className="text-foreground font-semibold">Cần xác nhận:</strong> ma trận quyền chi tiết
          dưới đây là mức đề xuất theo URD mục 3, phải được người sử dụng phê duyệt trước khi cấu hình
          chính thức.
        </p>
      </div>

      <SectionCard
        title="Danh mục vai trò"
        description="7 nhóm tác nhân theo URD mục 3"
        contentClassName="px-0 pb-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px]">Mã</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Mô tả trách nhiệm</TableHead>
              <TableHead>Phạm vi dữ liệu mặc định</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vaiTroList.map((v) => (
              <TableRow key={v.ma}>
                <TableCell>
                  <Badge variant="secondary" className="font-mono">
                    {v.ma}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium whitespace-nowrap">{v.ten}</TableCell>
                <TableCell className="text-muted-foreground max-w-[420px] text-[13px]">{v.moTa}</TableCell>
                <TableCell className="text-[13px]">{v.phamVi}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard
        title="Ma trận quyền theo phân hệ"
        description="Mỗi ô liệt kê các quyền được cấp; ô trống nghĩa là vai trò không truy cập phân hệ đó"
        contentClassName="px-0 pb-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[230px]">Phân hệ</TableHead>
              {vaiTroList.map((v) => (
                <TableHead key={v.ma} className="text-center" title={v.ten}>
                  {v.ma}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {moduleList.map((m) => (
              <TableRow key={m}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {m}
                    </Badge>
                    <span className="text-[13px] font-medium">{tenPhanHe[m]}</span>
                  </div>
                </TableCell>
                {vaiTroList.map((v) => {
                  const quyen = maTran[m][v.ma];
                  return (
                    <TableCell key={v.ma} className="text-center align-middle">
                      {!quyen ? (
                        <Minus className="text-muted-foreground/40 mx-auto size-3.5" />
                      ) : (
                        <div className="flex flex-wrap justify-center gap-0.5">
                          {quyen.map((q) => (
                            <span
                              key={q}
                              title={tenQuyen[q]}
                              className={
                                q === "duyet"
                                  ? "bg-primary/12 text-primary rounded px-1 text-[10px] font-semibold"
                                  : "bg-muted text-muted-foreground rounded px-1 text-[10px] font-medium"
                              }
                            >
                              {tenQuyen[q]}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-muted-foreground flex items-center gap-1.5 border-t px-3 py-2 text-xs">
          <ShieldCheck className="size-3.5" />
          Mọi chuyển trạng thái quan trọng đều ghi log người thực hiện và thời gian (BR-03, NFR-03).
        </p>
      </SectionCard>
    </div>
  );
}
