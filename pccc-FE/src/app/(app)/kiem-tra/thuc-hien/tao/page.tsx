import { PageHeader } from "@/components/shared/page-header";
import { inspectionPageUser } from "@/lib/inspection-server";
import { CreateInspectionForm } from "./create-inspection-form";

export default async function CreateInspectionPage() {
  await inspectionPageUser("create");
  return (
    <div className="space-y-5">
      <PageHeader
        title="Tạo cuộc kiểm tra đột xuất / chuyên đề"
        description="Kiểm tra định kỳ được lập từ kế hoạch; tại đây chỉ tạo kiểm tra đột xuất hoặc theo chuyên đề."
        module="M06"
        useCases={["UC-INS-09"]}
      />
      <CreateInspectionForm />
    </div>
  );
}
