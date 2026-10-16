import { canCreateChecklist } from "@/lib/auth-contract";
import { inspectionPageUser } from "@/lib/inspection-server";
import { ChecklistLibrary } from "./checklist-library";

export default async function ChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const user = await inspectionPageUser();
  const { id } = await searchParams;
  return (
    <ChecklistLibrary
      canCreate={canCreateChecklist(user)}
      initialId={typeof id === "string" ? id : null}
    />
  );
}
