"use client";
import { useState, type FormEvent } from "react";
import { Download, FileText, Plus, Upload } from "lucide-react";
import { nativeSelectClass } from "@/components/forms/legal-document-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  acceptedInspectionFiles,
  documentKinds,
  followUpOutcomes,
  formatIsoDate,
  type InspectionDetail,
} from "@/lib/inspection-contract";
import { formatAuditTime } from "@/lib/legal-document-contract";
import { jsonRequest, useMutation } from "./use-mutation";
import {
  IconAction,
  SectionBody,
  SectionError,
  SectionFooter,
  SectionNotice,
  WorkspaceSection,
} from "./workspace-section";

interface PanelProps {
  data: InspectionDetail;
  canEdit: boolean;
  onSaved: () => void;
}

const fileTypes: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

/** UC-INS-07 — upload the record (biên bản) and photo/document evidence. */
export function DocumentsPanel({ data, canEdit, onSaved }: PanelProps) {
  const { inspection, documents, followUps } = data;
  const mutation = useMutation(onSaved);
  const openFollowUp = followUps.some((f) => f.status === "open");
  const evidenceOnly = inspection.status === "completed";
  const canUpload =
    canEdit &&
    (["in_progress", "evaluated"].includes(inspection.status) || (evidenceOnly && openFollowUp));
  const [kind, setKind] = useState<keyof typeof documentKinds>(
    evidenceOnly ? "evidence" : "record",
  );
  // The parent remounts this panel after each upload, so the form collapses once saved.
  const [showForm, setShowForm] = useState(canUpload && documents.length === 0);
  const records = documents.filter((d) => d.kind === "record").length;

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return mutation.setError("Vui lòng chọn file.");
    const type = fileTypes[file.name.split(".").pop()?.toLowerCase() ?? ""];
    if (!type) return mutation.setError("Chỉ nhận file PDF, JPEG hoặc PNG.");
    const recordNumber = String(form.get("record_number") ?? "").trim();
    if (kind === "record" && !recordNumber) return mutation.setError("Vui lòng nhập số biên bản.");
    await mutation.run(
      `/api/inspections/${inspection.id}/documents`,
      {
        method: "POST",
        headers: {
          "Content-Type": type,
          "X-File-Name": encodeURIComponent(file.name),
          "X-Document-Kind": kind,
          "X-Record-Number": encodeURIComponent(recordNumber),
          "X-Document-Description": encodeURIComponent(
            String(form.get("description") ?? "").trim(),
          ),
        },
        body: file,
      },
      `Đã tải lên ${documentKinds[kind].toLowerCase()}`,
    );
  }

  const description =
    inspection.status === "planned"
      ? "Bắt đầu thực hiện checklist trước khi tải biên bản/tài liệu."
      : `${records} biên bản · ${documents.length - records} hình ảnh/tài liệu${
          evidenceOnly && canEdit && !openFollowUp
            ? " — chỉ bổ sung bằng chứng khi có hậu kiểm đang mở"
            : ""
        }`;

  return (
    <WorkspaceSection
      title="Biên bản & tài liệu kiểm tra"
      description={description}
      action={
        canUpload &&
        !showForm && (
          <IconAction icon={Upload} label="Tải lên tài liệu" onClick={() => setShowForm(true)} />
        )
      }
    >
      <SectionBody>
        {documents.length ? (
          <ul className="divide-y rounded-lg border">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 p-3">
                <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {documentKinds[d.kind]}
                    {d.record_number ? ` số ${d.record_number}` : ""}
                    {d.follow_up_id ? " (hậu kiểm)" : ""}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {d.file_name} · {(d.file_size / 1024).toFixed(0)} KB ·{" "}
                    {d.uploaded_by_name ?? "—"} · {formatAuditTime(d.uploaded_at)}
                  </div>
                  {d.description && <p className="text-sm">{d.description}</p>}
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon-sm" asChild>
                      <a
                        href={`/api/inspections/${inspection.id}/documents/${d.id}/file`}
                        aria-label={`Tải xuống ${d.file_name}`}
                      >
                        <Download />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Tải xuống</TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        ) : (
          <SectionNotice>Chưa có biên bản hoặc tài liệu.</SectionNotice>
        )}
      </SectionBody>
      {canUpload && showForm && (
        <form onSubmit={upload} className="flex flex-col gap-4">
          <SectionBody className="border-t pt-4">
            <SectionError message={mutation.error} />
            <fieldset disabled={mutation.busy} className="grid gap-4 md:grid-cols-2">
              <legend className="mb-2 text-sm font-medium">Tải lên tài liệu mới</legend>
              <div className="space-y-2">
                <Label htmlFor="document-kind">Loại tài liệu *</Label>
                <select
                  id="document-kind"
                  className={nativeSelectClass}
                  value={kind}
                  onChange={(e) => setKind(e.target.value as typeof kind)}
                >
                  {Object.entries(documentKinds)
                    .filter(([value]) => !evidenceOnly || value === "evidence")
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
              </div>
              {kind === "record" && (
                <div className="space-y-2">
                  <Label htmlFor="record-number">Số biên bản *</Label>
                  <Input id="record-number" name="record_number" maxLength={100} required />
                </div>
              )}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="document-description">Mô tả</Label>
                <Input id="document-description" name="description" maxLength={500} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="document-file">File (PDF, JPEG, PNG) *</Label>
                <Input
                  id="document-file"
                  name="file"
                  type="file"
                  accept={acceptedInspectionFiles}
                  required
                />
              </div>
            </fieldset>
          </SectionBody>
          <SectionFooter>
            {documents.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                disabled={mutation.busy}
                onClick={() => {
                  setShowForm(false);
                  mutation.setError("");
                }}
              >
                Hủy
              </Button>
            )}
            <Button type="submit" disabled={mutation.busy}>
              {mutation.busy ? "Đang tải lên…" : "Tải lên"}
            </Button>
          </SectionFooter>
        </form>
      )}
    </WorkspaceSection>
  );
}

