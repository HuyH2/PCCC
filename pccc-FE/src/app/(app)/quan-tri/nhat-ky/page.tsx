import { requirePage } from "@/lib/backend";
import { AuditLogList } from "./audit-log-list";
export default async function AuditLogPage() {
  await requirePage("M01.view", true);
  return <AuditLogList />;
}
