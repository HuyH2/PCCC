import { documentPageUser } from "@/lib/legal-document-server";
import { canManageDocuments } from "@/lib/auth-contract";
import { DocumentList } from "./document-list";
export default async function DocumentsPage() {
  const user = await documentPageUser();
  return <DocumentList canCreate={canManageDocuments(user, "create")} />;
}
