import { Clock3, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TransferHistory } from "../transfer-history";

export const metadata = { title: "Import dữ liệu" };

export default function TrangImport() {
  return (
    <div className="space-y-5">
      <PageHeader title="Import dữ liệu nghiệp vụ"
        description="Luồng import dùng chung đang chờ biểu mẫu và quy tắc nhập được phê duyệt."
        module="M11" useCases={["UC-SYS-04", "UC-FAC-07"]} />
      <Card><CardContent className="flex items-start gap-3 pt-5">
        <Clock3 className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div><h2 className="font-semibold">Chờ xác nhận đặc tả import</h2>
          <p className="mt-1 text-sm text-muted-foreground">Chưa bật tải lên hoặc ghi dữ liệu. Cần thống nhất mẫu file, quy tắc kiểm tra và quyền nhập với người phụ trách import cơ sở trước khi triển khai luồng dùng chung.</p>
        </div>
      </CardContent></Card>
      <div className="flex items-start gap-2 border-b pb-5 text-sm text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <p>Không tải dữ liệu thật hoặc tài liệu mật lên hệ thống khi chưa được đơn vị phê duyệt.</p>
      </div>
      <TransferHistory direction="import" />
    </div>
  );
}
