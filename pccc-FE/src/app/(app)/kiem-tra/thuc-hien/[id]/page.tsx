import { inspectionPageUser } from "@/lib/inspection-server";
import { InspectionWorkspace } from "./inspection-workspace";

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await inspectionPageUser();
  const { id } = await params;
  return <InspectionWorkspace id={id} canEdit={user.permissions.includes("M06.edit")} />;
}
