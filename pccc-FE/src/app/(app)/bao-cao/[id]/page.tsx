import { requirePage } from "@/lib/backend";
import { ReportDetail } from "./report-detail";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("M08.view");
  const { id } = await params;
  return <ReportDetail id={id} user={user} />;
}
