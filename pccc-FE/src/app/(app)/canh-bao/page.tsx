import { currentUser } from "@/lib/backend";
import { NotificationCenter } from "./notification-center";

export const metadata = { title: "Cảnh báo & nhắc việc" };
export default async function NotificationsPage() {
  await currentUser();
  return <NotificationCenter />;
}
