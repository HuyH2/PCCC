import { IncidentStatisticsPanel } from "@/components/incidents/incident-statistics";
import { requirePage } from "@/lib/backend";

export const metadata = { title: "Thống kê sự cố R09/R10" };

export default async function TrangThongKeSuCo() {
  const user = await requirePage("M09.export");
  return <IncidentStatisticsPanel canView={user.permissions.includes("M09.view")} />;
}
