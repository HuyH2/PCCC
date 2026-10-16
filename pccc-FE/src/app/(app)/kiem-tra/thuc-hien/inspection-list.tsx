"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataPagination } from "@/components/shared/data-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { nativeSelectClass } from "@/components/forms/legal-document-editor";
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
  formatIsoDate,
  inspectionKinds,
  inspectionOutcomes,
  inspectionStatuses,
  type Inspection,
} from "@/lib/inspection-contract";
import type { PagedResult } from "@/lib/insights-contract";
import { useApiData } from "@/lib/use-api-data";

export function InspectionList({ canCreate }: { canCreate: boolean }) {
  const [filters, setFilters] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const result = useApiData<PagedResult<Inspection>>(
    `/api/inspections?page=${page}&pageSize=${pageSize}&${filters}`,
  );
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFilters(
      new URLSearchParams({
        q: String(form.get("q") ?? ""),
        status: String(form.get("status") ?? ""),
        kind: String(form.get("kind") ?? ""),
      }).toString(),
    );
    setPage(1);
  }
  return (
    <div className="space-y-5">
      <PageHeader
        title="Thực hiện kiểm tra"
        description="Thực hiện checklist, lập biên bản, cập nhật kết quả, kết luận và hậu kiểm cho các cuộc kiểm tra trong phạm vi được giao."
        module="M06"
        useCases={["UC-INS-07", "UC-INS-08", "UC-INS-09"]}
        actions={
          canCreate ? (
            <Button asChild size="sm">
              <Link href="/kiem-tra/thuc-hien/tao">
                <Plus />
                Tạo kiểm tra đột xuất / chuyên đề
              </Link>
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
            <Label htmlFor="inspection-q">Mã / tên cơ sở</Label>
            <Input id="inspection-q" name="q" maxLength={200} placeholder="Tìm cuộc kiểm tra…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inspection-status">Trạng thái</Label>
            <select id="inspection-status" name="status" className={nativeSelectClass}>
              <option value="">Tất cả trạng thái</option>
              {Object.entries(inspectionStatuses).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inspection-kind">Loại kiểm tra</Label>
            <select id="inspection-kind" name="kind" className={nativeSelectClass}>
              <option value="">Tất cả loại</option>
              {Object.entries(inspectionKinds).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">Tìm kiếm / Lọc</Button>
        </form>
        {result.loading && (
          <p role="status" className="p-5">
            Đang tải cuộc kiểm tra…
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
                  <TableHead>Mã</TableHead>
                  <TableHead>Cơ sở</TableHead>
                  <TableHead>Ngày kiểm tra</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Trưởng đoàn</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Kết quả</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      <Link
                        className="font-medium text-primary underline"
                        href={`/kiem-tra/thuc-hien/${i.id}`}
                      >
                        {i.code}
                      </Link>
                    </TableCell>
                    <TableCell className="min-w-56">
                      <div className="font-medium">{i.facility_name}</div>
                      <div className="truncate text-xs text-muted-foreground">{i.region_name}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatIsoDate(i.scheduled_date)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={inspectionKinds[i.kind]} />
                      {i.topic && <div className="text-xs text-muted-foreground">{i.topic}</div>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {i.lead_officer_name ?? i.lead_officer_id}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={inspectionStatuses[i.status]} />
                    </TableCell>
                    <TableCell>
                      {i.outcome ? (
                        <StatusBadge value={inspectionOutcomes[i.outcome]} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p role="status" className="p-5 text-muted-foreground">
              Không có cuộc kiểm tra phù hợp trong phạm vi được giao.
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
