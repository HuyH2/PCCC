"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, CalendarClock, HeartPulse, RefreshCw, Siren, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  IncidentError,
  IncidentLoading,
  useIncidentOptions,
} from "@/components/incidents/incident-ui";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
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
  damageTypeNames,
  incidentSelectClass,
  type IncidentStatistics,
} from "@/lib/incident-contract";

function CountChart({ data }: { data: { name: string; count: number }[] }) {
  if (!data.length || !data.some((row) => row.count))
    return (
      <EmptyState
        icon={BarChart3}
        title="Chưa có số liệu trong kỳ"
        description="Biểu đồ sử dụng hồ sơ chính thức trong phạm vi được cấp."
      />
    );
  return (
    <div
      className="min-w-0"
      role="img"
      aria-label={data.map((row) => `${row.name}: ${row.count} vụ`).join("; ")}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, left: -20, right: 8, bottom: 8 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="count"
            name="Số vụ"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function useIncidentStatistics(query = "", revision = 0, enabled = true) {
  const [data, setData] = React.useState<IncidentStatistics | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(enabled);
  React.useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    incidentApi<IncidentStatistics>(`/api/incidents/statistics${query ? `?${query}` : ""}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(incidentErrorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, revision, enabled]);
  return { data, error, loading };
}
export function IncidentDashboard({ mode, enabled }: { mode: "kpi" | "chart"; enabled: boolean }) {
  const { data, error, loading } = useIncidentStatistics("", 0, enabled);
  if (!enabled)
    return mode === "kpi" ? (
      <StatCard
        label="Sự cố đã ghi nhận"
        value="—"
        icon={Siren}
        hint="Cần quyền M09.export để xem thống kê."
      />
    ) : (
      <p className="text-muted-foreground p-4 text-sm">Chưa được cấp quyền thống kê M09.export.</p>
    );
  if (loading) return <IncidentLoading>Đang tải thống kê sự cố…</IncidentLoading>;
  if (error) return <IncidentError message={error} />;
  if (!data) return null;
  if (mode === "kpi")
    return (
      <StatCard
        label="Sự cố chính thức"
        value={data.total}
        icon={Siren}
        tone="warning"
        hint={`${data.deadlines.overdue} quá hạn · ${data.processing.completed} hoàn thành`}
      />
    );
  return <CountChart data={data.byMonth.map((row) => ({ name: row.key, count: row.count }))} />;
}
export function IncidentStatisticsPanel({ canView }: { canView: boolean }) {
  const [revision, setRevision] = React.useState(0);
  const { options, error: optionsError } = useIncidentOptions(revision);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [type, setType] = React.useState("");
  const [region, setRegion] = React.useState("");
  const [period, setPeriod] = React.useState<"byDay" | "byMonth" | "byYear">("byMonth");
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (type) params.set("incidentType", type);
  if (region) params.set("regionId", region);
  const { data, loading, error } = useIncidentStatistics(params.toString(), revision);
  function drill(extra: Record<string, string> = {}) {
    const query = new URLSearchParams(params);
    query.set("recordStatus", "OFFICIAL");
    for (const [key, value] of Object.entries(extra)) query.set(key, value);
    return `/su-co?${query}`;
  }
  function timeDrill(key: string) {
    let start = key,
      end = key;
    if (period === "byMonth") {
      start = `${key}-01`;
      const [year, month] = key.split("-").map(Number);
      end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    }
    if (period === "byYear") {
      start = `${key}-01-01`;
      end = `${key}-12-31`;
    }
    return drill({ from: from && from > start ? from : start, to: to && to < end ? to : end });
  }
  const count = (damageType: string) =>
    data?.damages.human.find((row) => row.damageType === damageType)?.quantity ?? 0;
  const reload = () => setRevision((current) => current + 1);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Thống kê sự cố và thiệt hại"
        description="R09/R10 — dữ liệu hồ sơ chính thức từ SQLite; kỳ thống kê theo thời điểm xảy ra, múi giờ Việt Nam."
        module="M09"
        useCases={["UC-INC-06"]}
        actions={
          <>
            {canView && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/su-co">Danh sách sự cố</Link>
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={loading} onClick={reload}>
              <RefreshCw />
              Tải lại
            </Button>
          </>
        }
      />
      <SectionCard title="Bộ lọc kỳ thống kê">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="stats-from">Từ ngày</Label>
            <Input
              id="stats-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stats-to">Đến hết ngày</Label>
            <Input
              id="stats-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stats-type">Loại sự cố</Label>
            <select
              id="stats-type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className={incidentSelectClass}
            >
              <option value="">Tất cả loại</option>
              {options?.incidentTypes.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stats-region">Khu vực</Label>
            <select
              id="stats-region"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              className={incidentSelectClass}
            >
              <option value="">Tất cả khu vực</option>
              {options?.regions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stats-period">Nhóm thời gian</Label>
            <select
              id="stats-period"
              value={period}
              onChange={(event) => setPeriod(event.target.value as typeof period)}
              className={incidentSelectClass}
            >
              <option value="byDay">Ngày</option>
              <option value="byMonth">Tháng</option>
              <option value="byYear">Năm</option>
            </select>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={() => {
            setFrom("");
            setTo("");
            setType("");
            setRegion("");
          }}
        >
          Xóa bộ lọc
        </Button>
      </SectionCard>
      {optionsError && (
        <IncidentError message={`Không tải được danh mục: ${optionsError}`} retry={reload} />
      )}
      {loading ? (
        <IncidentLoading>Đang tổng hợp thống kê…</IncidentLoading>
      ) : error ? (
        <IncidentError message={error} retry={reload} />
      ) : (
        data && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Tổng số vụ chính thức"
                value={data.total}
                icon={Siren}
                hint={`${data.draftsExcluded} hồ sơ nháp được loại khỏi thống kê`}
              />
              <StatCard
                label="Đang xử lý / hoàn thành"
                value={`${data.processing.inProgress} / ${data.processing.completed}`}
                icon={CalendarClock}
              />
              <StatCard
                label="Người chết / bị thương"
                value={`${count("DEATH")} / ${count("INJURED")}`}
                icon={HeartPulse}
                tone="danger"
              />
              <StatCard
                label="Thiệt hại tài sản"
                value={data.damages.propertyValue.toLocaleString("vi-VN")}
                unit="VNĐ"
                icon={Wallet}
                tone="warning"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {canView && (
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={drill()}>Xem {data.total} hồ sơ</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={drill({ deadlineWarning: "DUE_SOON" })}>
                      Sắp hạn: {data.deadlines.dueSoon}
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={drill({ deadlineWarning: "OVERDUE" })}>
                      Quá hạn: {data.deadlines.overdue}
                    </Link>
                  </Button>
                </>
              )}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Sự cố theo loại">
                <CountChart
                  data={data.byType.map((row) => ({ name: row.name, count: row.count }))}
                />
                <div className="flex flex-wrap gap-2">
                  {data.byType.map((row) =>
                    canView ? (
                      <Button key={row.key} variant="outline" size="sm" asChild>
                        <Link href={drill({ incidentType: row.key })}>
                          {row.name}: {row.count}
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-sm" key={row.key}>
                        {row.name}: {row.count}
                      </span>
                    ),
                  )}
                </div>
              </SectionCard>
              <SectionCard
                title={`Sự cố theo ${period === "byDay" ? "ngày" : period === "byMonth" ? "tháng" : "năm"}`}
              >
                <CountChart
                  data={data[period].map((row) => ({ name: row.key, count: row.count }))}
                />
              </SectionCard>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Theo kỳ thời gian" contentClassName="px-0 pb-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kỳ</TableHead>
                      <TableHead className="text-right">Số vụ</TableHead>
                      <TableHead>Hồ sơ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data[period].map((row) => (
                      <TableRow key={row.key}>
                        <TableCell>{row.key}</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                        <TableCell>
                          {canView && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={timeDrill(row.key)}>Xem</Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!data[period].length && <EmptyState />}
              </SectionCard>
              <SectionCard title="Theo khu vực" contentClassName="px-0 pb-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Khu vực</TableHead>
                      <TableHead className="text-right">Số vụ</TableHead>
                      <TableHead>Hồ sơ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byRegion.map((row) => (
                      <TableRow key={row.key ?? "none"}>
                        <TableCell>{row.name || "Chưa chọn khu vực"}</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                        <TableCell>
                          {canView && row.key && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={drill({ regionId: row.key })}>Xem</Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!data.byRegion.length && <EmptyState />}
              </SectionCard>
            </div>
            <SectionCard title="Tổng hợp thiệt hại người">
              <div className="flex flex-wrap gap-4">
                {data.damages.human.length ? (
                  data.damages.human.map((row) => (
                    <p className="text-sm" key={row.damageType}>
                      {damageTypeNames[row.damageType] || row.damageType}:{" "}
                      <strong>{row.quantity}</strong>
                    </p>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Chưa ghi nhận thiệt hại người trong kỳ.
                  </p>
                )}
              </div>
            </SectionCard>
          </>
        )
      )}
    </div>
  );
}
