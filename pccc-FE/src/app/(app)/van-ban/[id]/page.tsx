import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { documentStatuses, formatAuditTime } from "@/lib/legal-document-contract";
import { documentPageUser, loadDocument } from "@/lib/legal-document-server";
import { DocumentHistory } from "./document-history";
import { canManageDocuments } from "@/lib/auth-contract";
export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await documentPageUser();
  const { id } = await params;
  const document = await loadDocument(id);
  const canEdit = canManageDocuments(user, "edit");
  return (
    <div className="space-y-5">
      <PageHeader
        title={document.title}
        description={document.reference_number}
        module="M05"
        useCases={["UC-DOC-01", "UC-DOC-02"]}
        actions={
          canEdit ? (
            <Button asChild>
              <Link href={`/van-ban/${id}/sua`}>Sửa văn bản</Link>
            </Button>
          ) : undefined
        }
      />
      <div className="space-y-4 rounded-xl border bg-card p-5">
        <dl className="grid gap-4 md:grid-cols-2">
          {[
            ["Loại văn bản", document.category_name],
            ["Số/ký hiệu", document.reference_number],
            ["Cơ quan ban hành", document.issuing_authority],
            ["Ngày ban hành", document.issued_date ?? "—"],
            ["Ngày hiệu lực", document.effective_date],
            ["Trạng thái hiệu lực", documentStatuses[document.status]],
            ["Cập nhật lúc", `${formatAuditTime(document.updated_at)} (giờ Việt Nam)`],
            ["Phiên bản", String(document.version)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {document.notes && <p className="whitespace-pre-wrap">{document.notes}</p>}
        <div className="flex flex-wrap gap-3">
          {document.file_name && (
            <Button asChild>
              <a href={`/api/legal-documents/${id}/file`}>Tải PDF: {document.file_name}</a>
            </Button>
          )}
          {document.source_url && (
            <Button asChild variant="outline">
              <a href={document.source_url} target="_blank" rel="noopener noreferrer">
                Mở đường dẫn văn bản ↗
              </a>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/van-ban">Về danh sách</Link>
          </Button>
        </div>
      </div>
      <DocumentHistory id={id} />
    </div>
  );
}
