"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  documentStatuses,
  type DocumentCategory,
  type LegalDocument,
} from "@/lib/legal-document-contract";
import { apiData } from "@/lib/use-api-data";

export const nativeSelectClass = "h-9 w-full rounded-md border bg-background px-3 text-sm";

export function LegalDocumentEditor({
  document,
  categories,
  maxFileBytes,
}: {
  document?: LegalDocument;
  categories: DocumentCategory[];
  maxFileBytes: number;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const payload: Record<string, unknown> = {};
      for (const key of [
        "title",
        "reference_number",
        "issuing_authority",
        "issued_date",
        "effective_date",
        "category_id",
        "status",
        "source_url",
        "notes",
      ])
        payload[key] = String(form.get(key) ?? "").trim();
      if (document) payload.version = document.version;
      const file = form.get("file");
      if (file instanceof File && file.size) {
        if (file.size > maxFileBytes || !/\.pdf$/i.test(file.name))
          throw new Error(`Chỉ nhận PDF tối đa ${maxFileBytes / (1024 * 1024)} MB.`);
        const contentBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () => reject(new Error("Không đọc được file."));
          reader.readAsDataURL(file);
        });
        payload.file = { name: file.name, contentBase64 };
      }
      if (!payload.source_url && !payload.file && !document?.file_name)
        throw new Error("Cần file PDF hoặc đường dẫn văn bản.");
      const result = await apiData<{ document: LegalDocument }>(
        `/api/legal-documents${document ? `/${document.id}` : ""}`,
        {
          method: document ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      router.push(`/van-ban/${result.document.id}`);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không lưu được văn bản.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">
        Các trường có dấu * là bắt buộc. Cung cấp file PDF hoặc đường dẫn HTTP/HTTPS.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="title">Tên / trích yếu *</Label>
          <Input id="title" name="title" required maxLength={500} defaultValue={document?.title} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reference_number">Số/ký hiệu *</Label>
          <Input
            id="reference_number"
            name="reference_number"
            required
            maxLength={100}
            defaultValue={document?.reference_number}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category_id">Loại văn bản *</Label>
          <select
            className={nativeSelectClass}
            id="category_id"
            name="category_id"
            required
            defaultValue={document?.category_id ?? ""}
          >
            <option value="" disabled>
              Chọn loại văn bản
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="issuing_authority">Cơ quan ban hành *</Label>
          <Input
            id="issuing_authority"
            name="issuing_authority"
            required
            maxLength={200}
            defaultValue={document?.issuing_authority}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="issued_date">Ngày ban hành</Label>
          <Input
            id="issued_date"
            name="issued_date"
            type="date"
            defaultValue={document?.issued_date ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="effective_date">Ngày hiệu lực *</Label>
          <Input
            id="effective_date"
            name="effective_date"
            type="date"
            required
            defaultValue={document?.effective_date}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Trạng thái hiệu lực *</Label>
          <select
            id="status"
            name="status"
            className={nativeSelectClass}
            defaultValue={document?.status ?? "pending"}
          >
            {Object.entries(documentStatuses).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="source_url">Link văn bản</Label>
          <Input
            id="source_url"
            name="source_url"
            type="url"
            maxLength={2048}
            placeholder="https://…"
            defaultValue={document?.source_url ?? ""}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="document-file">File PDF (tối đa {maxFileBytes / (1024 * 1024)} MB)</Label>
          <Input id="document-file" name="file" type="file" accept=".pdf,application/pdf" />
          {document?.file_name && (
            <p className="text-sm text-muted-foreground">
              File hiện có: {document.file_name}. Để trống để giữ file; chọn file mới để thay thế.
            </p>
          )}
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Ghi chú</Label>
          <Textarea id="notes" name="notes" maxLength={4000} defaultValue={document?.notes} />
        </div>
      </fieldset>
      <div className="flex gap-3">
        <Button type="submit" disabled={busy || !categories.length}>
          {busy ? "Đang lưu…" : "Lưu văn bản"}
        </Button>
        <Button asChild variant="outline">
          <Link href={document ? `/van-ban/${document.id}` : "/van-ban"}>Hủy</Link>
        </Button>
      </div>
    </form>
  );
}
