"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Building2,
  Landmark,
  Loader2,
  Lock,
  MapPinned,
  Search,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  facilityStatusLabels,
  unlinkedOfficerLabel,
  type SearchGroup,
  type SearchResponse,
} from "@/lib/insights-contract";
import { formatNumber } from "@/lib/utils";

const MIN_LENGTH = 2;
const MAX_LENGTH = 100;
const RESULT_LIMIT = 20;
const DEBOUNCE_MS = 300;

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; forbidden: boolean; message: string }
  | { kind: "done"; result: SearchResponse };

type GroupKey = keyof SearchResponse["groups"];
const groupMeta: Record<GroupKey, { label: string; icon: LucideIcon }> = {
  facilities: { label: "Cơ sở", icon: Building2 },
  officers: { label: "Cán bộ", icon: Users },
  regions: { label: "Khu vực", icon: MapPinned },
  units: { label: "Đơn vị", icon: Landmark },
};
const groupOrder: GroupKey[] = ["facilities", "officers", "regions", "units"];

function ResultCard({
  title,
  code,
  children,
}: {
  title: string;
  code: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="gap-0 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">{title}</span>
        <span className="text-muted-foreground ml-auto font-mono text-xs">{code}</span>
      </div>
      {children && <div className="text-muted-foreground mt-0.5 text-[13px]">{children}</div>}
    </Card>
  );
}

function GroupFooter({ group }: { group: SearchGroup<unknown> }) {
  if (group.total === 0)
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        Không có kết quả trong nhóm này.
      </p>
    );
  if (group.total <= group.items.length) return null;
  return (
    <p className="text-muted-foreground text-xs">
      Hiển thị {group.items.length}/{formatNumber(group.total)} kết quả. Nhập từ khóa cụ thể hơn để
      thu hẹp.
    </p>
  );
}

