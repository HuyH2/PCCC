import { inspectionPageUser } from "@/lib/inspection-server";
import { InspectionPlanningDetail } from "./inspection-planning-detail";

export default async function InspectionPlanningDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await inspectionPageUser();
  const { id } = await params;
  return <InspectionPlanningDetail id={id} user={user} />;
}
