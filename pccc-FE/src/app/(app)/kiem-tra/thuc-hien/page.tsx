import { inspectionPageUser } from "@/lib/inspection-server";
import { InspectionList } from "./inspection-list";

export default async function InspectionExecutionPage() {
  const user = await inspectionPageUser();
  return <InspectionList canCreate={user.permissions.includes("M06.create")} />;
}
