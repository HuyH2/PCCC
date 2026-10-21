import { inspectionPageUser } from "@/lib/inspection-server";
import { PlanWorkspace } from "./plan-workspace";

export const metadata = { title: "Kế hoạch & chỉ tiêu kiểm tra" };

export default async function InspectionPlansPage() {
  const user = await inspectionPageUser();
  return <PlanWorkspace user={user} />;
}
