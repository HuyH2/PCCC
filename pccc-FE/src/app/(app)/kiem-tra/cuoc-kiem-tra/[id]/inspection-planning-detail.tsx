"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Bell, CalendarClock, ClipboardCheck, History, Send } from "lucide-react";
import { nativeSelectClass } from "@/components/forms/legal-document-editor";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { Time24Input } from "@/components/ui/time-24-input";
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
import {
  type InspectionNotice,
  type InspectionReschedule,
  type PlanningInspection,
} from "@/lib/inspection-planning-contract";
import { formatIsoDate } from "@/lib/inspection-contract";
import { acceptedPlanningFiles, planningFilePayload } from "@/lib/inspection-planning-file";
import { apiData, useApiData } from "@/lib/use-api-data";

interface PlanningDetail {
  inspection: PlanningInspection;
  notice: InspectionNotice | null;
  reschedules: InspectionReschedule[];
  documents: Array<{ id: string; kind: string; file_name: string; file_size: number }>;
}

function NoticeDialog({ detail, onSaved }: { detail: PlanningDetail; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const file = await planningFilePayload(form.get("notice_file") as File | null);
      await apiData(`/api/inspections/${detail.inspection.id}/notice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notice_number: form.get("notice_number"),
          recipient_name: form.get("recipient_name"),
          recipient_contact: form.get("recipient_contact"),
          notice_text: form.get("notice_text"),
          sent_date: form.get("sent_date") || undefined,
          inspection_date: detail.inspection.scheduled_date,
          status: form.get("status"),
          version: detail.notice?.version,
          file,
        }),
      });
      setOpen(false);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể lưu thông báo.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Bell /> {detail.notice ? "Cập nhật thông báo" : "Lập thông báo"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Thông báo kiểm tra</DialogTitle>
            <DialogDescription>
              Ngày kiểm tra trên thông báo luôn theo lịch hiện tại:{" "}
              {formatIsoDate(detail.inspection.scheduled_date)}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="notice-number">Số thông báo</Label>
              <Input
                id="notice-number"
                name="notice_number"
                defaultValue={detail.notice?.notice_number}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notice-status">Trạng thái</Label>
              <select
                id="notice-status"
                name="status"
                className={nativeSelectClass}
                defaultValue={detail.notice?.status ?? "draft"}
              >
                <option value="draft">Bản nháp</option>
                <option value="sent">Đã gửi</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notice-recipient">Người nhận</Label>
              <Input
                id="notice-recipient"
                name="recipient_name"
                defaultValue={detail.notice?.recipient_name}
                maxLength={200}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notice-contact">Thông tin liên hệ</Label>
              <Input
                id="notice-contact"
                name="recipient_contact"
                defaultValue={detail.notice?.recipient_contact}
                maxLength={300}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notice-sent-date">Ngày gửi</Label>
              <Input
                id="notice-sent-date"
                name="sent_date"
                type="date"
                defaultValue={detail.notice?.sent_date ?? ""}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notice-text">Nội dung</Label>
              <Textarea
                id="notice-text"
                name="notice_text"
                defaultValue={detail.notice?.notice_text}
                maxLength={5000}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notice-file">Tệp thông báo (tùy chọn)</Label>
              <Input
                id="notice-file"
                name="notice_file"
                type="file"
                accept={acceptedPlanningFiles}
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu…" : "Lưu thông báo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RescheduleDialog({ detail, onSaved }: { detail: PlanningDetail; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const attachment = await planningFilePayload(form.get("reschedule_file") as File | null);
      const result = await apiData<{ warning: string | null }>(
        `/api/inspections/${detail.inspection.id}/reschedules`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: detail.inspection.schedule_version,
            new_date: form.get("new_date"),
            start_time: form.get("start_time") || undefined,
            end_time: form.get("end_time") || undefined,
            reason: form.get("reason"),
            attachment,
          }),
        },
      );
      setOpen(false);
      if (result.warning) window.alert(result.warning);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể dời lịch.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarClock /> Dời lịch
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Dời lịch kiểm tra</DialogTitle>
            <DialogDescription>
              Lịch cũ {formatIsoDate(detail.inspection.scheduled_date)} sẽ được giữ trong lịch sử.
              Lý do là bắt buộc.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-date">Ngày mới</Label>
            <Input id="new-date" name="new_date" type="date" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="new-start">Bắt đầu</Label>
              <Time24Input
                id="new-start"
                name="start_time"
                defaultValue={detail.inspection.start_time ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-end">Kết thúc</Label>
              <Time24Input
                id="new-end"
                name="end_time"
                defaultValue={detail.inspection.end_time ?? ""}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reschedule-reason">Lý do dời lịch</Label>
            <Textarea
              id="reschedule-reason"
              name="reason"
              minLength={1}
              maxLength={2000}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reschedule-file">Văn bản đề nghị/xác nhận (tùy chọn)</Label>
            <Input
              id="reschedule-file"
              name="reschedule_file"
              type="file"
              accept={acceptedPlanningFiles}
            />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu…" : "Xác nhận dời lịch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InspectionPlanningDetail({ id, user }: { id: string; user: AuthUser }) {
  const detail = useApiData<PlanningDetail>(`/api/inspections/${id}/planning`);
  if (detail.loading) return <p role="status">Đang tải hồ sơ kiểm tra…</p>;
  if (detail.error)
    return (
      <div role="alert" className="space-y-3 text-destructive">
        <p>{detail.error}</p>
        <Button variant="outline" onClick={detail.reload}>
          Thử lại
        </Button>
      </div>
    );
  if (!detail.data) return null;
  const value = detail.data;
  const canNotice = user.permissions.includes("M06.edit") && ["A03", "A04"].includes(user.role);
  const canReschedule = user.permissions.includes("M06.edit") && ["A01", "A03"].includes(user.role);
  return (
    <div className="space-y-5">
      <PageHeader
        title={`${value.inspection.code} · ${value.inspection.facility_name}`}
        description={`${value.inspection.region_name} · ${value.inspection.facility_address}`}
        module="M06"
        useCases={["UC-INS-03", "UC-INS-04", "UC-INS-05"]}
        actions={
          <>
            {canReschedule && <RescheduleDialog detail={value} onSaved={detail.reload} />}
            {canNotice && <NoticeDialog detail={value} onSaved={detail.reload} />}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Lịch kiểm tra"
          description="Lịch hiện tại dùng chung cho hồ sơ và calendar."
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Ngày kiểm tra</dt>
              <dd className="font-medium">{formatIsoDate(value.inspection.scheduled_date)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Khung giờ</dt>
              <dd className="font-medium">
                {value.inspection.start_time ?? "—"} – {value.inspection.end_time ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cán bộ phụ trách</dt>
              <dd className="font-medium">
                {value.inspection.lead_officer_name ?? value.inspection.lead_officer_id}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Trạng thái lịch</dt>
              <dd>
                <StatusBadge
                  value={
                    value.inspection.schedule_status === "rescheduled"
                      ? "Đã dời lịch"
                      : "Đã lên lịch"
                  }
                />
              </dd>
            </div>
          </dl>
        </SectionCard>
        <SectionCard
          title="Thông báo kiểm tra"
          description="Khi dời lịch, thông báo đã gửi được đưa về bản nháp để cập nhật lại."
        >
          {value.notice ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Số thông báo</dt>
                <dd className="font-medium">{value.notice.notice_number || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Trạng thái</dt>
                <dd>
                  <StatusBadge
                    value={value.notice.status === "sent" ? "Đã gửi thông báo" : "Thông báo nháp"}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Người nhận</dt>
                <dd className="font-medium">{value.notice.recipient_name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ngày gửi</dt>
                <dd>{value.notice.sent_date ? formatIsoDate(value.notice.sent_date) : "—"}</dd>
              </div>
              {value.notice.file_name && (
                <div>
                  <dt className="text-muted-foreground">Tệp thông báo</dt>
                  <dd>
                    <a
                      className="text-primary underline"
                      href={`/api/inspections/${id}/notice/file`}
                    >
                      {value.notice.file_name}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">Chưa lập thông báo kiểm tra.</p>
          )}
        </SectionCard>
      </div>
      {value.documents.length > 0 && (
        <SectionCard title="Quyết định đoàn kiểm tra">
          <ul className="space-y-2 text-sm">
            {value.documents.map((document) => (
              <li key={document.id}>
                <a
                  className="text-primary underline"
                  href={`/api/inspections/${id}/planning-documents/${document.id}/file`}
                >
                  {document.file_name}
                </a>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
      <SectionCard
        title="Lịch sử dời lịch"
        description="Mỗi lần thay đổi giữ ngày cũ, ngày mới, lý do, người thực hiện và thời gian."
        action={<History className="text-muted-foreground size-5" />}
        contentClassName="px-0 pb-0"
      >
        {value.reschedules.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày cũ</TableHead>
                <TableHead>Ngày mới</TableHead>
                <TableHead>Lý do</TableHead>
                <TableHead>Văn bản</TableHead>
                <TableHead>Người thực hiện</TableHead>
                <TableHead>Thời gian</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {value.reschedules.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatIsoDate(item.old_date)}</TableCell>
                  <TableCell>
                    <Badge variant="warning">{formatIsoDate(item.new_date)}</Badge>
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal">{item.reason}</TableCell>
                  <TableCell>
                    {item.attachment_name ? (
                      <a
                        className="text-primary underline"
                        href={`/api/inspections/${id}/reschedules/${item.id}/file`}
                      >
                        {item.attachment_name}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{item.changed_by_name}</TableCell>
                  <TableCell>{new Date(item.changed_at).toLocaleString("vi-VN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p role="status" className="text-muted-foreground px-5 pb-5">
            Chưa có lần dời lịch nào.
          </p>
        )}
      </SectionCard>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href="/kiem-tra/lich">
            <CalendarClock /> Xem calendar
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/kiem-tra/thuc-hien/${id}`}>
            <ClipboardCheck /> Thực hiện kiểm tra
          </Link>
        </Button>
        {value.notice?.status === "sent" && (
          <Badge variant="success" className="h-9 px-3">
            <Send /> Đã thông báo
          </Badge>
        )}
      </div>
    </div>
  );
}
