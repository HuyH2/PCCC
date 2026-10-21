"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { nativeSelectClass } from "@/components/forms/legal-document-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PagedResult } from "@/lib/insights-contract";
import type { ChecklistSummary, Inspection } from "@/lib/inspection-contract";
import { apiData, useApiData } from "@/lib/use-api-data";

interface FacilityOption {
  id: string;
  name: string;
  address: string;
}

export function CreateInspectionForm() {
  const router = useRouter();
  const [kind, setKind] = useState<"unscheduled" | "thematic">("unscheduled");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const facilities = useApiData<PagedResult<FacilityOption>>("/api/facilities?pageSize=100");
  const checklists = useApiData<{ items: ChecklistSummary[] }>("/api/inspection-checklists");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    if (!value("facility_id") || !value("reason") || !value("scheduled_date"))
      return setError("Vui lòng nhập đủ cơ sở, ngày kiểm tra và lý do/căn cứ.");
    if (kind === "thematic" && !value("topic")) return setError("Vui lòng nhập chuyên đề.");
    setBusy(true);
    try {
      const result = await apiData<{ inspection: Inspection }>("/api/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: value("facility_id"),
          kind,
          ...(kind === "thematic" ? { topic: value("topic") } : {}),
          reason: value("reason"),
          scheduled_date: value("scheduled_date"),
          checklist_id: value("checklist_id"),
        }),
      });
      toast.success(`Đã tạo cuộc kiểm tra ${result.inspection.code}`);
      router.push(`/kiem-tra/thuc-hien/${result.inspection.id}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không tạo được cuộc kiểm tra.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">
        Các trường có dấu * là bắt buộc. Trưởng đoàn mặc định là cán bộ đang đăng nhập.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {facilities.error && (
        <p role="alert" className="text-destructive">
          {facilities.error}{" "}
          <Button type="button" variant="outline" onClick={facilities.reload}>
            Tải lại danh sách cơ sở
          </Button>
        </p>
      )}
      <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="kind">Loại kiểm tra *</Label>
          <select
            id="kind"
            className={nativeSelectClass}
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="unscheduled">Đột xuất</option>
            <option value="thematic">Chuyên đề</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="scheduled_date">Ngày kiểm tra *</Label>
          <Input id="scheduled_date" name="scheduled_date" type="date" required />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="facility_id">Cơ sở được kiểm tra *</Label>
          <select
            id="facility_id"
            name="facility_id"
            required
            defaultValue=""
            className={nativeSelectClass}
          >
            <option value="" disabled>
              {facilities.loading ? "Đang tải cơ sở…" : "Chọn cơ sở trong phạm vi được giao"}
            </option>
            {facilities.data?.items.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} — {f.address}
              </option>
            ))}
          </select>
          {facilities.data && !facilities.data.items.length && (
            <p className="text-sm text-muted-foreground">Không có cơ sở trong phạm vi được giao.</p>
          )}
        </div>
        {kind === "thematic" && (
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="topic">Chuyên đề *</Label>
            <Input id="topic" name="topic" required maxLength={200} />
          </div>
        )}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="reason">Lý do / căn cứ kiểm tra *</Label>
          <Textarea id="reason" name="reason" required maxLength={2000} rows={3} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="checklist_id">Checklist kiểm tra</Label>
          <select
            id="checklist_id"
            name="checklist_id"
            defaultValue=""
            className={nativeSelectClass}
          >
            <option value="">Chọn sau khi bắt đầu kiểm tra</option>
            {checklists.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.facility_type ? ` — ${c.facility_type}` : ""}
              </option>
            ))}
          </select>
          {checklists.error && (
            <p role="alert" className="text-sm text-destructive">
              {checklists.error}
            </p>
          )}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Đang tạo…" : "Tạo cuộc kiểm tra"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/kiem-tra/thuc-hien">Hủy</Link>
        </Button>
      </div>
    </form>
  );
}
