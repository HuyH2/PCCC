"use client";
import { useState } from "react";
import { AuditHistory } from "@/components/shared/audit-history";
import { DataPagination } from "@/components/shared/data-pagination";
import { Button } from "@/components/ui/button";
import type { AuditEntry } from "@/lib/legal-document-contract";
import type { PagedResult } from "@/lib/insights-contract";
import { useApiData } from "@/lib/use-api-data";
export function DocumentHistory({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const result = useApiData<PagedResult<AuditEntry>>(
    `/api/legal-documents/${id}/history?page=${page}&pageSize=${pageSize}`,
  );
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Lịch sử thay đổi</h2>
      {result.loading && <p role="status">Đang tải lịch sử…</p>}
      {result.error && (
        <p role="alert">
          {result.error}{" "}
          <Button variant="outline" onClick={result.reload}>
            Thử lại
          </Button>
        </p>
      )}
      {result.data &&
        (result.data.items.length ? (
          <AuditHistory entries={result.data.items} />
        ) : (
          <p>Chưa có lịch sử thay đổi.</p>
        ))}
      {result.data && (
        <DataPagination
          tong={result.data.total}
          trang={page}
          soDong={pageSize}
          onDoiTrang={setPage}
          onDoiSoDong={setPageSize}
        />
      )}
    </section>
  );
}
