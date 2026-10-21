"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CalendarRange, Pencil, Plus, Send, Target } from "lucide-react";
import { nativeSelectClass } from "@/components/forms/legal-document-editor";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { AuthUser } from "@/lib/auth-contract";
import type { PagedResult } from "@/lib/insights-contract";
import {
  planStatusLabels,
  type InspectionPlan,
  type InspectionTarget,
  type PlanningOptions,
} from "@/lib/inspection-planning-contract";
import { apiData, useApiData } from "@/lib/use-api-data";

function ErrorMessage({ message }: { message: string }) {
  return (
    <p role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}

function CreatePlanDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const options = useApiData<PlanningOptions>("/api/inspection-planning/options");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await apiData("/api/inspection-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.get("code"),
          year: Number(form.get("year")),
          title: form.get("title"),
          facility_group: form.get("facility_group"),
          legal_basis: form.get("legal_basis"),
          unit_id: form.get("unit_id"),
          annual_target: Number(form.get("annual_target")),
        }),
      });
      setOpen(false);
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tạo kế hoạch.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Lập kế hoạch năm
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Lập kế hoạch kiểm tra năm</DialogTitle>
            <DialogDescription>
              Chỉ tiêu năm là mức tối thiểu; số thực hiện thực tế có thể vượt chỉ tiêu.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plan-code">Mã kế hoạch</Label>
              <Input
                id="plan-code"
                name="code"
                maxLength={100}
                placeholder="KHKT-2027-KV10"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-year">Năm</Label>
              <Input
                id="plan-year"
                name="year"
                type="number"
                min={2000}
                max={2100}
                defaultValue={new Date().getFullYear()}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="plan-title">Tên kế hoạch</Label>
              <Input id="plan-title" name="title" maxLength={300} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-unit">Đơn vị</Label>
              <select id="plan-unit" name="unit_id" className={nativeSelectClass} required>
                <option value="">Chọn đơn vị</option>
                {options.data?.units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="annual-target">Chỉ tiêu năm</Label>
              <Input id="annual-target" name="annual_target" type="number" min={1} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="facility-group">Nhóm/loại cơ sở</Label>
              <Input id="facility-group" name="facility_group" maxLength={200} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="legal-basis">Căn cứ</Label>
              <Textarea id="legal-basis" name="legal_basis" maxLength={2000} />
            </div>
          </div>
          {options.error && <ErrorMessage message={options.error} />}
          {error && <ErrorMessage message={error} />}
          <DialogFooter>
            <Button type="submit" disabled={saving || options.loading}>
              {saving ? "Đang lưu…" : "Lưu bản nháp"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditPlanDialog({ plan, onSaved }: { plan: InspectionPlan; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await apiData(`/api/inspection-plans/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: plan.version,
          title: form.get("title"),
          facility_group: form.get("facility_group"),
          legal_basis: form.get("legal_basis"),
          annual_target: Number(form.get("annual_target")),
          status: form.get("status"),
          change_reason: form.get("change_reason"),
        }),
      });
      setOpen(false);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể cập nhật kế hoạch.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil /> Cập nhật
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Cập nhật kế hoạch</DialogTitle>
            <DialogDescription>
              Kế hoạch đã công bố bắt buộc ghi lý do khi điều chỉnh nội dung/chỉ tiêu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-plan-title">Tên kế hoạch</Label>
            <Input
              id="edit-plan-title"
              name="title"
              defaultValue={plan.title}
              maxLength={300}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-plan-target">Chỉ tiêu năm</Label>
              <Input
                id="edit-plan-target"
                name="annual_target"
                type="number"
                min={1}
                defaultValue={plan.annual_target}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-plan-status">Trạng thái</Label>
              <select
                id="edit-plan-status"
                name="status"
                className={nativeSelectClass}
                defaultValue={plan.status}
              >
                <option value={plan.status}>{planStatusLabels[plan.status]}</option>
                {plan.status === "draft" && <option value="published">Đã công bố nội bộ</option>}
                {plan.status === "published" && <option value="closed">Đã đóng</option>}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-plan-group">Nhóm/loại cơ sở</Label>
            <Input
              id="edit-plan-group"
              name="facility_group"
              defaultValue={plan.facility_group}
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-plan-basis">Căn cứ</Label>
            <Textarea
              id="edit-plan-basis"
              name="legal_basis"
              defaultValue={plan.legal_basis}
              maxLength={2000}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-plan-reason">Lý do điều chỉnh</Label>
            <Textarea
              id="edit-plan-reason"
              name="change_reason"
              maxLength={2000}
              required={plan.status === "published"}
            />
          </div>
          {error && <ErrorMessage message={error} />}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu…" : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlanDetail({
  planId,
  canAllocate,
  canEdit,
  onChanged,
}: {
  planId: string;
  canAllocate: boolean;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const detail = useApiData<{ plan: InspectionPlan; targets: InspectionTarget[] }>(
    `/api/inspection-plans/${planId}`,
  );
  const options = useApiData<PlanningOptions>(`/api/inspection-planning/options?planId=${planId}`);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState<"month" | "week">("month");

  async function publish() {
    if (!detail.data) return;
    setSaving(true);
    setError("");
    try {
      await apiData(`/api/inspection-plans/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: detail.data.plan.version, status: "published" }),
      });
      detail.reload();
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể công bố kế hoạch.");
    } finally {
      setSaving(false);
    }
  }

  async function allocate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    // React clears `currentTarget` after the synchronous event callback. Keep the
    // form element itself before awaiting the API so a successful save can reset it.
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await apiData(`/api/inspection-plans/${planId}/targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_type: period,
          month: Number(form.get("month")),
          week: period === "week" ? Number(form.get("week")) : undefined,
          officer_id: form.get("officer_id") || undefined,
          region_id: form.get("region_id") || undefined,
          parent_id: form.get("parent_id") || undefined,
          target_count: Number(form.get("target_count")),
        }),
      });
      formElement.reset();
      detail.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể phân bổ chỉ tiêu.");
    } finally {
      setSaving(false);
    }
  }

  if (detail.loading) return <p role="status">Đang tải chi tiết kế hoạch…</p>;
  if (detail.error) return <ErrorMessage message={detail.error} />;
  if (!detail.data) return null;
  const { plan, targets } = detail.data;
  const parentTargets = targets.filter(
    (target) =>
      !target.officer_id &&
      !target.region_id &&
      ((period === "week" && target.period_type === "month") || target.period_type === period),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{plan.title}</h2>
          <p className="text-muted-foreground text-sm">
            {plan.code} · {plan.unit_name} · {plan.year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{planStatusLabels[plan.status]}</Badge>
          {canEdit && plan.status !== "closed" && (
            <EditPlanDialog
              plan={plan}
              onSaved={() => {
                detail.reload();
                onChanged();
              }}
            />
          )}
          {canEdit && plan.status === "draft" && (
            <Button size="sm" onClick={publish} disabled={saving}>
              <Send /> Công bố nội bộ
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Chỉ tiêu năm" value={plan.annual_target} unit="lượt" icon={Target} />
        <StatCard
          label="Đã tạo hồ sơ"
          value={plan.inspection_count ?? 0}
          unit="cuộc"
          icon={CalendarRange}
          tone="info"
        />
        <StatCard
          label="Đã hoàn thành"
          value={plan.completed_count ?? 0}
          unit="cuộc"
          icon={Target}
          tone="success"
        />
      </div>
      {canAllocate && plan.status !== "closed" && (
        <SectionCard
          title="Phân bổ tháng / tuần / cán bộ"
          description="Để giao cán bộ hoặc địa bàn, chọn chỉ tiêu kỳ cha tương ứng."
        >
          <form onSubmit={allocate} className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="period-type">Kỳ</Label>
              <select
                id="period-type"
                className={nativeSelectClass}
                value={period}
                onChange={(event) => setPeriod(event.target.value as "month" | "week")}
              >
                <option value="month">Tháng</option>
                <option value="week">Tuần</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-month">Tháng</Label>
              <Input id="target-month" name="month" type="number" min={1} max={12} required />
            </div>
            {period === "week" && (
              <div className="space-y-2">
                <Label htmlFor="target-week">Tuần ISO</Label>
                <Input id="target-week" name="week" type="number" min={1} max={53} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="target-count">Chỉ tiêu</Label>
              <Input id="target-count" name="target_count" type="number" min={1} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-parent">Chỉ tiêu kỳ cha</Label>
              <select id="target-parent" name="parent_id" className={nativeSelectClass}>
                <option value="">Phân bổ tổng kỳ</option>
                {parentTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.period_type === "month"
                      ? `Tháng ${target.month}`
                      : `Tuần ${target.week}`}{" "}
                    · {target.target_count}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-officer">Cán bộ (tùy chọn)</Label>
              <select id="target-officer" name="officer_id" className={nativeSelectClass}>
                <option value="">Chưa giao cán bộ</option>
                {options.data?.officers.map((officer) => (
                  <option key={officer.id} value={officer.id}>
                    {officer.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-region">Địa bàn (tùy chọn)</Label>
              <select id="target-region" name="region_id" className={nativeSelectClass}>
                <option value="">Chưa gắn địa bàn</option>
                {options.data?.regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu…" : "Lưu phân bổ"}
            </Button>
          </form>
          {error && (
            <div className="mt-3">
              <ErrorMessage message={error} />
            </div>
          )}
        </SectionCard>
      )}
      {error && !canAllocate && <ErrorMessage message={error} />}
      <SectionCard title="Chỉ tiêu năm / tháng / tuần" contentClassName="px-0 pb-0">
        {targets.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kỳ</TableHead>
                <TableHead>Đối tượng</TableHead>
                <TableHead className="text-right">Chỉ tiêu</TableHead>
                <TableHead className="text-right">Đã tạo hồ sơ</TableHead>
                <TableHead className="text-right">Còn lại tối thiểu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map((target) => (
                <TableRow key={target.id}>
                  <TableCell>
                    {target.period_type === "year"
                      ? `Năm ${target.year}`
                      : target.period_type === "month"
                        ? `Tháng ${target.month}`
                        : `Tuần ${target.week} / tháng ${target.month}`}
                  </TableCell>
                  <TableCell>{target.officer_name ?? target.region_name ?? "Tổng kỳ"}</TableCell>
                  <TableCell className="text-right tabular-nums">{target.target_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{target.actual_count}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Math.max(0, target.target_count - target.actual_count)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground px-5 pb-5">Chưa có chỉ tiêu.</p>
        )}
      </SectionCard>
    </div>
  );
}

export function PlanWorkspace({ user }: { user: AuthUser }) {
  const plans = useApiData<PagedResult<InspectionPlan>>("/api/inspection-plans?pageSize=100");
  const [selected, setSelected] = useState("");
  useEffect(() => {
    if (!selected && plans.data?.items[0]) setSelected(plans.data.items[0].id);
  }, [plans.data, selected]);
  const canCreate =
    user.permissions.includes("M06.create") && ["A01", "A02", "A04"].includes(user.role);
  const canEdit =
    user.permissions.includes("M06.edit") && ["A01", "A02", "A04"].includes(user.role);
  const canAllocate = user.permissions.includes("M06.edit") && ["A01", "A02"].includes(user.role);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kế hoạch kiểm tra & chỉ tiêu"
        description="Lập kế hoạch năm, phân bổ theo tháng/tuần và giao chỉ tiêu cho cán bộ trong phạm vi đơn vị."
        module="M06"
        useCases={["UC-INS-01", "UC-INS-02"]}
        actions={canCreate ? <CreatePlanDialog onCreated={plans.reload} /> : undefined}
      />
      {plans.loading && <p role="status">Đang tải kế hoạch…</p>}
      {plans.error && <ErrorMessage message={plans.error} />}
      {plans.data && !plans.data.items.length && (
        <p role="status" className="text-muted-foreground rounded-xl border p-5">
          Chưa có kế hoạch trong phạm vi được cấp.
        </p>
      )}
      {plans.data && plans.data.items.length > 0 && (
        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-2" aria-label="Danh sách kế hoạch">
            {plans.data.items.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelected(plan.id)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${selected === plan.id ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
              >
                <div className="font-medium">{plan.title}</div>
                <div className="text-muted-foreground mt-1 text-xs">
                  {plan.code} · {plan.year}
                </div>
                <Badge className="mt-2">{planStatusLabels[plan.status]}</Badge>
              </button>
            ))}
          </aside>
          {selected && (
            <PlanDetail
              planId={selected}
              canAllocate={canAllocate}
              canEdit={canEdit}
              onChanged={plans.reload}
            />
          )}
        </div>
      )}
    </div>
  );
}
