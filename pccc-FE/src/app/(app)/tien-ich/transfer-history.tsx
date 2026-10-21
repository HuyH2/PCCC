"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/shared/section-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

type TransferJob = {
  id: string;
  direction: "import" | "export";
  dataset_id: string;
  file_name: string;
  file_format: string;
  status: string;
  total_records: number;
  successful_records: number;
  error_count: number;
  actor_name: string;
  created_at: number;
};

const statusLabels: Record<string, string> = {
  validating: "Đang kiểm tra",
  preview_ready: "Chờ xác nhận",
  importing: "Đang nhập",
  succeeded: "Thành công",
  partial: "Một phần thành công",
  failed: "Thất bại",
};

export function TransferHistory({ direction }: { direction?: "import" | "export" }) {
  const [jobs, setJobs] = useState<TransferJob[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    try {
      const query = direction ? `?direction=${direction}&pageSize=20` : "?pageSize=20";
      const response = await fetch(`/api/data-transfers${query}`, { cache: "no-store", signal });
      const parsed = await response.json().catch(() => ({}));
      const body = (parsed && typeof parsed === "object" ? parsed : {}) as { error?: { message?: string }; items?: TransferJob[] };
      if (!response.ok) throw new Error(body.error?.message ?? "Không tải được lịch sử.");
      if (signal.aborted) return;
      setJobs(Array.isArray(body.items) ? body.items : []);
      setError("");
    } catch (cause) {
      if (signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Không tải được lịch sử.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [direction]);

  useEffect(() => {
    const controller = new AbortController();
    void loadHistory(controller.signal);
    return () => controller.abort();
  }, [loadHistory]);

  return (
    <SectionCard title={direction === "import" ? "Lịch sử import" : direction === "export" ? "Lịch sử export" : "Lịch sử truyền dữ liệu"}
      description="Các lần xử lý đã được ghi nhận trong hệ thống." contentClassName="px-0 pb-0">
      {error ? <p role="status" className="px-4 pb-4 text-sm text-muted-foreground">{error}</p> : null}
      {!error && loading ? <p className="px-4 pb-4 text-sm text-muted-foreground">Đang tải lịch sử...</p> : null}
      {!error && !loading && jobs.length === 0 ? <p className="px-4 pb-4 text-sm text-muted-foreground">Chưa có lịch sử.</p> : null}
      {jobs.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Thời gian</TableHead><TableHead>Loại dữ liệu</TableHead><TableHead>Tệp</TableHead>
              <TableHead>Người thực hiện</TableHead><TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Bản ghi</TableHead><TableHead className="text-right">Lỗi</TableHead>
            </TableRow></TableHeader>
            <TableBody>{jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="whitespace-nowrap">{formatDate(new Date(job.created_at).toISOString())}</TableCell>
                <TableCell>{job.dataset_id}</TableCell><TableCell className="font-mono text-xs">{job.file_name}</TableCell>
                <TableCell>{job.actor_name}</TableCell>
                <TableCell><Badge variant={job.status === "succeeded" ? "success" : job.status === "failed" ? "danger" : "secondary"}>{statusLabels[job.status] ?? job.status}</Badge></TableCell>
                <TableCell className="text-right tabular-nums">{job.successful_records}/{job.total_records}</TableCell>
                <TableCell className="text-right tabular-nums">{job.error_count || "—"}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>
      ) : null}
    </SectionCard>
  );
}
