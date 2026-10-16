import { redirect } from "next/navigation";
import { requirePage } from "./backend";

/** Page guard for M06 execution screens; the API enforces permission and scope again. */
export async function inspectionPageUser(action: "view" | "create" = "view") {
  const user = await requirePage(`M06.${action}`);
  if (!user.permissions.includes("M06.view") || !user.scopes.length) redirect("/khong-co-quyen");
  return user;
}
