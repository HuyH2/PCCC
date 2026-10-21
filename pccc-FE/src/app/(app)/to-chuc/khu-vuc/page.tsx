import { PageHeader } from "@/components/shared/page-header";
import { requirePage } from "@/lib/backend";
import { RegionManager } from "./region-manager";

export const metadata = { title: "Khu vực - Khu phố" };

export default async function TrangKhuVuc() {
  const user = await requirePage("M02.view");
  return (
    <div className="space-y-5">
      <PageHeader
        title="Khu vực - Khu phố"
        description="Danh mục khu phố thuộc các đơn vị trong phạm vi được cấp. Mỗi khu phố có một cán bộ phụ trách; thay đổi phân công được lưu lịch sử."
        module="M02"
        useCases={["UC-ORG-03"]}
      />
      <RegionManager
        canEdit={user.permissions.includes("M02.edit")}
        canCreate={user.permissions.includes("M02.create")}
      />
    </div>
  );
}