/** UC-INS-08 — follow-up request (hậu kiểm) and its result. */
export function FollowUpPanel({ data, canEdit, onSaved }: PanelProps) {
  const { inspection, followUps } = data;
  const mutation = useMutation(onSaved);
  const open = followUps.find((f) => f.status === "open");
  const canCreate = canEdit && inspection.status === "completed" && !open;
  // The parent remounts this panel whenever a follow-up is created or closed.
  const [creating, setCreating] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.run(
      `/api/inspections/${inspection.id}/follow-ups`,
      jsonRequest("POST", {
        requirement: String(form.get("requirement") ?? "").trim(),
        due_date: String(form.get("due_date") ?? ""),
      }),
      "Đã tạo yêu cầu hậu kiểm",
    );
  }
  async function complete(event: FormEvent<HTMLFormElement>, followUpId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.run(
      `/api/inspections/${inspection.id}/follow-ups/${followUpId}`,
      jsonRequest("PUT", {
        outcome: String(form.get("outcome") ?? ""),
        result_note: String(form.get("result_note") ?? "").trim(),
      }),
      "Đã cập nhật kết quả hậu kiểm",
    );
  }

  const description =
    inspection.status !== "completed"
      ? "Yêu cầu hậu kiểm được tạo sau khi cuộc kiểm tra hoàn thành."
      : open
        ? `Đang mở — hạn ${formatIsoDate(open.due_date)}`
        : followUps.length
          ? "Không có yêu cầu hậu kiểm đang mở."
          : "Chưa có yêu cầu hậu kiểm.";

  return (
    <WorkspaceSection
      title="Hậu kiểm"
      description={description}
      action={
        canCreate &&
        !creating && (
          <IconAction icon={Plus} label="Tạo yêu cầu hậu kiểm" onClick={() => setCreating(true)} />
        )
      }
    >
      <SectionBody>
        <SectionError message={mutation.error} />
        {followUps.length > 0 ? (
          <ul className="space-y-3">
            {followUps.map((f) => (
              <li key={f.id} className="rounded-lg border">
                <div className="space-y-2 p-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">Hạn hậu kiểm: {formatIsoDate(f.due_date)}</span>
                    <span className="text-sm text-muted-foreground">
                      {f.status === "open"
                        ? "Đang mở"
                        : `${f.outcome ? followUpOutcomes[f.outcome] : ""} · ${
                            f.completed_at ? formatAuditTime(f.completed_at) : ""
                          }`}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">Yêu cầu: {f.requirement}</p>
                  {f.result_note && (
                    <p className="text-sm whitespace-pre-wrap">
                      Kết quả: {f.result_note} ({f.completed_by_name ?? "—"})
                    </p>
                  )}
                </div>
                {f.status === "open" && canEdit && (
                  <form
                    onSubmit={(e) => complete(e, f.id)}
                    className="space-y-3 border-t bg-muted/30 p-3"
                  >
                    <fieldset disabled={mutation.busy} className="grid gap-4 md:grid-cols-3">
                      <legend className="mb-2 text-sm font-medium">
                        Cập nhật kết quả hậu kiểm
                      </legend>
                      <div className="space-y-2">
                        <Label htmlFor={`outcome-${f.id}`}>Kết quả *</Label>
                        <select
                          id={`outcome-${f.id}`}
                          name="outcome"
                          required
                          defaultValue=""
                          className={nativeSelectClass}
                        >
                          <option value="" disabled>
                            Chọn kết quả
                          </option>
                          {Object.entries(followUpOutcomes).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`result-${f.id}`}>Nội dung kết quả *</Label>
                        <Textarea
                          id={`result-${f.id}`}
                          name="result_note"
                          required
                          maxLength={2000}
                          rows={2}
                        />
                      </div>
                    </fieldset>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className="mr-auto text-xs text-muted-foreground">
                        Ảnh/tài liệu khắc phục tải ở tab “Biên bản & tài liệu”.
                      </span>
                      <Button type="submit" disabled={mutation.busy}>
                        {mutation.busy ? "Đang lưu…" : "Lưu kết quả hậu kiểm"}
                      </Button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          !creating && <SectionNotice>Chưa có yêu cầu hậu kiểm.</SectionNotice>
        )}
      </SectionBody>
      {canCreate && creating && (
        <form onSubmit={create} className="flex flex-col gap-4">
          <SectionBody className="border-t pt-4">
            <fieldset disabled={mutation.busy} className="grid gap-4 md:grid-cols-3">
              <legend className="mb-2 text-sm font-medium">Tạo yêu cầu hậu kiểm</legend>
              <div className="space-y-2">
                <Label htmlFor="follow-up-due">Hạn hậu kiểm *</Label>
                <Input
                  id="follow-up-due"
                  name="due_date"
                  type="date"
                  min={inspection.scheduled_date}
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="follow-up-requirement">Nội dung yêu cầu khắc phục *</Label>
                <Textarea
                  id="follow-up-requirement"
                  name="requirement"
                  required
                  maxLength={2000}
                  rows={2}
                />
              </div>
            </fieldset>
          </SectionBody>
          <SectionFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={mutation.busy}
              onClick={() => {
                setCreating(false);
                mutation.setError("");
              }}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={mutation.busy}>
              {mutation.busy ? "Đang tạo…" : "Tạo yêu cầu hậu kiểm"}
            </Button>
          </SectionFooter>
        </form>
      )}
    </WorkspaceSection>
  );
}
