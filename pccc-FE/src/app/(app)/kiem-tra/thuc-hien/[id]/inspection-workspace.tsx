"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Circle, Pencil } from "lucide-react";
import { nativeSelectClass } from "@/components/forms/legal-document-editor";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  checklistResultStatuses,
  formatIsoDate,
  inspectionKinds,
  inspectionOutcomes,
  inspectionStatuses,
  type ChecklistSummary,
  type InspectionDetail,
  type InspectionItem,
} from "@/lib/inspection-contract";
import { formatAuditTime } from "@/lib/legal-document-contract";
import { useApiData } from "@/lib/use-api-data";
import { cn } from "@/lib/utils";
import { DocumentsPanel, FollowUpPanel } from "./inspection-records";
import { jsonRequest, useMutation } from "./use-mutation";
import {
  IconAction,
  SectionBody,
  SectionError,
  SectionFooter,
  SectionNotice,
  WorkspaceSection,
} from "./workspace-section";

export function InspectionWorkspace({ id, canEdit }: { id: string; canEdit: boolean }) {
  const detail = useApiData<InspectionDetail>(`/api/inspections/${encodeURIComponent(id)}`);
  // Kept outside the reloaded subtree so saving does not jump back to the first tab.
  const [tab, setTab] = useState("checklist");
  if (detail.loading && !detail.data) return <p role="status">Đang tải cuộc kiểm tra…</p>;
  if (detail.error || !detail.data)
    return (
      <div role="alert" className="space-y-3">
        <p className="text-destructive">{detail.error || "Không tải được cuộc kiểm tra."}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={detail.reload}>
            Thử lại
          </Button>
          <Button variant="outline" asChild>
            <Link href="/kiem-tra/thuc-hien">Về danh sách</Link>
          </Button>
        </div>
      </div>
    );
  const data = detail.data;
  const { inspection } = data;
  const panelProps = { data, canEdit, onSaved: detail.reload };
  return (
    <div className="space-y-5">
      <PageHeader
        title={`Cuộc kiểm tra ${inspection.code}`}
        description={`${inspection.facility_name} — ${inspection.facility_address}`}
        module="M06"
        useCases={["UC-INS-06", "UC-INS-07", "UC-INS-08"]}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/kiem-tra/thuc-hien">Về danh sách</Link>
          </Button>
        }
      />
      {!canEdit && (
        <p
          role="status"
          className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
        >
          Bạn chỉ có quyền xem cuộc kiểm tra này. Đánh giá checklist, tải biên bản, kết luận và hậu
          kiểm cần quyền <strong>M06.edit</strong> (theo ma trận quyền mẫu: Phó chỉ huy/Tổ trưởng,
          Cán bộ kiểm tra). Quản trị hệ thống có thể cấp thêm tại Quản trị → Vai trò &amp; phạm vi.
        </p>
      )}
      <WorkspaceSection title="Thông tin cuộc kiểm tra">
        <SectionBody>
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Trạng thái", <StatusBadge key="s" value={inspectionStatuses[inspection.status]} />],
              ["Loại kiểm tra", <StatusBadge key="k" value={inspectionKinds[inspection.kind]} />],
              ["Ngày kiểm tra", formatIsoDate(inspection.scheduled_date)],
              ["Trưởng đoàn", inspection.lead_officer_name ?? inspection.lead_officer_id],
              ["Khu phố", inspection.region_name],
              ["Chuyên đề", inspection.topic ?? "—"],
              [
                "Kết quả",
                inspection.outcome ? (
                  <StatusBadge key="o" value={inspectionOutcomes[inspection.outcome]} />
                ) : (
                  "Chưa có"
                ),
              ],
              [
                "Hoàn thành lúc",
                inspection.completed_at ? formatAuditTime(inspection.completed_at) : "—",
              ],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
            <div className="sm:col-span-2 xl:col-span-4">
              <dt className="text-sm text-muted-foreground">Lý do / căn cứ</dt>
              <dd className="whitespace-pre-wrap">{inspection.reason || "—"}</dd>
            </div>
          </dl>
        </SectionBody>
      </WorkspaceSection>
      <CompletionPanel {...panelProps} onOpenTab={setTab} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full flex-wrap sm:w-fit">
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="documents">Biên bản & tài liệu ({data.documents.length})</TabsTrigger>
          <TabsTrigger value="conclusion">Kết luận</TabsTrigger>
          <TabsTrigger value="follow-up">Hậu kiểm ({data.followUps.length})</TabsTrigger>
        </TabsList>
        {/* Panels remount when the saved data changes, so drafts restart from the server copy. */}
        <TabsContent value="checklist">
          <ChecklistPanel key={inspection.version} {...panelProps} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsPanel key={data.documents.length} {...panelProps} />
        </TabsContent>
        <TabsContent value="conclusion">
          <ConclusionPanel key={inspection.version} {...panelProps} />
        </TabsContent>
        <TabsContent value="follow-up">
          <FollowUpPanel key={data.followUps.map((f) => f.status).join()} {...panelProps} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface PanelProps {
  data: InspectionDetail;
  canEdit: boolean;
  onSaved: () => void;
}

function ChecklistPanel({ data, canEdit, onSaved }: PanelProps) {
  const { inspection } = data;
  const url = `/api/inspections/${inspection.id}/results`;
  const mutation = useMutation(onSaved);
  const [items, setItems] = useState<InspectionItem[]>(data.items);
  const [note, setNote] = useState(inspection.officer_note);
  const [checklistId, setChecklistId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const editable = canEdit && ["planned", "in_progress"].includes(inspection.status);
  // Saved drafts open read-only; the pencil unlocks them again until results are locked.
  const hasSaved =
    data.items.some((i) => i.status !== "pending" || i.note) || Boolean(inspection.officer_note);
  const [editing, setEditing] = useState(!hasSaved);
  const locked = !editable || !editing;
  const checklists = useApiData<{ items: ChecklistSummary[] }>("/api/inspection-checklists");
  const update = (itemId: string, change: Partial<InspectionItem>) =>
    setItems((current) => current.map((i) => (i.id === itemId ? { ...i, ...change } : i)));

  if (!inspection.checklist_id)
    return (
      <WorkspaceSection
        title="Chọn checklist kiểm tra"
        description="Chọn checklist phù hợp loại cơ sở để bắt đầu thực hiện kiểm tra."
      >
        <SectionBody>
          <SectionError message={mutation.error || checklists.error} />
          {editable ? (
            <div className="space-y-2">
              <Label htmlFor="start-checklist">Checklist</Label>
              <select
                id="start-checklist"
                className={nativeSelectClass}
                value={checklistId}
                onChange={(e) => setChecklistId(e.target.value)}
              >
                <option value="">Chọn checklist</option>
                {checklists.data?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.facility_type ? ` — ${c.facility_type}` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <SectionNotice>Cuộc kiểm tra chưa có checklist.</SectionNotice>
          )}
        </SectionBody>
        <SectionFooter>
          <Button variant="outline" asChild>
            <Link href="/kiem-tra/checklist">Xem hướng dẫn checklist</Link>
          </Button>
          {editable && (
            <Button
              disabled={!checklistId || mutation.busy}
              onClick={() =>
                mutation.run(
                  url,
                  jsonRequest("PUT", {
                    version: inspection.version,
                    checklist_id: checklistId,
                    items: [],
                  }),
                  "Đã bắt đầu thực hiện kiểm tra",
                )
              }
            >
              Bắt đầu kiểm tra
            </Button>
          )}
        </SectionFooter>
      </WorkspaceSection>
    );

  const pendingRequired = items.filter((i) => i.is_required && i.status === "pending").length;
  // submit=true locks the results ("Chốt kết quả"); the API re-checks required items.
  const save = (submit: boolean) =>
    mutation.run(
      url,
      jsonRequest("PUT", {
        version: inspection.version,
        officer_note: note,
        items: items.map((i) => ({ item_id: i.id, status: i.status, note: i.note })),
        submit,
      }),
      submit ? "Đã chốt kết quả checklist" : "Đã lưu nháp kết quả checklist",
    );
  function cancelEdit() {
    setItems(data.items);
    setNote(inspection.officer_note);
    setEditing(false);
    mutation.setError("");
  }
  const description = inspection.results_submitted_at
    ? `Đã chốt lúc ${formatAuditTime(inspection.results_submitted_at)} bởi ${
        inspection.results_submitted_by_name ?? "—"
      }`
    : pendingRequired
      ? `Còn ${pendingRequired} nội dung bắt buộc chưa đánh giá`
      : "Đã đánh giá đủ nội dung bắt buộc";

  return (
    <WorkspaceSection
      title={inspection.checklist_name ?? "Checklist"}
      description={description}
      action={
        editable &&
        !editing && (
          <IconAction icon={Pencil} label="Chỉnh sửa kết quả" onClick={() => setEditing(true)} />
        )
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save(false);
        }}
      >
        <SectionBody locked={locked}>
          <SectionError message={mutation.error} />
          {inspection.results_submitted_at && (
            <SectionNotice>Kết quả checklist đã được chốt và không thể sửa.</SectionNotice>
          )}
          <fieldset disabled={locked || mutation.busy} className="space-y-3">
            <ol className="space-y-3">
              {items.map((item) => (
                <li key={item.id} className="space-y-2 rounded-lg border p-3">
                  <div className="font-medium">
                    {item.position}. {item.content}
                    {item.is_required ? (
                      <span className="ml-1 text-destructive" title="Bắt buộc">
                        *
                      </span>
                    ) : null}
                  </div>
                  {item.guidance && (
                    <p className="text-sm text-muted-foreground">Hướng dẫn: {item.guidance}</p>
                  )}
                  <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
                    <legend className="sr-only">Kết quả nội dung {item.position}</legend>
                    {Object.entries(checklistResultStatuses).map(([value, label]) => (
                      <label key={value} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="radio"
                          name={`status-${item.id}`}
                          value={value}
                          checked={item.status === value}
                          onChange={() =>
                            update(item.id, { status: value as InspectionItem["status"] })
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  <Label htmlFor={`note-${item.id}`} className="sr-only">
                    Ghi chú nội dung {item.position}
                  </Label>
                  <Input
                    id={`note-${item.id}`}
                    value={item.note}
                    maxLength={1000}
                    placeholder="Ghi chú / tồn tại phát hiện"
                    onChange={(e) => update(item.id, { note: e.target.value })}
                  />
                </li>
              ))}
            </ol>
            <div className="space-y-2">
              <Label htmlFor="officer-note">Ghi chú của cán bộ kiểm tra</Label>
              <Textarea
                id="officer-note"
                value={note}
                maxLength={4000}
                rows={3}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </fieldset>
        </SectionBody>
        {editable &&
          (confirming ? (
            <SectionFooter role="alertdialog" aria-labelledby="confirm-submit-title">
              <p id="confirm-submit-title" className="mr-auto text-sm font-medium">
                Sau khi chốt, kết quả checklist và ghi chú không sửa được nữa. Xác nhận chốt?
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={mutation.busy}
                onClick={() => setConfirming(false)}
              >
                Hủy
              </Button>
              <Button type="button" disabled={mutation.busy} onClick={() => save(true)}>
                {mutation.busy ? "Đang chốt…" : "Xác nhận chốt"}
              </Button>
            </SectionFooter>
          ) : (
            <SectionFooter>
              {editing && hasSaved && (
                <Button type="button" variant="ghost" disabled={mutation.busy} onClick={cancelEdit}>
                  Hủy
                </Button>
              )}
              {editing && (
                <Button type="submit" variant="outline" disabled={mutation.busy}>
                  {mutation.busy ? "Đang lưu…" : "Lưu nháp"}
                </Button>
              )}
              <Button
                type="button"
                disabled={mutation.busy || pendingRequired > 0}
                title={pendingRequired > 0 ? "Đánh giá đủ nội dung bắt buộc để chốt" : undefined}
                onClick={() => setConfirming(true)}
              >
                Chốt kết quả
              </Button>
            </SectionFooter>
          ))}
      </form>
    </WorkspaceSection>
  );
}

function ConclusionPanel({ data, canEdit, onSaved }: PanelProps) {
  const { inspection } = data;
  const mutation = useMutation(onSaved);
  const [outcome, setOutcome] = useState(inspection.outcome ?? "");
  const [conclusion, setConclusion] = useState(inspection.conclusion);
  const editable = canEdit && ["in_progress", "evaluated"].includes(inspection.status);
  // Saved conclusions open read-only; the pencil unlocks them again.
  const hasSaved = Boolean(inspection.outcome);
  const [editing, setEditing] = useState(!hasSaved);
  const locked = !editable || !editing;
  const description =
    inspection.status === "planned"
      ? "Bắt đầu thực hiện checklist trước khi cập nhật kết luận."
      : hasSaved
        ? "Đã lưu kết quả và kết luận."
        : "Chưa có kết luận.";
  return (
    <WorkspaceSection
      title="Kết luận kiểm tra"
      description={description}
      action={
        editable &&
        !editing && (
          <IconAction icon={Pencil} label="Chỉnh sửa kết luận" onClick={() => setEditing(true)} />
        )
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!outcome || !conclusion.trim())
            return mutation.setError("Vui lòng chọn kết quả và nhập kết luận.");
          mutation.run(
            `/api/inspections/${inspection.id}/conclusion`,
            jsonRequest("PUT", { version: inspection.version, outcome, conclusion }),
            "Đã lưu kết luận kiểm tra",
          );
        }}
      >
        <SectionBody locked={locked}>
          <SectionError message={mutation.error} />
          <fieldset disabled={locked || mutation.busy} className="space-y-4">
            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="outcome">Kết quả kiểm tra *</Label>
              <select
                id="outcome"
                className={nativeSelectClass}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as typeof outcome)}
              >
                <option value="">Chọn kết quả</option>
                {Object.entries(inspectionOutcomes).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="conclusion">Kết luận / kiến nghị *</Label>
              <Textarea
                id="conclusion"
                value={conclusion}
                maxLength={4000}
                rows={4}
                onChange={(e) => setConclusion(e.target.value)}
              />
            </div>
          </fieldset>
        </SectionBody>
        {editable && editing && (
          <SectionFooter>
            {hasSaved && (
              <Button
                type="button"
                variant="ghost"
                disabled={mutation.busy}
                onClick={() => {
                  setOutcome(inspection.outcome ?? "");
                  setConclusion(inspection.conclusion);
                  setEditing(false);
                  mutation.setError("");
                }}
              >
                Hủy
              </Button>
            )}
            <Button type="submit" disabled={mutation.busy}>
              {mutation.busy ? "Đang lưu…" : "Lưu kết luận"}
            </Button>
          </SectionFooter>
        )}
      </form>
    </WorkspaceSection>
  );
}

/** Completion conditions and the complete action, shown above every tab. */
function CompletionPanel({
  data,
  canEdit,
  onSaved,
  onOpenTab,
}: PanelProps & { onOpenTab: (tab: string) => void }) {
  const { inspection, documents } = data;
  const mutation = useMutation(onSaved);
  if (inspection.status === "completed") return null;
  const readiness = [
    [inspection.status === "evaluated", "Đã chốt kết quả checklist", "checklist"],
    [
      Boolean(inspection.outcome && inspection.conclusion),
      "Đã lưu kết quả và kết luận",
      "conclusion",
    ],
    [documents.some((d) => d.kind === "record"), "Đã tải lên biên bản kiểm tra", "documents"],
  ] as const;
  const done = readiness.filter(([ok]) => ok).length;
  return (
    <WorkspaceSection
      title="Điều kiện hoàn thành"
      description={`${done}/${readiness.length} điều kiện đã đạt — bấm vào điều kiện để mở tab tương ứng`}
    >
      <SectionBody>
        <SectionError message={mutation.error} />
        <ul className="grid gap-2 sm:grid-cols-3">
          {readiness.map(([ok, label, tab]) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => onOpenTab(tab)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  ok
                    ? "border-success/40 bg-success/10 text-success"
                    : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                {ok ? (
                  <Check className="size-4 shrink-0" />
                ) : (
                  <Circle className="size-4 shrink-0" />
                )}
                {label}
              </button>
            </li>
          ))}
        </ul>
      </SectionBody>
      {canEdit && inspection.status !== "planned" && (
        <SectionFooter>
          <Button
            disabled={done < readiness.length || mutation.busy}
            onClick={() =>
              mutation.run(
                `/api/inspections/${inspection.id}/complete`,
                jsonRequest("POST", { version: inspection.version }),
                "Đã hoàn thành cuộc kiểm tra",
              )
            }
          >
            {mutation.busy ? "Đang hoàn thành…" : "Hoàn thành cuộc kiểm tra"}
          </Button>
        </SectionFooter>
      )}
    </WorkspaceSection>
  );
}
