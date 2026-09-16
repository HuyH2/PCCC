import { Building, ChevronRight, Plus, Users } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canBoTheoId, canBoList, donViList } from "@/data/mock";
import type { DonVi } from "@/data/types";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "Cơ cấu đơn vị" };

function NhanhDonVi({ donVi, cap }: { donVi: DonVi; cap: number }) {
  const con = donViList.filter((d) => d.donViChaId === donVi.id);
  const phuTrach = donVi.nguoiPhuTrachId ? canBoTheoId.get(donVi.nguoiPhuTrachId) : null;
  const soCanBo = canBoList.filter((c) => c.donViId === donVi.id).length;

  return (
    <li>
      <div
        className="hover:bg-accent/50 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2.5 transition-colors"
        style={{ marginLeft: cap * 20 }}
      >
        <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Building className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{donVi.ten}</span>
            <Badge variant="outline" className="font-mono text-[11px]">
              {donVi.ma}
            </Badge>
            <Badge variant="secondary">{donVi.cap}</Badge>
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {phuTrach ? `Phụ trách: ${phuTrach.capBac} ${phuTrach.hoTen}` : "Chưa gán người phụ trách"}
            {soCanBo > 0 && ` · ${soCanBo} cán bộ`}
          </div>
        </div>
        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="text-sm font-bold tabular-nums">{formatNumber(donVi.soCoSo)}</div>
            <div className="text-muted-foreground text-[11px]">cơ sở</div>
          </div>
          <StatusBadge value={donVi.trangThai} />
        </div>
      </div>
      {con.length > 0 && (
        <ul className="mt-2 space-y-2">
          {con.map((c) => (
            <NhanhDonVi key={c.id} donVi={c} cap={cap + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function TrangDonVi() {
  const goc = donViList.filter((d) => d.donViChaId === null);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cơ cấu đơn vị / Ban chỉ huy"
        description="Cây tổ chức 4 cấp: Tỉnh/Thành phố → Khu vực → Phường → Khu phố. Cây này là căn cứ để phân quyền theo phạm vi dữ liệu và tổng hợp thống kê."
        module="M02"
        useCases={["UC-ORG-01"]}
        actions={
          <Button size="sm">
            <Plus />
            Thêm đơn vị
          </Button>
        }
      />

      <SectionCard
        title="Cây tổ chức"
        description="Không xóa vật lý đơn vị đã có dữ liệu — chỉ chuyển sang trạng thái ngưng hoạt động (BR-03)."
      >
        <ul className="space-y-2">
          {goc.map((d) => (
            <NhanhDonVi key={d.id} donVi={d} cap={0} />
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="Điểm cần xác nhận với người sử dụng"
        description="Trích từ URD mục 15 — liên quan trực tiếp tới màn hình này"
      >
        <ul className="space-y-2.5 text-[13px]">
          {[
            { ma: "Q02", nd: "Sơ đồ tổ chức chính thức, số cán bộ và quyền của từng vai trò." },
            { ma: "Q03", nd: "Danh mục khu vực/khu phố và quy tắc phân công nhiều cán bộ cho một khu phố." },
            { ma: "Q15", nd: "Quy mô mở rộng: chỉ đội Kv10 hay toàn PC07/cấp phường." },
          ].map((q) => (
            <li key={q.ma} className="flex gap-2.5">
              <Badge variant="warning" className="shrink-0 font-mono">
                {q.ma}
              </Badge>
              <span className="text-muted-foreground">{q.nd}</span>
              <ChevronRight className="text-muted-foreground ml-auto size-4 shrink-0" />
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
