import { PageHeader } from "@/components/shared/page-header";
import { LegalDocumentEditor } from "@/components/forms/legal-document-editor";
import { documentPageUser, loadCategories } from "@/lib/legal-document-server";
export default async function NewDocumentPage() {
  await documentPageUser("create");
  const categories = await loadCategories();
  return (
    <div className="space-y-5">
      <PageHeader title="Thêm văn bản" module="M05" useCases={["UC-DOC-02"]} />
      <LegalDocumentEditor categories={categories.items} maxFileBytes={categories.maxFileBytes} />
    </div>
  );
}
