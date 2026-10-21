"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import type { ChecklistItem, ChecklistSummary } from "@/lib/inspection-contract";
import { useApiData } from "@/lib/use-api-data";

/** UC-INS-06 — open a checklist and its inspection guidance. */
export function ChecklistLibrary({
  canCreate,
  initialId,
}: {
  canCreate: boolean;
  initialId: string | null;
}) {
  const list = useApiData<{ items: ChecklistSummary[] }>("/api/inspection-checklists");
  const [selected, setSelected] = useState<string | null>(initialId);
  const activeId = selected ?? list.data?.items[0]?.id ?? null;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Checklist & hướng dẫn kiểm tra"
        description="Nội dung kiểm tra theo loại cơ sở, kèm hướng dẫn và căn cứ áp dụng. Chỉ huy và Phó chỉ huy được tạo checklist mới."
        module="M06"
        useCases={["UC-INS-06"]}
        actions={
          canCreate ? (
            <Button asChild size="sm">
              <Link href="/kiem-tra/checklist/tao">
                <Plus />
                Tạo checklist
              </Link>
            </Button>
          ) : undefined
        }
      />
      {list.loading && <p role="status">Đang tải checklist…</p>}
      {list.error && (
        <div role="alert" className="space-y-2 text-destructive">
          <p>{list.error}</p>
          <Button variant="outline" onClick={list.reload}>
            Thử lại
          </Button>
        </div>
      )}
      {list.data && !list.data.items.length && (
        <p role="status" className="text-muted-foreground">
          Chưa có checklist đang áp dụng.
        </p>
      )}
      {list.data && activeId && (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <nav aria-label="Danh sách checklist" className="space-y-2">
            {list.data.items.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-current={c.id === activeId}
                onClick={() => setSelected(c.id)}
                className="w-full rounded-lg border bg-card p-3 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=true]:border-primary"
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {c.facility_type ?? "Mọi loại cơ sở"} · {c.item_count} nội dung
                </div>
              </button>
            ))}
          </nav>
          <ChecklistGuide id={activeId} />
        </div>
      )}
    </div>
  );
}

export function ChecklistGuide({ id }: { id: string }) {
  const detail = useApiData<{
    checklist: ChecklistSummary;
    items: ChecklistItem[];
  }>(`/api/inspection-checklists/${encodeURIComponent(id)}`);
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      {detail.loading && <p role="status">Đang tải nội dung checklist…</p>}
      {detail.error && (
        <p role="alert" className="text-destructive">
          {detail.error}
        </p>
      )}
      {detail.data && (
        <>
          <h2 className="text-lg font-semibold">{detail.data.checklist.name}</h2>
          {detail.data.checklist.description && (
            <p className="text-sm text-muted-foreground">{detail.data.checklist.description}</p>
          )}
          {detail.data.checklist.legal_document_id && (
            <Link
              className="text-sm text-primary underline"
              href={`/van-ban/${detail.data.checklist.legal_document_id}`}
            >
              Tài liệu hướng dẫn: {detail.data.checklist.legal_document_title}
            </Link>
          )}
          <ol className="space-y-3">
            {detail.data.items.map((item) => (
              <li key={item.id} className="rounded-lg border p-3">
                <div className="font-medium">
                  {item.position}. {item.content}
                  {item.is_required ? (
                    <span className="ml-1 text-destructive" title="Bắt buộc">
                      *
                    </span>
                  ) : null}
                </div>
                {item.guidance && (
                  <p className="mt-1 text-sm text-muted-foreground">Hướng dẫn: {item.guidance}</p>
                )}
                {item.legal_reference && (
                  <p className="text-xs text-muted-foreground">Căn cứ: {item.legal_reference}</p>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
