import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { backendFetch, requirePage } from "@/lib/backend";
import type { ReportOptions, ReportTemplateRecord, ReportTypeRecord } from "@/lib/report-contract";
import { ReportExportClient } from "./report-export-client";

export const metadata = { title: "Kết xuất báo cáo" };

export default async function TrangKetXuatBaoCao() {
  const user = await requirePage("M08.view");
  if (!user.scopes.length) redirect("/khong-co-quyen");

  const [typesResponse, optionsResponse, templatesResponse] = await Promise.all([
    backendFetch("/api/report-export/types"),
    backendFetch("/api/report-export/options"),
    backendFetch("/api/report-export/templates"),
  ]);
  if (!typesResponse.ok || !optionsResponse.ok || !templatesResponse.ok)
    throw new Error("Không thể tải cấu hình kết xuất báo cáo.");

  const types = (await typesResponse.json()) as { items: ReportTypeRecord[]; maxRows: number };
  const options = (await optionsResponse.json()) as ReportOptions;
  const templates = (await templatesResponse.json()) as { items: ReportTemplateRecord[] };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kết xuất báo cáo"
        description="Chọn loại báo cáo, lọc dữ liệu, xem trước và tải file Excel/PDF. Dữ liệu chỉ lấy từ các phân hệ đã hoàn thành; biểu mẫu chính thức sẽ được bổ sung khi có mẫu đã xác nhận."
        module="M08"
        useCases={["UC-RPT-06"]}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/bao-cao">
              <ArrowLeft />
              Báo cáo & deadline
            </Link>
          </Button>
        }
      />
      <ReportExportClient
        initialTypes={types.items}
        initialOptions={options}
        initialTemplates={templates.items}
        canExport={user.permissions.includes("M08.export")}
        maxRows={types.maxRows ?? options.maxRows}
      />
    </div>
  );
}
