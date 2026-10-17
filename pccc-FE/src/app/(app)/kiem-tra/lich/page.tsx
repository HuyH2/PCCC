import { inspectionPageUser } from "@/lib/inspection-server";
import { InspectionCalendar } from "./inspection-calendar";

export const metadata = { title: "Lịch kiểm tra" };

export default async function InspectionCalendarPage() {
  await inspectionPageUser();
  return <InspectionCalendar />;
}
