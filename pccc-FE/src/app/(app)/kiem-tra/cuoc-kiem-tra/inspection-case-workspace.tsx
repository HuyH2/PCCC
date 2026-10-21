"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarClock, ClipboardCheck, Plus, Send } from "lucide-react";
import { nativeSelectClass } from "@/components/forms/legal-document-editor";
import { DataPagination } from "@/components/shared/data-pagination";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Time24Input } from "@/components/ui/time-24-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuthUser } from "@/lib/auth-contract";
import type { PagedResult } from "@/lib/insights-contract";
import {
  noticeStatusLabels,
  type InspectionPlan,
  type InspectionSchedule,
  type InspectionTarget,
  type PlanningFacility,
  type PlanningOptions,
} from "@/lib/inspection-planning-contract";
import { formatIsoDate } from "@/lib/inspection-contract";
import { acceptedPlanningFiles, planningFilePayload } from "@/lib/inspection-planning-file";
import { apiData, useApiData } from "@/lib/use-api-data";

function CaseFields({ planId }: { planId: string }) {
  const detail = useApiData<{ plan: InspectionPlan; targets: InspectionTarget[] }>(
    `/api/inspection-plans/${planId}`,
  );
  const facilities = useApiData<PagedResult<PlanningFacility>>(
    `/api/inspection-plans/${planId}/facilities?pageSize=100`,
  );
  const options = useApiData<PlanningOptions>(`/api/inspection-planning/options?planId=${planId}`);
  if (detail.loading || facilities.loading || options.loading) {
    return (
      <p role="status" className="sm:col-span-2">
        Đang tải cơ sở và cán bộ…
      </p>
    );
  }
  const error = detail.error || facilities.error || options.error;
  if (error)
    return (
      <p role="alert" className="text-destructive sm:col-span-2">
        {error}
      </p>
    );
  const assignedTargets = detail.data?.targets.filter(
    (target) => target.officer_id || target.region_id,
  );
  return (
    <>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="case-facility">Cơ sở kiểm tra</Label>
        <select id="case-facility" name="facility_id" className={nativeSelectClass} required>
          <option value="">Chọn cơ sở trong phạm vi</option>
          {facilities.data?.items.map((facility) => (
            <option key={facility.id} value={facility.id}>
              {facility.name} — {facility.region_name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="case-officer">Cán bộ phụ trách</Label>
        <select id="case-officer" name="lead_officer_id" className={nativeSelectClass} required>
          <option value="">Chọn cán bộ</option>
          {options.data?.officers.map((officer) => (
            <option key={officer.id} value={officer.id}>
              {officer.full_name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="case-target">Chỉ tiêu được giao</Label>
        <select id="case-target" name="target_id" className={nativeSelectClass}>
          <option value="">Không gắn chỉ tiêu cụ thể</option>
          {assignedTargets?.map((target) => (
            <option key={target.id} value={target.id}>
              {target.period_type === "month" ? `Tháng ${target.month}` : `Tuần ${target.week}`} —{" "}
              {target.officer_name ?? target.region_name} ({target.actual_count}/
              {target.target_count})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="case-checklist">Checklist</Label>
        <select id="case-checklist" name="checklist_id" className={nativeSelectClass}>
          <option value="">Chọn sau</option>
          {options.data?.checklists.map((checklist) => (
            <option key={checklist.id} value={checklist.id}>
              {checklist.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

function CreateCaseDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const plans = useApiData<PagedResult<InspectionPlan>>(
    "/api/inspection-plans?status=published&pageSize=100",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const teamDecision = await planningFilePayload(form.get("team_decision_file") as File | null);
      await apiData(`/api/inspection-plans/${planId}/inspections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: form.get("facility_id"),
          target_id: form.get("target_id") || undefined,
          lead_officer_id: form.get("lead_officer_id"),
          scheduled_date: form.get("scheduled_date"),
          start_time: form.get("start_time") || undefined,
          end_time: form.get("end_time") || undefined,
          location: form.get("location"),
          checklist_id: form.get("checklist_id") || undefined,
          team_decision: teamDecision,
        }),
      });
      setOpen(false);
      setPlanId("");
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tạo hồ sơ kiểm tra.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Tạo cuộc kiểm tra
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Tạo hồ sơ kiểm tra định kỳ</DialogTitle>
            <DialogDescription>
              Chọn cơ sở từ kế hoạch đã công bố, cán bộ phụ trách và lịch dự kiến.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="case-plan">Kế hoạch năm</Label>
              <select
                id="case-plan"
                className={nativeSelectClass}
                value={planId}
                onChange={(event) => setPlanId(event.target.value)}
                required
              >
                <option value="">Chọn kế hoạch đã công bố</option>
                {plans.data?.items.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title} ({plan.year})
                  </option>
                ))}
              </select>
            </div>
            {planId && <CaseFields planId={planId} />}
            <div className="space-y-2">
              <Label htmlFor="case-date">Ngày kiểm tra</Label>
              <Input id="case-date" name="scheduled_date" type="date" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="case-start">Bắt đầu</Label>
                <Time24Input id="case-start" name="start_time" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="case-end">Kết thúc</Label>
                <Time24Input id="case-end" name="end_time" />
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="case-location">Địa điểm</Label>
              <Input
                id="case-location"
                name="location"
                maxLength={500}
                placeholder="Mặc định dùng địa chỉ cơ sở"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="team-decision">Quyết định đoàn kiểm tra (tùy chọn)</Label>
              <Input
                id="team-decision"
                name="team_decision_file"
                type="file"
                accept={acceptedPlanningFiles}
              />
              <p className="text-muted-foreground text-xs">
                PDF, JPEG hoặc PNG; giới hạn theo cấu hình hệ thống.
              </p>
            </div>
          </div>
          {(plans.error || error) && (
            <p role="alert" className="text-destructive text-sm">
              {plans.error || error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={saving || !planId}>
              {saving ? "Đang tạo…" : "Tạo hồ sơ và lịch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InspectionCaseWorkspace({ user }: { user: AuthUser }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const schedules = useApiData<PagedResult<InspectionSchedule>>(
    `/api/inspection-schedules?kind=periodic&page=${page}&pageSize=${pageSize}`,
  );
  const canCreate = user.permissions.includes("M06.create") && ["A03", "A04"].includes(user.role);
  const items = schedules.data?.items ?? [];
  const sent = items.filter((item) => item.notice_status === "sent").length;
  const moved = items.filter((item) => item.status === "rescheduled").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Hồ sơ cuộc kiểm tra định kỳ"
        description="Chọn cơ sở theo kế hoạch, lập lịch, gửi thông báo và theo dõi lịch sử dời lịch."
        module="M06"
        useCases={["UC-INS-03", "UC-INS-04", "UC-INS-05"]}
        actions={canCreate ? <CreateCaseDialog onCreated={schedules.reload} /> : undefined}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Hồ sơ trong trang" value={items.length} icon={ClipboardCheck} />
        <StatCard label="Đã gửi thông báo" value={sent} icon={Send} tone="info" />
        <StatCard
          label="Đã dời lịch"
          value={moved}
          icon={CalendarClock}
          tone="warning"
          hint="Có lý do và lịch sử (BR-08)"
        />
      </div>
      <Card className="gap-0 py-0">
        {schedules.loading && (
          <p role="status" className="p-5">
            Đang tải hồ sơ kiểm tra…
          </p>
        )}
        {schedules.error && (
          <div role="alert" className="space-y-3 p-5 text-destructive">
            <p>{schedules.error}</p>
            <Button variant="outline" onClick={schedules.reload}>
              Thử lại
            </Button>
          </div>
        )}
        {schedules.data &&
          (items.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead>Cơ sở</TableHead>
                  <TableHead>Ngày / giờ</TableHead>
                  <TableHead>Cán bộ</TableHead>
                  <TableHead>Thông báo</TableHead>
                  <TableHead>Lịch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        className="text-primary font-medium underline"
                        href={`/kiem-tra/cuoc-kiem-tra/${item.inspection_id}`}
                      >
                        {item.inspection_code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.facility_name}</div>
                      <div className="text-muted-foreground text-xs">{item.region_name}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div>{formatIsoDate(item.scheduled_date)}</div>
                      <div className="text-muted-foreground text-xs">
                        {item.start_time ?? "Chưa chốt giờ"}
                      </div>
                    </TableCell>
                    <TableCell>{item.lead_officer_name ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge value={noticeStatusLabels[item.notice_status]} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        value={item.status === "rescheduled" ? "Đã dời lịch" : "Đã lên lịch"}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p role="status" className="text-muted-foreground p-5">
              Chưa có cuộc kiểm tra định kỳ trong phạm vi được cấp.
            </p>
          ))}
        {schedules.data && (
          <DataPagination
            tong={schedules.data.total}
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
