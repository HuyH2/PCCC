import { PageHeader } from "@/components/shared/page-header";
import { DataTransferManager } from "./data-transfer-manager";

export const metadata = { title: "Kết xuất dữ liệu" };

export default function TrangExport() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Kết xuất dữ liệu nghiệp vụ"
        description="Chọn dữ liệu, định dạng và bộ lọc trong phạm vi được phân quyền. Mỗi lần xuất được ghi nhận vào lịch sử."
        module="M11"
        useCases={["UC-RPT-06", "UC-SYS-04"]}
      />
      <DataTransferManager />
    </div>
  );
}
