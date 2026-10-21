import { requirePage } from "@/lib/backend";
import { UnitManager } from "./unit-manager";

export const metadata = { title: "Cơ cấu đơn vị" };

export default async function TrangDonVi() {
  const user = await requirePage("M02.view");
  return (
    <UnitManager
      canCreate={user.permissions.includes("M02.create")}
      canEdit={user.permissions.includes("M02.edit")}
    />
  );
}