export default function TrangTraCuu() {
  const [keyword, setKeyword] = React.useState("");
  const [state, setState] = React.useState<SearchState>({ kind: "idle" });
  const query = keyword.trim();

  React.useEffect(() => {
    if (query.length < MIN_LENGTH) {
      setState({ kind: "idle" });
      return;
    }
    const controller = new AbortController();
    setState({ kind: "loading" });
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&limit=${RESULT_LIMIT}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (response.status === 401) {
          window.location.assign("/dang-nhap");
          return;
        }
        const data = await response.json();
        if (!response.ok) {
          setState({
            kind: "error",
            forbidden: response.status === 403,
            message: data.error?.message || "Không thể tra cứu. Vui lòng thử lại.",
          });
          return;
        }
        setState({ kind: "done", result: data as SearchResponse });
      } catch {
        if (controller.signal.aborted) return;
        setState({
          kind: "error",
          forbidden: false,
          message: "Không kết nối được máy chủ. Vui lòng thử lại.",
        });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const groups =
    state.kind === "done" ? groupOrder.filter((key) => state.result.groups[key] !== undefined) : [];
  const total =
    state.kind === "done"
      ? groups.reduce((sum, key) => sum + (state.result.groups[key]?.total ?? 0), 0)
      : 0;
  const firstWithResults =
    state.kind === "done"
      ? (groups.find((key) => (state.result.groups[key]?.total ?? 0) > 0) ?? groups[0])
      : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tra cứu toàn hệ thống"
        description="Tìm nhanh cơ sở, cán bộ phụ trách, khu vực và đơn vị. Hỗ trợ tìm không dấu; kết quả chỉ gồm dữ liệu trong phạm vi được cấp cho tài khoản."
        module="M10"
        useCases={["UC-SYS-01"]}
      />

      <Card>
        <CardContent className="pt-5">
          <label htmlFor="global-search" className="sr-only">
            Từ khóa tra cứu
          </label>
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2" />
            <Input
              id="global-search"
              type="search"
              autoFocus
              maxLength={MAX_LENGTH}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Nhập tên/mã cơ sở, địa chỉ, tên/mã cán bộ, khu vực, đơn vị…"
              className="h-12 pr-11 pl-11 text-base"
            />
            {state.kind === "loading" && (
              <Loader2
                aria-label="Đang tìm"
                className="text-muted-foreground absolute top-1/2 right-3.5 size-5 -translate-y-1/2 animate-spin"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {state.kind === "idle" && (
        <Card>
          <CardContent className="py-14">
            <EmptyState
              icon={Search}
              title="Nhập từ khóa để bắt đầu tra cứu"
              description={`Cần ít nhất ${MIN_LENGTH} ký tự. Hệ thống tìm đồng thời trên cơ sở, cán bộ, khu vực và đơn vị.`}
            />
          </CardContent>
        </Card>
      )}

      {state.kind === "error" && (
        <Card role="alert">
          <CardContent className="py-14">
            <EmptyState
              icon={state.forbidden ? Lock : AlertTriangle}
              title={
                state.forbidden ? "Bạn chưa được cấp quyền tra cứu" : "Tra cứu không thành công"
              }
              description={state.message}
            />
          </CardContent>
        </Card>
      )}

      {state.kind === "done" && total === 0 && (
        <Card>
          <CardContent className="py-14">
            <EmptyState
              title={`Không tìm thấy kết quả cho “${state.result.query}”`}
              description="Thử rút ngắn từ khóa. Dữ liệu ngoài phạm vi được cấp sẽ không hiển thị."
            />
          </CardContent>
        </Card>
      )}

      {state.kind === "done" && total > 0 && (
        <>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            Tìm thấy{" "}
            <strong className="text-foreground font-semibold">{formatNumber(total)}</strong> kết quả
            cho <strong className="text-foreground">“{state.result.query}”</strong>
          </p>

          <Tabs key={state.result.query} defaultValue={firstWithResults}>
            <TabsList className="flex-wrap">
              {groups.map((key) => {
                const { label, icon: Icon } = groupMeta[key];
                return (
                  <TabsTrigger key={key} value={key}>
                    <Icon /> {label}
                    <Badge variant="secondary">{state.result.groups[key]?.total ?? 0}</Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {state.result.groups.facilities && (
              <TabsContent value="facilities" className="space-y-2">
                {state.result.groups.facilities.items.map((f) => (
                  <ResultCard key={f.id} title={f.name} code={f.id}>
                    {f.address} · {f.regionName} · CB: {f.officerName ?? f.officerId} ·{" "}
                    {facilityStatusLabels[f.status] ?? f.status}
                  </ResultCard>
                ))}
                <GroupFooter group={state.result.groups.facilities} />
              </TabsContent>
            )}

            {state.result.groups.officers && (
              <TabsContent value="officers" className="space-y-2">
                {state.result.groups.officers.items.map((o) => (
                  <ResultCard
                    key={o.officerId}
                    title={o.officerName ?? unlinkedOfficerLabel}
                    code={o.officerId}
                  >
                    Phụ trách {formatNumber(o.facilityCount)} cơ sở trong phạm vi của bạn
                  </ResultCard>
                ))}
                <GroupFooter group={state.result.groups.officers} />
              </TabsContent>
            )}

            <TabsContent value="regions" className="space-y-2">
              {state.result.groups.regions.items.map((r) => (
                <ResultCard key={r.id} title={r.name} code={r.id}>
                  Thuộc {r.unitName}
                </ResultCard>
              ))}
              <GroupFooter group={state.result.groups.regions} />
            </TabsContent>

            <TabsContent value="units" className="space-y-2">
              {state.result.groups.units.items.map((u) => (
                <ResultCard key={u.id} title={u.name} code={u.id}>
                  {u.parentId ? `Đơn vị cấp trên: ${u.parentId}` : "Đơn vị cấp cao nhất"}
                </ResultCard>
              ))}
              <GroupFooter group={state.result.groups.units} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
