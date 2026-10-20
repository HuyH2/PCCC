import { PageHeader } from "@/components/shared/page-header";
import { requirePage } from "@/lib/backend";
import { TransferManager } from "./transfer-manager";

export const metadata = { title: "Chuyển giao phạm vi quản lý" };

export default async function TransferPage() {
  const user = await requirePage("M01.view", true);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Chuyển giao địa bàn và cơ sở"
        description="Chọn cán bộ cũ, phạm vi cần chuyển và cán bộ mới. Chuyển giao có hiệu lực ngay sau xác nhận; lịch sử người phụ trách được giữ lại."
        module="M02"
        useCases={["UC-ORG-03", "UC-ADM-04"]}
      />
      <TransferManager canEdit={user.permissions.includes("M01.edit")} />
    </div>
  );
}
