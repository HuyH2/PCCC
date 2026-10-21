import { requirePage } from "@/lib/backend";
import { incidentPermissions } from "@/lib/incident-contract";
import { IncidentDetails } from "./incident-details";

export const metadata = { title: "Chi tiết sự cố" };

export default async function TrangChiTietSuCo({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("M09.view");
  const { id } = await params;
  return (
    <IncidentDetails
      id={id}
      officerId={user.officerId}
      permissions={incidentPermissions(user.permissions)}
    />
  );
}
