"use client";

import * as React from "react";
import { Loader2, Mail, Pencil, Phone, Plus, RefreshCw, UserCog, Users } from "lucide-react";
import { CanBoForm } from "@/components/forms/can-bo-form";
import { OrganizationStatusForm } from "@/components/forms/organization-status-form";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar, type BoLoc } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { organizationApi, organizationErrorMessage } from "@/lib/organization-client";
import {
  officerStatusNames,
  organizationSelectClass,
  type OfficerList,
  type OrganizationOptions,
} from "@/lib/organization-contract";
import { formatNumber } from "@/lib/utils";
import { OfficerDetails } from "./officer-details";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0])
    .join("");
}

export function OfficerDirectory({ canCreate, canEdit }: { canCreate: boolean; canEdit: boolean }) {
  const [options, setOptions] = React.useState<OrganizationOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = React.useState(true);
  const [optionsError, setOptionsError] = React.useState<string | null>(null);
  const [list, setList] = React.useState<OfficerList | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [filters, setFilters] = React.useState<Record<string, string>>({
    unitId: "all",
    status: "all",
  });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [revision, setRevision] = React.useState(0);
  const reload = React.useCallback(() => setRevision((value) => value + 1), []);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  React.useEffect(() => {
    const controller = new AbortController();
    setOptionsLoading(true);
    setOptionsError(null);
    organizationApi<OrganizationOptions>("/api/organization/options", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setOptions(result);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setOptionsError(organizationErrorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setOptionsLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      q: query,
      page: String(page),
      pageSize: String(pageSize),
    });
    for (const key of ["status", "unitId"])
      if (filters[key] !== "all") params.set(key, filters[key]);
    organizationApi<OfficerList>(`/api/officers?${params}`, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setList(result);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(organizationErrorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, page, pageSize, filters, revision]);
  const filterOptions: BoLoc[] = [
    {
      key: "unitId",
      label: "Đơn vị",
      options: options?.units.map((unit) => ({ value: unit.id, label: unit.name })) ?? [],
      width: "w-[220px]",
    },
    {
      key: "status",
      label: "Trạng thái",
      options: Object.entries(officerStatusNames).map(([value, label]) => ({ value, label })),
      width: "w-[190px]",
    },
  ];
  const pageCount = Math.max(1, Math.ceil((list?.total ?? 0) / pageSize));
  const readyOptions = options && !optionsLoading && !optionsError;
  const paginationId = React.useId();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Danh bạ cán bộ"
        description="Hồ sơ, đơn vị, vai trò nghiệp vụ và trạng thái công tác của cán bộ trong phạm vi truy cập."
        module="M02"
        useCases={["UC-ORG-02"]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={reload}
              disabled={loading || optionsLoading}
            >
              <RefreshCw className={loading || optionsLoading ? "animate-spin" : ""} />
              Tải lại
            </Button>
            {canCreate &&
              readyOptions &&
              options.units.some((unit) => unit.status === "ACTIVE") && (
                <CanBoForm
                  options={options}
                  onSaved={reload}
                  trigger={
                    <Button size="sm">
                      <Plus />
                      Thêm cán bộ
                    </Button>
                  }
                />
              )}
          </>
        }
      />
      {optionsError && (
        <div role="alert" className="space-y-3 rounded-lg border p-4">
          <p className="text-destructive text-sm">Không tải được danh mục: {optionsError}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Thử lại
          </Button>
        </div>
      )}
      {readyOptions && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Tổng số cán bộ trong phạm vi"
            value={options.officers.length}
            icon={Users}
          />
          <StatCard
            label="Đang công tác"
            value={options.officers.filter((officer) => officer.status === "ACTIVE").length}
            icon={Users}
            tone="success"
          />
          <StatCard
            label="Đơn vị có thể chọn"
            value={options.units.length}
            icon={UserCog}
            tone="info"
          />
        </div>
      )}
      <Card className="gap-0 py-0">
        <div className="p-3">
          <FilterBar
            tuKhoa={search}
            onTuKhoa={setSearch}
            placeholder="Tìm theo họ tên, mã số, chức vụ, đơn vị…"
            boLoc={filterOptions}
            giaTri={filters}
            onDoiGiaTri={(key, value) => {
              setFilters((current) => ({ ...current, [key]: value }));
              setPage(1);
            }}
          />
        </div>
        {loading ? (
          <p role="status" className="flex items-center justify-center gap-2 p-10 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Đang tải danh sách cán bộ…
          </p>
        ) : error ? (
          <div role="alert" className="space-y-3 p-6">
            <p className="text-destructive text-sm">{error}</p>
            <Button variant="outline" onClick={reload}>
              Thử lại
            </Button>
          </div>
        ) : list?.items.length === 0 ? (
          <EmptyState icon={Users} />
        ) : (
          list && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cán bộ</TableHead>
                  <TableHead>Mã số</TableHead>
                  <TableHead>Chức vụ</TableHead>
                  <TableHead>Đơn vị</TableHead>
                  <TableHead>Liên hệ</TableHead>
                  <TableHead>Vai trò nghiệp vụ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.items.map((officer) => (
                  <TableRow key={`${officer.id}-${officer.updatedAt}-${officer.status}`}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {initials(officer.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{officer.fullName}</div>
                          <div className="text-muted-foreground text-xs">{officer.rank}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{officer.officerCode}</TableCell>
                    <TableCell className="text-[13px]">{officer.position}</TableCell>
                    <TableCell className="text-[13px]">{officer.unitName}</TableCell>
                    <TableCell>
                      <a
                        href={`tel:${officer.phone.replace(/[^+\d]/g, "")}`}
                        className="text-primary flex items-center gap-1.5 text-[13px] hover:underline"
                      >
                        <Phone className="size-3.5" />
                        {officer.phone}
                      </a>
                      <a
                        href={`mailto:${officer.email}`}
                        className="text-muted-foreground hover:text-primary flex items-center gap-1.5 text-xs"
                      >
                        <Mail className="size-3" />
                        {officer.email}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        title={
                          options?.roles.find((role) => role.code === officer.businessRole)?.name
                        }
                      >
                        {officer.businessRole}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={officer.status === "ACTIVE" ? "success" : "muted"}>
                        {officerStatusNames[officer.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <OfficerDetails officer={officer} roles={options?.roles ?? []} />
                        {canEdit && readyOptions && (
                          <>
                            <CanBoForm
                              canBo={officer}
                              options={options}
                              onSaved={reload}
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`Sửa ${officer.fullName}`}
                                  title={`Sửa ${officer.fullName}`}
                                >
                                  <Pencil />
                                </Button>
                              }
                            />
                            <OrganizationStatusForm
                              officer={officer}
                              onSaved={reload}
                              trigger={
                                <Button variant="outline" size="sm">
                                  Trạng thái
                                </Button>
                              }
                            />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        )}
        {list && !error && !loading && (
          <div className="flex flex-wrap items-center gap-3 border-t px-3 py-3 text-sm">
            <p className="text-muted-foreground mr-auto">
              {formatNumber(list.total)} kết quả · Trang {list.page}/{pageCount}
            </p>
            <Label htmlFor={paginationId} className="text-xs">
              Số dòng
            </Label>
            <select
              id={paginationId}
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className={`${organizationSelectClass} w-20`}
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => setPage((value) => value + 1)}
            >
              Sau
            </Button>
          </div>
        )}
        <p className="text-muted-foreground border-t px-3 py-2 text-xs">
          Trên thiết bị hỗ trợ, bấm số điện thoại để gọi trực tiếp.
        </p>
      </Card>
    </div>
  );
}
