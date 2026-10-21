import { CheckCircle2, Clock3, MessageSquare, XCircle } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { backendFetch, requirePage } from "@/lib/backend";
import { type ExplanationPage } from "@/lib/explanation-contract";
import { ExplanationBoard } from "./explanation-board";

export const metadata = { title: "Giải trình công việc & KPI" };

export default async function TrangGiaiTrinh() {
  const user = await requirePage("M07.view");
  const response = await backendFetch("/api/explanations?pageSize=100");
  if (!response.ok) throw new Error("Không thể tải danh sách giải trình.");
  const data = (await response.json()) as ExplanationPage;
  const canRequest =
    ["A01", "A02", "A05"].includes(user.role) && user.permissions.includes("M07.edit");
  const counts = {
    requested: data.items.filter((item) => item.status === "requested").length,
    submitted: data.items.filter((item) => item.status === "submitted").length,
    accepted: data.items.filter((item) => item.status === "accepted").length,
    rejected: data.items.filter((item) => item.status === "rejected").length,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Giải trình công việc & KPI"
        description="Chỉ huy yêu cầu cán bộ giải trình phần công việc hoặc chỉ tiêu chưa đạt; cán bộ gửi phản hồi và chỉ huy xử lý chấp nhận hoặc từ chối."
        module="M07"
        useCases={["UC-WRK-05"]}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Chờ cán bộ phản hồi"
          value={counts.requested}
          icon={Clock3}
          tone={counts.requested > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Chờ chỉ huy xử lý"
          value={counts.submitted}
          icon={MessageSquare}
          tone="info"
        />
        <StatCard label="Đã chấp nhận" value={counts.accepted} icon={CheckCircle2} tone="success" />
        <StatCard
          label="Không chấp nhận"
          value={counts.rejected}
          icon={XCircle}
          tone={counts.rejected > 0 ? "danger" : "default"}
        />
      </div>

      <ExplanationBoard
        items={data.items}
        accounts={data.accounts}
        currentUserId={user.id}
        canRequest={canRequest}
        canReviewAll={user.role === "A05"}
      />
    </div>
  );
}
