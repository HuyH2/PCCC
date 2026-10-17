"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PagedResult } from "@/lib/insights-contract";
import { noticeStatusLabels, type InspectionSchedule } from "@/lib/inspection-planning-contract";
import { formatIsoDate } from "@/lib/inspection-contract";
import { useApiData } from "@/lib/use-api-data";

function monthRange(month: string) {
  const [year, number] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

export function InspectionCalendar() {
  const now = new Date();
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const range = monthRange(month);
  const schedules = useApiData<PagedResult<InspectionSchedule>>(
    `/api/inspection-schedules?from=${range.from}&to=${range.to}&pageSize=100`,
  );
  const grouped = useMemo(() => {
    const map = new Map<string, InspectionSchedule[]>();
    for (const item of schedules.data?.items ?? []) {
      const current = map.get(item.scheduled_date) ?? [];
      current.push(item);
      map.set(item.scheduled_date, current);
    }
    return [...map.entries()];
  }, [schedules.data]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lịch kiểm tra"
        description="Lịch tổng hợp theo phạm vi được cấp; thay đổi lịch được đồng bộ từ hồ sơ kiểm tra."
        module="M06"
        useCases={["UC-INS-03", "UC-INS-04", "UC-INS-05"]}
        actions={
          <Button variant="outline" asChild size="sm">
            <Link href="/kiem-tra/cuoc-kiem-tra">
              <CalendarClock /> Hồ sơ kiểm tra
            </Link>
          </Button>
        }
      />
      <div className="max-w-56 space-y-2">
        <Label htmlFor="calendar-month">Tháng hiển thị</Label>
        <Input
          id="calendar-month"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
      </div>
      {schedules.loading && <p role="status">Đang tải lịch kiểm tra…</p>}
      {schedules.error && (
        <div role="alert" className="space-y-3 text-destructive">
          <p>{schedules.error}</p>
          <Button variant="outline" onClick={schedules.reload}>
            Thử lại
          </Button>
        </div>
      )}
      {schedules.data && !grouped.length && (
        <p role="status" className="text-muted-foreground rounded-xl border p-5">
          Không có lịch kiểm tra trong tháng đã chọn.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {grouped.map(([date, items]) => (
          <Card key={date}>
            <CardHeader>
              <CardTitle className="text-base">
                {formatIsoDate(date)} · {items.length} cuộc
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={
                        item.plan_id
                          ? `/kiem-tra/cuoc-kiem-tra/${item.inspection_id}`
                          : `/kiem-tra/thuc-hien/${item.inspection_id}`
                      }
                      className="text-primary font-medium underline"
                    >
                      {item.facility_name}
                    </Link>
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      {item.start_time ?? "Chưa chốt giờ"}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {item.inspection_code} · {item.region_name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge>{item.status === "rescheduled" ? "Đã dời lịch" : "Đã lên lịch"}</Badge>
                    <Badge variant="outline">{noticeStatusLabels[item.notice_status]}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
