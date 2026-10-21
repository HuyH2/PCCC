import { requirePage } from "@/lib/backend";
import { incidentPermissions } from "@/lib/incident-contract";
import { IncidentDirectory } from "./incident-directory";

export const metadata = { title: "Sự cố cháy, nổ và CNCH" };

export default async function TrangSuCo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePage("M09.view");
  const filters = await searchParams;
  const initialFilters: Record<string, string> = {};
  for (const key of [
    "incidentType",
    "regionId",
    "processingStatus",
    "recordStatus",
    "deadlineWarning",
    "from",
    "to",
    "search",
  ]) {
    if (typeof filters[key] === "string") initialFilters[key] = filters[key];
  }
  return (
    <IncidentDirectory
      permissions={incidentPermissions(user.permissions)}
      initialFilters={initialFilters}
    />
  );
}
