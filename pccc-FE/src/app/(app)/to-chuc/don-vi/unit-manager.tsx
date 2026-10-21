"use client";

import * as React from "react";
import { Building, Eye, Loader2, Pencil, Plus, RefreshCw, Users } from "lucide-react";
import { DonViForm } from "@/components/forms/don-vi-form";
import { OrganizationStatusForm } from "@/components/forms/organization-status-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { organizationApi, organizationErrorMessage } from "@/lib/organization-client";
import {
  organizationLevelNames,
  organizationPath,
  type OrganizationNode,
  type OrganizationOptions,
  type OrganizationTree,
} from "@/lib/organization-contract";
import { formatNumber } from "@/lib/utils";

function UnitDetails({ node }: { node: OrganizationNode }) {
  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<OrganizationNode | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDetail(null);
    organizationApi<{ unit?: OrganizationNode; region?: OrganizationNode }>(
      organizationPath(node),
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) setDetail(result.unit ?? result.region ?? null);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(organizationErrorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, node, revision]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          title={`Chi tiết ${node.name}`}
          aria-label={`Chi tiết ${node.name}`}
        >
          <Eye />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Chi tiết đơn vị</DialogTitle>
          <DialogDescription>{node.name}</DialogDescription>
        </DialogHeader>
        {loading && (
          <p role="status" className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Đang tải thông tin…
          </p>
        )}
        {error && (
          <div role="alert" className="space-y-3">
            <p className="text-destructive text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={() => setRevision((value) => value + 1)}>
              Thử lại
            </Button>
          </div>
        )}
        {detail && (
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {[
              ["Mã đơn vị", detail.code],
              ["Tên đơn vị", detail.name],
              ["Cấp", organizationLevelNames[detail.level]],
              ["Đơn vị cha", detail.parentName ?? "Nút gốc"],
              [
                "Người phụ trách",
                detail.leaderHidden ? "Ngoài phạm vi xem" : (detail.leaderName ?? "Chưa gán"),
              ],
              ["Trạng thái", detail.status === "ACTIVE" ? "Hoạt động" : "Ngưng hoạt động"],
              ["Số cán bộ", formatNumber(detail.officerCount)],
              ["Số cơ sở", formatNumber(detail.facilityCount)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground text-xs">{label}</dt>
                <dd className="mt-1 break-words font-medium">{value}</dd>
              </div>
            ))}
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground text-xs">Ghi chú</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words">{detail.notes || "—"}</dd>
            </div>
          </dl>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UnitBranch({
  node,
  nodes,
  depth,
  options,
  canEdit,
  onSaved,
}: {
  node: OrganizationNode;
  nodes: OrganizationNode[];
  depth: number;
  options: OrganizationOptions;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const children = nodes.filter((item) => item.parentId === node.id);
  const editable = canEdit && !node.readOnly && node.level !== "ROOT";
  return (
    <li>
      <div
        className="hover:bg-accent/50 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-3 transition-colors"
        style={{ marginLeft: Math.min(depth, 3) * 12 }}
      >
        <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Building className="size-4" />
        </span>
        <div className="min-w-0 flex-1 basis-40">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-words font-semibold">{node.name}</span>
            <Badge variant="outline" className="font-mono text-[11px]">
              {node.code}
            </Badge>
            <Badge variant="secondary">{organizationLevelNames[node.level]}</Badge>
            {node.readOnly && <span className="text-muted-foreground text-xs">Chỉ xem</span>}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {node.parentName && `Thuộc: ${node.parentName} · `}
            {node.leaderHidden
              ? "Người phụ trách ngoài phạm vi xem"
              : node.leaderName
                ? `Phụ trách: ${node.leaderName}`
                : "Chưa gán người phụ trách"}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {formatNumber(node.officerCount)} cán bộ · {formatNumber(node.facilityCount)} cơ sở
            {node.legacyParent ? " · Quan hệ khu vực hiện có" : ""}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <StatusBadge value={node.status === "ACTIVE" ? "Hoạt động" : "Ngưng hoạt động"} />
          <UnitDetails node={node} />
          {editable && (
            <>
              <DonViForm
                donVi={node}
                options={options}
                onSaved={onSaved}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    title={`Sửa ${node.name}`}
                    aria-label={`Sửa ${node.name}`}
                  >
                    <Pencil />
                  </Button>
                }
              />
              <OrganizationStatusForm
                node={node}
                onSaved={onSaved}
                trigger={
                  <Button variant="outline" size="sm">
                    {node.status === "ACTIVE" ? "Ngưng hoạt động" : "Khôi phục"}
                  </Button>
                }
              />
            </>
          )}
        </div>
      </div>
      {children.length > 0 && (
        <ul className="mt-2 space-y-2">
          {children.map((child) => (
            <UnitBranch
              key={`${child.kind}-${child.id}`}
              node={child}
              nodes={nodes}
              depth={depth + 1}
              options={options}
              canEdit={canEdit}
              onSaved={onSaved}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function UnitManager({ canCreate, canEdit }: { canCreate: boolean; canEdit: boolean }) {
  const [tree, setTree] = React.useState<OrganizationTree | null>(null);
  const [options, setOptions] = React.useState<OrganizationOptions | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [revision, setRevision] = React.useState(0);
  const reload = React.useCallback(() => setRevision((value) => value + 1), []);
  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      organizationApi<OrganizationTree>("/api/organization/tree", { signal: controller.signal }),
      organizationApi<OrganizationOptions>("/api/organization/options", {
        signal: controller.signal,
      }),
    ])
      .then(([nextTree, nextOptions]) => {
        if (controller.signal.aborted) return;
        setTree(nextTree);
        setOptions(nextOptions);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(organizationErrorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  const roots =
    tree?.items.filter(
      (node) => !node.parentId || !tree.items.some((parent) => parent.id === node.parentId),
    ) ?? [];
  const ready = !loading && !error && tree && options;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cơ cấu đơn vị / Ban chỉ huy"
        description="Tỉnh/Thành phố (PC07) → Khu vực → Phường → Khu phố. Danh mục cấp gốc chỉ xem."
        module="M02"
        useCases={["UC-ORG-01"]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin" : ""} />
              Tải lại
            </Button>
            {ready &&
              canCreate &&
              tree.permissions.create &&
              options.units.some((unit) => unit.status === "ACTIVE") && (
                <DonViForm
                  options={options}
                  onSaved={reload}
                  trigger={
                    <Button size="sm">
                      <Plus />
                      Thêm đơn vị
                    </Button>
                  }
                />
              )}
          </>
        }
      />
      {loading && (
        <p role="status" className="flex items-center gap-2 rounded-lg border p-5 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Đang tải cây đơn vị…
        </p>
      )}
      {error && (
        <div role="alert" className="space-y-3 rounded-lg border p-5">
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="outline" onClick={reload}>
            Thử lại
          </Button>
        </div>
      )}
      {ready && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Đơn vị trong phạm vi" value={tree.stats.unitCount} icon={Building} />
            <StatCard
              label="Khu phố trong phạm vi"
              value={tree.stats.regionCount}
              icon={Building}
            />
            <StatCard
              label="Đang hoạt động"
              value={tree.stats.activeCount}
              tone="success"
              icon={Building}
            />
            <StatCard label="Cán bộ trong phạm vi" value={tree.stats.officerCount} icon={Users} />
          </div>
          <SectionCard
            title="Cây cơ cấu tổ chức"
            description="Dữ liệu và số lượng theo phạm vi truy cập của bạn. Các nút cha bên ngoài phạm vi được hiển thị để xác định quan hệ phân cấp."
            contentClassName="space-y-3"
          >
            {roots.length === 0 ? (
              <EmptyState
                icon={Building}
                title="Chưa có đơn vị trong phạm vi"
                description="Liên hệ quản trị để kiểm tra phạm vi dữ liệu được cấp."
              />
            ) : (
              <ul className="space-y-2">
                {roots.map((node) => (
                  <UnitBranch
                    key={`${node.kind}-${node.id}`}
                    node={node}
                    nodes={tree.items}
                    depth={0}
                    options={options}
                    canEdit={canEdit && tree.permissions.edit}
                    onSaved={reload}
                  />
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
