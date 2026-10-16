"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { nativeSelectClass } from "@/components/forms/legal-document-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PagedResult } from "@/lib/insights-contract";
import type { ChecklistSummary } from "@/lib/inspection-contract";
import type { LegalDocument } from "@/lib/legal-document-contract";
import { apiData, useApiData } from "@/lib/use-api-data";

interface DraftItem {
  key: number;
  content: string;
  guidance: string;
  legal_reference: string;
  is_required: boolean;
}

const emptyItem = (key: number): DraftItem => ({
  key,
  content: "",
  guidance: "",
  legal_reference: "",
  is_required: true,
});

/** UC-INS-06 — checklist with ordered items; the API re-checks role, permission and input. */
export function CreateChecklistForm({ canReadDocuments }: { canReadDocuments: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<DraftItem[]>([emptyItem(1)]);
  const [nextKey, setNextKey] = useState(2);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const existing = useApiData<{ items: ChecklistSummary[] }>("/api/inspection-checklists");
  const facilityTypes = [
    ...new Set(existing.data?.items.flatMap((c) => (c.facility_type ? [c.facility_type] : []))),
  ];

  const update = (key: number, change: Partial<DraftItem>) =>
    setItems((current) => current.map((i) => (i.key === key ? { ...i, ...change } : i)));
  function addItem() {
    setItems((current) => [...current, emptyItem(nextKey)]);
    setNextKey((k) => k + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    if (!value("name")) return setError("Vui lòng nhập tên checklist.");
    if (items.some((i) => !i.content.trim()))
      return setError("Mỗi nội dung kiểm tra cần có mô tả.");
    setBusy(true);
    try {
      const result = await apiData<{ checklist: ChecklistSummary }>("/api/inspection-checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: value("name"),
          facility_type: value("facility_type"),
          description: value("description"),
          legal_document_id: value("legal_document_id"),
          items: items.map(({ content, guidance, legal_reference, is_required }) => ({
            content: content.trim(),
            guidance: guidance.trim(),
            legal_reference: legal_reference.trim(),
            is_required,
          })),
        }),
      });
      toast.success(`Đã tạo checklist "${result.checklist.name}"`);
      router.push(`/kiem-tra/checklist?id=${encodeURIComponent(result.checklist.id)}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không tạo được checklist.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">
        Các trường có dấu * là bắt buộc. Để trống loại cơ sở nếu checklist áp dụng cho mọi cơ sở.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <fieldset disabled={busy} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="checklist-name">Tên checklist *</Label>
            <Input id="checklist-name" name="name" required maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="checklist-type">Loại cơ sở áp dụng</Label>
            <Input
              id="checklist-type"
              name="facility_type"
              maxLength={100}
              list="checklist-type-options"
              placeholder="Mọi loại cơ sở"
            />
            <datalist id="checklist-type-options">
              {facilityTypes.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="checklist-description">Mô tả</Label>
            <Textarea id="checklist-description" name="description" maxLength={2000} rows={2} />
          </div>
          {canReadDocuments && <GuidanceDocumentSelect />}
        </div>

        <fieldset className="space-y-3">
          <legend className="font-medium">Nội dung kiểm tra *</legend>
          <ol className="space-y-3">
            {items.map((item, index) => (
              <li key={item.key} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Nội dung {index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={items.length === 1}
                    onClick={() => setItems((current) => current.filter((i) => i.key !== item.key))}
                    aria-label={`Xóa nội dung ${index + 1}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`item-content-${item.key}`}>Nội dung *</Label>
                  <Input
                    id={`item-content-${item.key}`}
                    value={item.content}
                    required
                    maxLength={500}
                    onChange={(e) => update(item.key, { content: e.target.value })}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`item-guidance-${item.key}`}>Hướng dẫn kiểm tra</Label>
                    <Textarea
                      id={`item-guidance-${item.key}`}
                      value={item.guidance}
                      maxLength={2000}
                      rows={2}
                      onChange={(e) => update(item.key, { guidance: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`item-reference-${item.key}`}>Căn cứ áp dụng</Label>
                    <Input
                      id={`item-reference-${item.key}`}
                      value={item.legal_reference}
                      maxLength={500}
                      onChange={(e) => update(item.key, { legal_reference: e.target.value })}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={item.is_required}
                    onChange={(e) => update(item.key, { is_required: e.target.checked })}
                  />
                  Bắt buộc đánh giá trước khi hoàn thành cuộc kiểm tra
                </label>
              </li>
            ))}
          </ol>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            disabled={items.length >= 100}
          >
            <Plus />
            Thêm nội dung
          </Button>
        </fieldset>
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Đang tạo…" : "Tạo checklist"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/kiem-tra/checklist">Hủy</Link>
        </Button>
      </div>
    </form>
  );
}

function GuidanceDocumentSelect() {
  const documents = useApiData<PagedResult<LegalDocument>>("/api/legal-documents?pageSize=100");
  return (
    <div className="space-y-2 md:col-span-2">
      <Label htmlFor="checklist-document">Tài liệu hướng dẫn (kho văn bản)</Label>
      <select
        id="checklist-document"
        name="legal_document_id"
        defaultValue=""
        className={nativeSelectClass}
      >
        <option value="">{documents.loading ? "Đang tải văn bản…" : "Không gắn văn bản"}</option>
        {documents.data?.items.map((d) => (
          <option key={d.id} value={d.id}>
            {d.reference_number} — {d.title}
          </option>
        ))}
      </select>
      {documents.error && (
        <p role="alert" className="text-sm text-destructive">
          {documents.error}
        </p>
      )}
    </div>
  );
}
