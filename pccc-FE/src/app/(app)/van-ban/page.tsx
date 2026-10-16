import { documentPageUser } from "@/lib/legal-document-server";
import { DocumentList } from "./document-list";
export default async function DocumentsPage() {
  const user = await documentPageUser();
  return (
    <DocumentList
      canCreate={
        user.permissions.includes("M05.create") && user.scopes.some((s) => s.kind === "all")
      }
    />
  );
}
