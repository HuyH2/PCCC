import { requirePage } from "@/lib/backend";
import { PageHeader } from "@/components/shared/page-header";
import { AuthorizationEditor } from "./authorization-editor";

export const metadata = { title: "Vai trò & phạm vi dữ liệu" };
export default async function TrangVaiTro() {
  const user = await requirePage("M01.view", true);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Vai trò & phạm vi dữ liệu"
        description="Cấu hình quyền xem/thêm/sửa/duyệt/xuất và phạm vi đơn vị, khu phố hoặc cơ sở."
        module="M01"
        useCases={["UC-ADM-03"]}
      />
      <p className="rounded-lg border p-3 text-sm">
        Q02: quyền seed là dữ liệu mẫu cho đồ án. Ma trận chính thức cần được người sử dụng phê
        duyệt trước khi vận hành.
      </p>
      <AuthorizationEditor canEdit={user.permissions.includes("M01.edit")} />
    </div>
  );
}
