import { redirect, notFound } from "next/navigation";
import { backendFetch, requirePage } from "./backend";
import type { DocumentCategory, LegalDocument } from "./legal-document-contract";
import { canManageDocuments } from "./auth-contract";

export async function documentPageUser(action: "view" | "create" | "edit" = "view") {
  const user = await requirePage(`M05.${action}`);
  if (
    !user.permissions.includes("M05.view") ||
    !user.scopes.length ||
    (action !== "view" && !canManageDocuments(user, action))
  )
    redirect("/khong-co-quyen");
  return user;
}
export async function loadDocument(id: string): Promise<LegalDocument> {
  const response = await backendFetch(`/api/legal-documents/${encodeURIComponent(id)}`);
  if (response.status === 404) notFound();
  if (response.status === 403) redirect("/khong-co-quyen");
  if (!response.ok) throw new Error("Không thể tải văn bản.");
  return (await response.json()).document;
}
export async function loadCategories(): Promise<{
  items: DocumentCategory[];
  maxFileBytes: number;
}> {
  const response = await backendFetch("/api/legal-document-categories");
  if (!response.ok) throw new Error("Không thể tải danh mục văn bản.");
  return await response.json();
}
