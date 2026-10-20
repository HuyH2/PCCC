import { requirePage } from "@/lib/backend";
import { ViPhamClient } from "./vi-pham-client";

export const metadata = { title: "Vi phạm - Đình chỉ - Khắc phục" };

export default async function TrangViPham() {
  const user = await requirePage("M04.view");
  return (
    <ViPhamClient
      canCreate={user.permissions.includes("M04.create")}
      canEdit={user.permissions.includes("M04.edit")}
      canApprove={user.permissions.includes("M04.approve")}
    />
  );
}
