import { requirePage } from "@/lib/backend";
import { ReportWorkspace } from "./report-workspace";

export const metadata = { title: "Báo cáo & deadline" };
export default async function ReportPage() {
  const user = await requirePage("M08.view");
  return <ReportWorkspace user={user} />;
}
