import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { canCreateChecklist } from "@/lib/auth-contract";
import { inspectionPageUser } from "@/lib/inspection-server";
import { CreateChecklistForm } from "./create-checklist-form";

export default async function CreateChecklistPage() {
  const user = await inspectionPageUser("create");
  if (!canCreateChecklist(user)) redirect("/khong-co-quyen");
  return (
    <div className="space-y-5">
      <PageHeader
        title="Tạo checklist kiểm tra"
        description="Dành cho Chỉ huy và Phó chỉ huy. Checklist mới dùng được ngay khi thực hiện kiểm tra."
        module="M06"
        useCases={["UC-INS-06"]}
      />
      <CreateChecklistForm canReadDocuments={user.permissions.includes("M05.view")} />
    </div>
  );
}
