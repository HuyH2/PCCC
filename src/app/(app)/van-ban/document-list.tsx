"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { DataPagination } from "@/components/shared/data-pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  documentStatuses,
  type DocumentCategory,
  type LegalDocument,
} from "@/lib/legal-document-contract";
import type { PagedResult } from "@/lib/insights-contract";
import { useApiData } from "@/lib/use-api-data";
import { nativeSelectClass } from "@/components/forms/legal-document-editor";

export function DocumentList({ canCreate }: { canCreate: boolean }) {
  const [filters, setFilters] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const categories = useApiData<{ items: DocumentCategory[] }>("/api/legal-document-categories");
  const result = useApiData<PagedResult<LegalDocument>>(
    `/api/legal-documents?page=${page}&pageSize=${pageSize}&${filters}`,
  );
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFilters(
      new URLSearchParams({
        q: String(form.get("q") ?? ""),
        categoryId: String(form.get("categoryId") ?? ""),
        status: String(form.get("status") ?? ""),
      }).toString(),
    );
    setPage(1);
  }
  return (
    <div className="space-y-5">
      <PageHeader
        title="Kho văn bản pháp luật & quy chuẩn"
        description="Tra cứu và quản lý văn bản dùng chung. Trạng thái hiệu lực do người có quyền cập nhật."
        module="M05"
        useCases={["UC-DOC-01", "UC-DOC-02"]}
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/van-ban/them">Thêm văn bản</Link>
            </Button>
          ) : undefined
        }
      />
      <Card className="gap-0 py-0">
        <form
          onSubmit={search}
          className="grid items-end gap-3 border-b p-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <div className="space-y-2">
            <Label htmlFor="document-q">Tên / số ký hiệu</Label>
            <Input id="document-q" name="q" maxLength={200} placeholder="Tìm văn bản…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="document-category">Loại văn bản</Label>
            <select id="document-category" name="categoryId" className={nativeSelectClass}>
              <option value="">Tất cả loại</option>
              {categories.data?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="document-status">Trạng thái hiệu lực</Label>
            <select id="document-status" name="status" className={nativeSelectClass}>
              <option value="">Tất cả trạng thái</option>
              {Object.entries(documentStatuses).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">Tìm kiếm / Lọc</Button>
        </form>
        {categories.error && (
          <p role="alert" className="p-3 text-destructive">
            {categories.error}{" "}
            <Button variant="outline" onClick={categories.reload}>
              Tải lại danh mục
            </Button>
          </p>
        )}
        {result.loading && (
          <p role="status" className="p-5">
            Đang tải văn bản…
          </p>
        )}
        {result.error && (
          <div role="alert" className="space-y-2 p-5 text-destructive">
            <p>{result.error}</p>
            <Button variant="outline" onClick={result.reload}>
              Thử lại
            </Button>
          </div>
        )}
        {result.data &&
          (result.data.items.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Số/ký hiệu</TableHead>
                  <TableHead>Tên văn bản</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Cơ quan ban hành</TableHead>
                  <TableHead>Ngày hiệu lực</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.items.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.reference_number}</TableCell>
                    <TableCell className="min-w-56">
                      <Link
                        className="font-medium text-primary underline"
                        href={`/van-ban/${d.id}`}
                      >
                        {d.title}
                      </Link>
                    </TableCell>
                    <TableCell>{d.category_name}</TableCell>
                    <TableCell>{d.issuing_authority}</TableCell>
                    <TableCell>{d.effective_date.split("-").reverse().join("/")}</TableCell>
                    <TableCell>{documentStatuses[d.status]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p role="status" className="p-5 text-muted-foreground">
              Không có văn bản phù hợp.
            </p>
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
      </Card>
    </div>
  );
}
