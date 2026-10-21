"use client";

import * as React from "react";
import Link from "next/link";
import {
  Download,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  ReportExportRecord,
  ReportFormat,
  ReportOptions,
  ReportPreview,
  ReportTemplateRecord,
  ReportTypeRecord,
} from "@/lib/report-contract";
import { formatDate, formatNumber } from "@/lib/utils";

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(value: number | null) {
  if (!value) return "—";
  if (value < 1024) return `${value} B`;
  return `${Math.round(value / 1024)} KB`;
}

function periodText(record: ReportExportRecord) {
  if (!record.period_start || !record.period_end) return "Toàn bộ dữ liệu";
  return `${formatDate(record.period_start)} – ${formatDate(record.period_end)}`;
}

export function ReportExportClient({
  initialTypes,
  initialOptions,
  initialTemplates,
  canExport,
  maxRows,
}: {
  initialTypes: ReportTypeRecord[];
  initialOptions: ReportOptions;
  initialTemplates: ReportTemplateRecord[];
  canExport: boolean;
  maxRows: number;
}) {
  const [reportTypeId, setReportTypeId] = React.useState(initialTypes[0]?.code ?? "");
  const [from, setFrom] = React.useState(initialOptions.defaults.from);
  const [to, setTo] = React.useState(initialOptions.defaults.to);
  const [regionId, setRegionId] = React.useState("");
  const [officerId, setOfficerId] = React.useState("");
  const [format, setFormat] = React.useState<ReportFormat>(
    initialTypes[0]?.default_format ?? "xlsx",
  );
  const [templateId, setTemplateId] = React.useState("");
  const [preview, setPreview] = React.useState<ReportPreview | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [history, setHistory] = React.useState<ReportExportRecord[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(true);
  const [historyError, setHistoryError] = React.useState("");

  const selected = initialTypes.find((item) => item.code === reportTypeId) ?? initialTypes[0];
  const officers =
    selected?.scope_kind === "account"
      ? initialOptions.account_officers
      : initialOptions.facility_officers;
  const templates = initialTemplates.filter(
    (item) => item.report_type_id === selected?.id && item.format === format,
  );
  const selectedTemplate = templates.find((item) => item.id === templateId) ?? null;

  React.useEffect(() => {
    const next = initialTypes.find((item) => item.code === reportTypeId);
    if (!next) return;
    setFormat(next.default_format);
    setRegionId("");
    setOfficerId("");
    setTemplateId("");
    setPreview(null);
    setError("");
  }, [initialTypes, reportTypeId]);

  React.useEffect(() => {
    setTemplateId("");
  }, [format]);

  const loadHistory = React.useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const response = await fetch("/api/report-export/exports?pageSize=10", { cache: "no-store" });
      const body = (await response.json()) as {
        items?: ReportExportRecord[];
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể tải lịch sử kết xuất.");
      setHistory(body.items ?? []);
    } catch (failure) {
      setHistoryError(
        failure instanceof Error ? failure.message : "Không thể tải lịch sử kết xuất.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  function buildQuery(page = 1) {
    if (!selected) return "";
    const params = new URLSearchParams({
      reportTypeId: selected.code,
      format,
      page: String(page),
      pageSize: "20",
    });
    if (selected.supports_period) {
      params.set("from", from);
      params.set("to", to);
    }
    if (selected.supports_region && regionId) params.set("regionId", regionId);
    if (officerId) params.set("officerId", officerId);
    if (templateId) params.set("templateId", templateId);
    return params.toString();
  }

  async function loadPreview(page = 1) {
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/report-export/preview?${buildQuery(page)}`, {
        cache: "no-store",
      });
      const body = (await response.json()) as ReportPreview & {
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể tải dữ liệu xem trước.");
      setPreview(body);
    } catch (failure) {
      setPreview(null);
      setError(failure instanceof Error ? failure.message : "Không thể tải dữ liệu xem trước.");
    } finally {
      setLoading(false);
    }
  }

  async function exportReport() {
    if (!selected || !canExport) return;
    setExporting(true);
    setError("");
    try {
      const payload: Record<string, string> = {
        reportTypeId: selected.code,
        format,
      };
      if (selected.supports_period) {
        payload.from = from;
        payload.to = to;
      }
      if (selected.supports_region && regionId) payload.regionId = regionId;
      if (officerId) payload.officerId = officerId;
      if (templateId) payload.templateId = templateId;

      const response = await fetch("/api/report-export/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        item?: ReportExportRecord;
        error?: { message?: string };
      };
      if (!response.ok || !body.item)
        throw new Error(body.error?.message ?? "Không thể tạo file báo cáo.");

      toast.success("Đã tạo file báo cáo.", {
        description: `${body.item.row_count} dòng · ${formatBytes(body.item.file_size)}`,
      });
      await loadHistory();
      if (body.item.download_url) window.location.assign(body.item.download_url);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Không thể tạo file báo cáo.";
      setError(message);
      toast.error(message);
    } finally {
      setExporting(false);
    }
  }

  function resetFilters() {
    setFrom(initialOptions.defaults.from);
    setTo(initialOptions.defaults.to);
    setRegionId("");
    setOfficerId("");
    setTemplateId("");
    setPreview(null);
    setError("");
  }

  return (
    <div className="space-y-5">
      {!canExport && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Tài khoản hiện chỉ có quyền xem trước báo cáo. Liên hệ quản trị viên nếu cần quyền
          <strong className="font-semibold"> M08.export</strong>.
        </div>
      )}

      <SectionCard
        title="Cấu hình kết xuất"
        description="Bộ lọc được kiểm tra theo vai trò và phạm vi dữ liệu tại backend. Dữ liệu rỗng sẽ không tạo file."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Loại báo cáo</span>
            <select
              value={reportTypeId}
              onChange={(event) => setReportTypeId(event.target.value)}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              {initialTypes.map((item) => (
                <option key={item.id} value={item.code}>
                  {item.code} — {item.name}
                </option>
              ))}
            </select>
            {selected && (
              <span className="text-muted-foreground block text-xs">{selected.description}</span>
            )}
          </label>

          {selected?.supports_period ? (
            <>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Từ ngày</span>
                <input
                  type="date"
                  value={from}
                  max={to}
                  onChange={(event) => setFrom(event.target.value)}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Đến ngày</span>
                <input
                  type="date"
                  value={to}
                  min={from}
                  onChange={(event) => setTo(event.target.value)}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                />
              </label>
            </>
          ) : (
            <div className="text-muted-foreground flex items-end pb-2 text-sm sm:col-span-2">
              Báo cáo này kết xuất toàn bộ dữ liệu đang có, không áp dụng lọc thời gian.
            </div>
          )}

          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Định dạng file</span>
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value as ReportFormat)}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              {initialOptions.formats.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {selected?.supports_region && (
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Khu vực</span>
              <select
                value={regionId}
                onChange={(event) => setRegionId(event.target.value)}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="">Tất cả khu vực trong phạm vi</option>
                {initialOptions.regions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="space-y-1.5 text-sm">
            <span className="font-medium">
              {selected?.scope_kind === "account" ? "Cán bộ" : "Cán bộ phụ trách"}
            </span>
            <select
              value={officerId}
              onChange={(event) => setOfficerId(event.target.value)}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Tất cả cán bộ trong phạm vi</option>
              {officers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {"username" in item ? ` (${item.username})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Biểu mẫu</span>
            <select
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              disabled={templates.length === 0}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm disabled:opacity-60"
            >
              <option value="">
                {templates.length === 0
                  ? "Chưa có biểu mẫu cho định dạng này"
                  : "Mẫu dữ liệu chuẩn (không dùng biểu mẫu)"}
              </option>
              {templates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.is_official ? " · chính thức" : ""}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground block text-xs">
              {selectedTemplate
                ? `Tiêu đề: ${selectedTemplate.title || selectedTemplate.name}`
                : "Biểu mẫu chính thức chỉ dùng sau khi mẫu được xác nhận."}
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => void loadPreview(1)} disabled={loading || !selected}>
            {loading ? <Loader2 className="animate-spin" /> : <Eye />}
            {loading ? "Đang tải..." : "Xem trước"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={resetFilters}
            disabled={loading || exporting}
          >
            <RefreshCw />
            Đặt lại bộ lọc
          </Button>
          <Button
            type="button"
            onClick={() => void exportReport()}
            disabled={exporting || loading || !canExport || !selected}
          >
            {exporting ? <Loader2 className="animate-spin" /> : <FileDown />}
            {exporting ? "Đang tạo file..." : `Xuất ${format.toUpperCase()}`}
          </Button>
          <span className="text-muted-foreground ml-auto text-xs">
            Tối đa {formatNumber(maxRows)} dòng/lần. Thu hẹp bộ lọc nếu vượt giới hạn.
          </span>
        </div>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Xem trước dữ liệu"
        description="Bản xem trước dùng cùng bộ lọc và phạm vi dữ liệu với file kết xuất."
        action={
          preview ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{formatNumber(preview.total)} dòng</Badge>
              <Badge variant="outline">{preview.reportType.code}</Badge>
            </div>
          ) : null
        }
      >
        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
            <Loader2 className="animate-spin" />
            Đang tải dữ liệu xem trước...
          </div>
        ) : !preview ? (
          <EmptyState
            icon={Search}
            title="Chưa có bản xem trước"
            description="Chọn loại báo cáo và bộ lọc, sau đó bấm “Xem trước” để kiểm tra dữ liệu trước khi kết xuất."
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {preview.summary.map((item) => (
                <Card key={item.label} className="gap-1 p-4">
                  <p className="text-muted-foreground text-xs font-medium">{item.label}</p>
                  <p className="text-2xl font-bold tracking-tight">
                    {typeof item.value === "number" ? formatNumber(item.value) : item.value}
                    {item.unit === "%" ? "%" : item.unit ? ` ${item.unit}` : ""}
                  </p>
                </Card>
              ))}
            </div>

            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1">
                <Filter className="size-3.5" />
                {preview.period
                  ? `${formatDate(preview.period.from)} – ${formatDate(preview.period.to)}`
                  : "Toàn bộ dữ liệu"}
              </span>
              {preview.filters.regionName && <span>Khu vực: {preview.filters.regionName}</span>}
              {preview.filters.officerName && <span>Cán bộ: {preview.filters.officerName}</span>}
              <span>Tạo lúc: {formatDateTime(preview.generatedAt)}</span>
            </div>

            {preview.total === 0 ? (
              <EmptyState
                title="Không có dữ liệu phù hợp"
                description="Thử bỏ bớt bộ lọc hoặc chọn khoảng thời gian khác."
              />
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {preview.columns.map((column) => (
                          <TableHead
                            key={column.key}
                            className={column.numeric ? "text-right" : undefined}
                          >
                            {column.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.rows.map((row, rowIndex) => (
                        <TableRow key={`${preview.page}-${rowIndex}`}>
                          {preview.columns.map((column) => (
                            <TableCell
                              key={column.key}
                              className={column.numeric ? "text-right tabular-nums" : undefined}
                            >
                              {row[column.key] ?? "—"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-muted-foreground text-xs">
                    Trang {preview.page} · Hiển thị tối đa {preview.pageSize} dòng trong tổng số{" "}
                    {formatNumber(preview.total)} dòng.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={preview.page <= 1 || loading}
                      onClick={() => void loadPreview(preview.page - 1)}
                    >
                      Trang trước
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={preview.page * preview.pageSize >= preview.total || loading}
                      onClick={() => void loadPreview(preview.page + 1)}
                    >
                      Trang sau
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Lịch sử kết xuất"
        description="Mỗi file đã tạo được lưu để tải lại và đối chiếu. Người xem chỉ thấy lịch sử của mình; quản trị viên toàn hệ thống thấy tất cả."
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadHistory()}
            disabled={historyLoading}
          >
            <RefreshCw className={historyLoading ? "animate-spin" : ""} />
            Làm mới
          </Button>
        }
      >
        {historyLoading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
            <Loader2 className="animate-spin" />
            Đang tải lịch sử...
          </div>
        ) : historyError ? (
          <p role="alert" className="text-destructive text-sm">
            {historyError}
          </p>
        ) : history.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Chưa có lần kết xuất nào"
            description="File Excel/PDF sau khi tạo sẽ xuất hiện tại đây để tải lại."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời điểm</TableHead>
                  <TableHead>Báo cáo</TableHead>
                  <TableHead>Kỳ dữ liệu</TableHead>
                  <TableHead>Định dạng</TableHead>
                  <TableHead className="text-right">Số dòng</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">File</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(item.exported_at)}
                      <span className="text-muted-foreground block text-xs">
                        {item.exporter_name}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-52">
                      <span className="font-medium">{item.report_type_name}</span>
                      <span className="text-muted-foreground block text-xs">
                        {item.report_type_code}
                        {item.template_name ? ` · ${item.template_name}` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{periodText(item)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        {item.format === "xlsx" ? (
                          <FileSpreadsheet className="size-3.5" />
                        ) : (
                          <FileText className="size-3.5" />
                        )}
                        {item.format.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.row_count}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === "completed" ? "success" : "danger"}>
                        {item.status === "completed" ? "Thành công" : "Thất bại"}
                      </Badge>
                      {item.error_message && (
                        <span className="text-muted-foreground mt-1 block max-w-48 text-xs">
                          {item.error_message}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.download_url ? (
                        <Button asChild variant="outline" size="sm">
                          <a href={item.download_url}>
                            <Download />
                            Tải
                          </a>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                      <span className="text-muted-foreground mt-1 block text-xs">
                        {formatBytes(item.file_size)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <p className="text-muted-foreground text-xs">
        Cần xem danh mục báo cáo và deadline?{" "}
        <Link href="/bao-cao" className="text-primary hover:underline">
          Mở danh mục báo cáo
        </Link>
        .
      </p>
    </div>
  );
}
