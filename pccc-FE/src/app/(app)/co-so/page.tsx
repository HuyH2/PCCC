import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Building2, FileCheck2, ShieldAlert, ShieldX } from "lucide-react";

import { CoSoTable } from "./co-so-table";
import { chatLuongHoSo, coSoTheoTrangThai, tongCoSo } from "@/data/thong-ke";

export const metadata = { title: "Danh sách cơ sở" };

export default function TrangCoSo() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Cơ sở & hồ sơ quản lý"
        description="Tra cứu và quản lý toàn bộ cơ sở thuộc diện quản lý về PCCC của Đội Khu vực 10. Cán bộ chỉ cập nhật được cơ sở thuộc phạm vi được phân công (UC-ADM-03)."
        module="M03"
        useCases={["UC-FAC-01", "UC-FAC-02", "UC-FAC-07"]}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng số cơ sở" value={tongCoSo} icon={Building2} hint="Thuộc phạm vi Kv10" />
        <StatCard
          label="Đang hoạt động"
          value={coSoTheoTrangThai.dangHoatDong}
          icon={FileCheck2}
          tone="success"
        />
        <StatCard
          label="Đang đình chỉ"
          value={coSoTheoTrangThai.dangDinhChi}
          icon={ShieldAlert}
          tone="danger"
          hint={`${coSoTheoTrangThai.tamNgung} cơ sở tạm ngừng`}
        />
        <StatCard
          label="Hoạt động không phép"
          value={coSoTheoTrangThai.khongPhep}
          icon={ShieldX}
          tone="danger"
          hint={`${chatLuongHoSo.thieu} cơ sở hồ sơ dưới 70%`}
        />
      </div>

      <CoSoTable />
    </div>
  );
}
