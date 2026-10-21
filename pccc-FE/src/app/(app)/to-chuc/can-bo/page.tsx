import { requirePage } from "@/lib/backend";
import { OfficerDirectory } from "./officer-directory";

export const metadata = { title: "Danh bạ cán bộ" };

export default async function TrangCanBo() {
  const user = await requirePage("M02.view");
  return (
    <OfficerDirectory
      canCreate={user.permissions.includes("M02.create")}
      canEdit={user.permissions.includes("M02.edit")}
    />
  );
}
