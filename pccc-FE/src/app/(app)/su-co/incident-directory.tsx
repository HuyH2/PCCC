"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, Plus, RefreshCw, Siren } from "lucide-react";
import { SuCoForm } from "@/components/forms/su-co-form";
import {
  DeadlineBadge,
  IncidentError,
  IncidentLoading,
  IncidentState,
  useIncidentOptions,
} from "@/components/incidents/incident-ui";
import { DataPagination } from "@/components/shared/data-pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar, type BoLoc } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
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
import { incidentApi, incidentErrorMessage } from "@/lib/incident-client";
import {
  deadlineWarningNames,
  incidentTime,
  incidentTypeNames,
  processingStatusNames,
  type IncidentList,
  type IncidentPermissions,
} from "@/lib/incident-contract";

export function IncidentDirectory({
  permissions,
  initialFilters = {},
}: {
  permissions: IncidentPermissions;
  initialFilters?: Record<string, string>;
}) {
  const [revision, setRevision] = React.useState(0);
  const reload = React.useCallback(() => setRevision((current) => current + 1), []);
  const { options, error: optionsError } = useIncidentOptions(revision);
  const [list, setList] = React.useState<IncidentList | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState(initialFilters.search ?? "");
  const [query, setQuery] = React.useState(search);
  const [filters, setFilters] = React.useState<Record<string, string>>({
    incidentType: "all",
    regionId: "all",
    processingStatus: "all",
    recordStatus: "all",
    deadlineWarning: "all",
    ...initialFilters,
  });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [from, setFrom] = React.useState(initialFilters.from ?? "");
  const [to, setTo] = React.useState(initialFilters.to ?? "");
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      search: query,
      page: String(page),
      pageSize: String(pageSize),
    });
    for (const key of [
      "incidentType",
      "regionId",
      "processingStatus",
      "recordStatus",
      "deadlineWarning",
    ])
      if (filters[key] && filters[key] !== "all") params.set(key, filters[key]);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    incidentApi<IncidentList>(`/api/incidents?${params}`, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setList(result);
          if (result.total > 0 && page > Math.ceil(result.total / pageSize))
            setPage(Math.ceil(result.total / pageSize));
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(incidentErrorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, filters, from, to, page, pageSize, revision]);
  const filterOptions: BoLoc[] = [
    {
      key: "incidentType",
      label: "Loại sự cố",
      options: (options?.incidentTypes ?? []).map((type) => ({
        value: type.code,
        label: type.name,
      })),
    },
    {
      key: "regionId",
      label: "Khu vực",
      options: (options?.regions ?? []).map((region) => ({ value: region.id, label: region.name })),
    },
    {
      key: "processingStatus",
      label: "Tiến độ",
      options: Object.entries(processingStatusNames).map(([value, label]) => ({ value, label })),
    },
    {
      key: "recordStatus",
      label: "Hồ sơ",
      options: [
        { value: "DRAFT", label: "Nháp" },
        { value: "OFFICIAL", label: "Chính thức" },
      ],
    },
    {
      key: "deadlineWarning",
      label: "Deadline",
      options: Object.entries(deadlineWarningNames).map(([value, label]) => ({ value, label })),
    },
  ];
  return (
    <div className="space-y-5">
      <PageHeader
        title="Sự cố cháy, nổ và CNCH"
        description="Ghi nhận, xử lý hồ sơ và theo dõi deadline trong phạm vi dữ liệu được cấp."
        module="M09"
        useCases={["UC-INC-01", "UC-INC-02", "UC-INC-03", "UC-INC-04", "UC-INC-05", "UC-INC-06"]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
              <RefreshCw />
              Tải lại
            </Button>
            {permissions.statistics && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/su-co/thong-ke">
                  <BarChart3 />
                  Thống kê R09/R10
                </Link>
              </Button>
            )}
            {permissions.create && options && !optionsError && (
              <SuCoForm
                options={options}
                onSaved={reload}
                trigger={
                  <Button size="sm">
                    <Plus />
                    Ghi nhận sự cố
                  </Button>
                }
              />
            )}
          </>
        }
      />
      {optionsError && (
        <IncidentError message={`Không tải được danh mục: ${optionsError}`} retry={reload} />
      )}
      <Card className="gap-0 py-0">
        <div className="space-y-3 p-3">
          <FilterBar
            tuKhoa={search}
            onTuKhoa={setSearch}
            placeholder="Tìm mã, tiêu đề, địa chỉ, mô tả…"
            boLoc={filterOptions}
            giaTri={filters}
            onDoiGiaTri={(key, value) => {
              setFilters((current) => ({ ...current, [key]: value }));
              setPage(1);
            }}
          />
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="incident-from" className="text-xs">
                Xảy ra từ ngày
              </Label>
              <Input
                id="incident-from"
                type="date"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="incident-to" className="text-xs">
                Đến hết ngày
              </Label>
              <Input
                id="incident-to"
                type="date"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            {(from || to) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setPage(1);
                }}
              >
                Xóa kỳ
              </Button>
            )}
            <p className="text-muted-foreground text-xs">Ngày theo múi giờ Việt Nam.</p>
          </div>
        </div>
        {loading ? (
          <IncidentLoading>Đang tải danh sách sự cố…</IncidentLoading>
        ) : error ? (
          <IncidentError message={error} retry={reload} />
        ) : !list?.items.length ? (
          <EmptyState
            icon={Siren}
            description="Chưa có hồ sơ trong phạm vi hoặc bộ lọc hiện tại."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã / tiêu đề</TableHead>
                <TableHead>Loại / thời điểm</TableHead>
                <TableHead>Địa điểm / khu vực</TableHead>
                <TableHead>Cán bộ xử lý</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Hồ sơ / tiến độ</TableHead>
                <TableHead>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.items.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell>
                    <Link
                      className="text-primary font-mono text-xs hover:underline"
                      href={`/su-co/${encodeURIComponent(incident.id)}`}
                    >
                      {incident.incidentCode}
                    </Link>
                    <p className="max-w-52 truncate text-sm">
                      {incident.title || "Chưa có tiêu đề"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">
                      {incident.incidentType
                        ? options?.incidentTypes.find((type) => type.code === incident.incidentType)
                            ?.name ||
                          incidentTypeNames[incident.incidentType] ||
                          incident.incidentType
                        : "Chưa phân loại"}
                    </p>
                    <p className="text-muted-foreground whitespace-nowrap text-xs">
                      {incidentTime(incident.occurredAt)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="max-w-60 truncate text-sm" title={incident.address}>
                      {incident.address || "Chưa có địa điểm"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {incident.regionName || "Chưa chọn khu vực"}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-40 text-xs">
                    {incident.assignments
                      ?.filter((assignment) => assignment.status !== "CANCELLED")
                      .map((assignment) => assignment.officerName)
                      .join(", ") || "Chưa phân công"}
                  </TableCell>
                  <TableCell>
                    <p className="mb-1 whitespace-nowrap text-xs">
                      {incidentTime(incident.deadlineAt)}
                    </p>
                    <DeadlineBadge incident={incident} />
                  </TableCell>
                  <TableCell>
                    <IncidentState incident={incident} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/su-co/${encodeURIComponent(incident.id)}`}>Chi tiết</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {list && !loading && !error && (
          <DataPagination
            tong={list.total}
            trang={page}
            soDong={pageSize}
            onDoiTrang={setPage}
            onDoiSoDong={setPageSize}
          />
        )}
        <p className="text-muted-foreground border-t px-3 py-2 text-xs">
          Tiến độ và cảnh báo deadline được hiển thị riêng. Danh mục và cấu hình thời hạn Q11 cần
          đơn vị xác nhận.
        </p>
      </Card>
    </div>
  );
}
