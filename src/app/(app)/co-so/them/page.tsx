import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CoSoForm } from "@/components/forms/co-so-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Thêm cơ sở mới" };

export default function TrangThemCoSo() {
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
        description="Tạo hồ sơ chuẩn cho một cơ sở thuộc diện quản lý về PCCC trên địa bàn Đội Khu vực 10."
        module="M03"
        useCases={["UC-FAC-02"]}
      />

      <CoSoForm />
    </div>
  );
}
