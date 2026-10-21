import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AlertTriangle, Building2, Lock, MapPinned, Users } from "lucide-react";

import { BieuDoCoSoTheoKhuVuc } from "@/components/charts/dashboard-charts";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { backendFetch } from "@/lib/backend";
import {
  unlinkedOfficerLabel,
  type DashboardSummary,
  type OfficerFacilityCount,
  type PagedResult,
  type RegionFacilityCount,
} from "@/lib/insights-contract";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "Tổng quan điều hành" };

const BREAKDOWN_PAGE_SIZE = 100;

type Loaded<T> = { ok: true; data: T } | { ok: false; status: number };

async function load<T>(path: string): Promise<Loaded<T>> {
  let response: Response;
  try {
    response = await backendFetch(path);
  } catch {
    return { ok: false, status: 503 };
  }
  if (response.status === 401) redirect("/dang-nhap");
  if (!response.ok) return { ok: false, status: response.status };
  return { ok: true, data: (await response.json()) as T };
}

function StatusMessage({ forbidden }: { forbidden: boolean }) {
  return (
    <Card>
      <CardContent className="py-10">
        <EmptyState
          icon={forbidden ? Lock : AlertTriangle}
          title={forbidden ? "Bạn chưa được cấp quyền xem tổng quan" : "Không tải được số liệu"}
          description={
            forbidden
              ? "Cần quyền xem Tra cứu - dashboard (M10) và Cơ sở (M03). Liên hệ quản trị hệ thống."
              : "Dịch vụ dữ liệu tạm thời không phản hồi. Vui lòng tải lại trang sau ít phút."
          }
        />
      </CardContent>
    </Card>
  );
}

async function DashboardContent() {
  const [summary, byRegion, byOfficer] = await Promise.all([
    load<DashboardSummary>("/api/dashboard"),
    load<PagedResult<RegionFacilityCount>>(
      `/api/dashboard/facilities-by-region?pageSize=${BREAKDOWN_PAGE_SIZE}`,
    ),
    load<PagedResult<OfficerFacilityCount>>(
      `/api/dashboard/facilities-by-officer?pageSize=${BREAKDOWN_PAGE_SIZE}`,
    ),
  ]);
  if (!summary.ok || !byRegion.ok || !byOfficer.ok) {
    const forbidden = [summary, byRegion, byOfficer].some((r) => !r.ok && r.status === 403);
    return <StatusMessage forbidden={forbidden} />;
  }
  const { facilityCount, officerCount, regionCount } = summary.data;
  const truncated = (page: PagedResult<unknown>) =>
    page.total > page.items.length
      ? `Hiển thị ${page.items.length}/${formatNumber(page.total)} nhóm có nhiều cơ sở nhất.`
      : undefined;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Tổng số cơ sở quản lý"
          value={facilityCount}
          icon={Building2}
          hint="Trong phạm vi dữ liệu được cấp"
        />
        <StatCard
          label="Khu vực / khu phố"
          value={regionCount}
          icon={MapPinned}
          tone="info"
          hint={`${byRegion.data.items.filter((r) => r.facilityCount === 0).length} khu vực chưa có cơ sở`}
        />
        <StatCard
          label="Cán bộ phụ trách cơ sở"
          value={officerCount}
          icon={Users}
          tone="success"
          hint={
            officerCount > 0
              ? `Bình quân ${formatNumber(Math.round((facilityCount / officerCount) * 10) / 10)} cơ sở/cán bộ`
              : "Chưa có phân công"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Cơ sở theo khu vực"
          description={truncated(byRegion.data) ?? "Số cơ sở thuộc từng khu vực/khu phố"}
        >
          {byRegion.data.items.length === 0 ? (
            <EmptyState
              icon={MapPinned}
              title="Chưa có khu vực trong phạm vi"
              description="Tài khoản chưa được cấp phạm vi đơn vị, khu vực hoặc cơ sở."
            />
          ) : (
            <BieuDoCoSoTheoKhuVuc data={byRegion.data.items} />
          )}
        </SectionCard>

        <SectionCard
          title="Cơ sở theo cán bộ phụ trách"
          description={truncated(byOfficer.data) ?? "Số cơ sở và khu vực của từng cán bộ"}
          contentClassName="px-0 pb-0"
        >
          {byOfficer.data.items.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Chưa có cơ sở được phân công"
              description="Số liệu sẽ hiển thị khi có cơ sở trong phạm vi được giao cho cán bộ."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cán bộ</TableHead>
                  <TableHead className="text-right">Khu vực</TableHead>
                  <TableHead className="text-right">Cơ sở</TableHead>
                  <TableHead className="w-[140px]">Tỷ trọng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byOfficer.data.items.map((row) => {
                  const share = Math.round((row.facilityCount / Math.max(1, facilityCount)) * 100);
                  return (
                    <TableRow key={row.officerId}>
                      <TableCell>
                        <div className="font-medium">{row.officerName ?? unlinkedOfficerLabel}</div>
                        <div className="text-muted-foreground font-mono text-xs">
                          {row.officerId}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.regionCount}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatNumber(row.facilityCount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={share} className="h-1.5" />
                          <span className="text-muted-foreground w-10 shrink-0 text-right text-xs tabular-nums">
                            {share}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang tải số liệu tổng quan">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-muted h-[104px] animate-pulse rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="bg-muted h-[260px] animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function TrangTongQuan() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Tổng quan điều hành"
        description="Số liệu cơ sở, khu vực và cán bộ phụ trách tính trực tiếp từ dữ liệu nghiệp vụ, chỉ trong phạm vi dữ liệu tài khoản được cấp (BR-01)."
        module="M10"
        useCases={["UC-SYS-02"]}
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
