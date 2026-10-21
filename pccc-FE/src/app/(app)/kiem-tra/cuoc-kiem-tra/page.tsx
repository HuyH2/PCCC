import { inspectionPageUser } from "@/lib/inspection-server";
import { InspectionCaseWorkspace } from "./inspection-case-workspace";

export const metadata = { title: "Hồ sơ cuộc kiểm tra định kỳ" };

export default async function InspectionCasesPage() {
  const user = await inspectionPageUser();
  return <InspectionCaseWorkspace user={user} />;
}
