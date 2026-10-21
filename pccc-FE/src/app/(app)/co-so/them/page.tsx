import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CoSoForm } from "@/components/forms/co-so-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { backendFetch, requirePage } from "@/lib/backend";
import type { FacilityOptions } from "@/lib/facility-contract";

export const metadata = { title: "Thêm cơ sở mới" };

export default async function TrangThemCoSo() {
  await requirePage("M03.create");
  const response = await backendFetch("/api/facilities/options");
  if (!response.ok) throw new Error("Không thể tải danh mục cơ sở.");
  const options = (await response.json()) as FacilityOptions;
  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/co-so">
          <ArrowLeft />
          Danh sách cơ sở
        </Link>
      </Button>

      <PageHeader
        title="Thêm cơ sở mới"
        description="Tạo hồ sơ cơ sở trong khu vực thuộc phạm vi được phân công."
        module="M03"
        useCases={["UC-FAC-02"]}
      />

      <CoSoForm {...options} />
    </div>
  );
}
