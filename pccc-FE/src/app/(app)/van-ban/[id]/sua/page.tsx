import { PageHeader } from "@/components/shared/page-header";
import { LegalDocumentEditor } from "@/components/forms/legal-document-editor";
import { documentPageUser, loadDocument, loadCategories } from "@/lib/legal-document-server";
export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  await documentPageUser("edit");
  const { id } = await params;
  const [document, categories] = await Promise.all([loadDocument(id), loadCategories()]);
  return (
    <div className="space-y-5">
      <PageHeader title="Cập nhật và phân loại văn bản" module="M05" useCases={["UC-DOC-02"]} />
      <LegalDocumentEditor
        document={document}
        categories={categories.items}
        maxFileBytes={categories.maxFileBytes}
      />
    </div>
  );
}
