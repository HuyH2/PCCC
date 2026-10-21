"use client";

import * as React from "react";
import { Download, Eye, FileText, Pencil, Plus, Trash2, Upload, UserRound } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiData, useApiData } from "@/lib/use-api-data";
import type {
  FacilityAttachmentPage,
  FacilityPersonnel,
  FacilityPersonnelPage,
} from "@/lib/facility-contract";

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(value: number) {
  return new Date(value).toLocaleString("vi-VN");
}

async function saveJson<T>(path: string, method: "POST" | "PUT", body: unknown) {
  return apiData<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function PersonnelEditor({
  facilityId,
  personnel,
  onSaved,
  onCancel,
}: {
  facilityId: string;
  personnel: FacilityPersonnel | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = React.useState(personnel?.full_name ?? "");
  const [position, setPosition] = React.useState(personnel?.position ?? "");
  const [phone, setPhone] = React.useState(personnel?.phone ?? "");
  const [email, setEmail] = React.useState(personnel?.email ?? "");
  const [isHead, setIsHead] = React.useState(Boolean(personnel?.is_head));
  const [trainingStatus, setTrainingStatus] = React.useState(personnel?.training_status ?? "");
  const [certificateExpiry, setCertificateExpiry] = React.useState(
    personnel?.certificate_expiry ?? "",
  );
  const [notes, setNotes] = React.useState(personnel?.notes ?? "");
  const [isActive, setIsActive] = React.useState(personnel ? Boolean(personnel.is_active) : true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fullName.trim() || !position.trim()) {
      setError("Vui lòng nhập họ tên và chức vụ/vai trò.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveJson(
        `/api/facilities/${encodeURIComponent(facilityId)}/personnel${
          personnel ? `/${encodeURIComponent(personnel.id)}` : ""
        }`,
        personnel ? "PUT" : "POST",
        {
          fullName: fullName.trim(),
          position: position.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          isHead,
          trainingStatus: trainingStatus.trim() || null,
          certificateExpiry: certificateExpiry || null,
          notes: notes.trim(),
          isActive,
          ...(personnel ? { version: personnel.version } : {}),
        },
      );
      onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể lưu hồ sơ nhân sự.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border p-4 sm:p-5">
      <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-4 font-semibold">
          {personnel ? "Cập nhật hồ sơ nhân sự" : "Thêm nhân sự cơ sở"}
        </legend>
        <div className="space-y-2">
          <Label htmlFor="personnel-name">Họ và tên *</Label>
          <Input
            id="personnel-name"
            value={fullName}
            maxLength={150}
            required
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="personnel-position">Chức vụ/vai trò *</Label>
          <Input
            id="personnel-position"
            value={position}
            maxLength={150}
            required
            placeholder="Ví dụ: Đội trưởng đội PCCC cơ sở"
            onChange={(event) => setPosition(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="personnel-phone">Số điện thoại</Label>
          <Input
            id="personnel-phone"
            type="tel"
            value={phone}
            maxLength={25}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="personnel-email">Email</Label>
          <Input
            id="personnel-email"
            type="email"
            value={email}
            maxLength={254}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="personnel-training">Tình trạng huấn luyện</Label>
          <Input
            id="personnel-training"
            value={trainingStatus}
            maxLength={100}
            placeholder="Theo hồ sơ/chứng nhận thực tế"
            onChange={(event) => setTrainingStatus(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="personnel-certificate">Hạn chứng nhận</Label>
          <Input
            id="personnel-certificate"
            type="date"
            value={certificateExpiry}
            onChange={(event) => setCertificateExpiry(event.target.value)}
          />
        </div>
        <div className="space-y-3 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isHead}
              onChange={(event) => {
                setIsHead(event.target.checked);
                if (event.target.checked) setIsActive(true);
              }}
            />
            Người đứng đầu cơ sở
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => {
                setIsActive(event.target.checked);
                if (!event.target.checked) setIsHead(false);
              }}
            />
            Đang hoạt động tại cơ sở
          </label>
          {isHead && (
            <p className="text-muted-foreground text-xs">
              Lưu hồ sơ này sẽ chuyển người đứng đầu hiện tại thành nhân sự thường và giữ lịch sử
              thay đổi.
            </p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="personnel-notes">Ghi chú</Label>
          <Textarea
            id="personnel-notes"
            value={notes}
            maxLength={2000}
            rows={3}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm sm:col-span-2">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Hủy
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu hồ sơ"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

function PersonnelPanel({ facilityId, canEdit }: { facilityId: string; canEdit: boolean }) {
  const url = `/api/facilities/${encodeURIComponent(facilityId)}/personnel?includeInactive=true&pageSize=100`;
  const personnel = useApiData<FacilityPersonnelPage>(url);
  const [editing, setEditing] = React.useState<FacilityPersonnel | "new" | null>(null);

  return (
    <section className="space-y-4" aria-labelledby="facility-personnel-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="facility-personnel-title" className="font-semibold">
            Người đứng đầu và nhân sự cơ sở
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Quản lý hồ sơ liên hệ, vai trò và thông tin huấn luyện theo từng cơ sở.
          </p>
        </div>
        {canEdit && !editing && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus /> Thêm nhân sự
          </Button>
        )}
      </div>
      {editing && (
        <PersonnelEditor
          key={editing === "new" ? "new" : editing.id}
          facilityId={facilityId}
          personnel={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            personnel.reload();
          }}
        />
      )}
      {personnel.loading ? (
        <p role="status" className="text-muted-foreground text-sm">
          Đang tải danh sách nhân sự…
        </p>
      ) : personnel.error ? (
        <p role="alert" className="text-destructive text-sm">
          {personnel.error}
        </p>
      ) : personnel.data?.items.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {personnel.data.items.map((item) => (
            <article
              key={item.id}
              className={`rounded-xl border p-4 ${item.is_active ? "" : "opacity-65"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{item.full_name}</h3>
                    {item.is_head ? (
                      <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
                        Người đứng đầu
                      </span>
                    ) : null}
                    {!item.is_active ? (
                      <span className="bg-muted rounded-full px-2 py-0.5 text-xs">
                        Ngưng hoạt động
                      </span>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">{item.position}</p>
                </div>
                {canEdit && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Sửa hồ sơ ${item.full_name}`}
                    onClick={() => setEditing(item)}
                  >
                    <Pencil />
                  </Button>
                )}
              </div>
              <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Điện thoại</dt>
                  <dd>{item.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="break-all">{item.email || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Huấn luyện</dt>
                  <dd>{item.training_status || "Chưa cập nhật"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Hạn chứng nhận</dt>
                  <dd>{item.certificate_expiry || "—"}</dd>
                </div>
              </dl>
              {item.notes && <p className="mt-3 whitespace-pre-wrap text-sm">{item.notes}</p>}
              <p className="text-muted-foreground mt-3 text-xs">
                Cập nhật {formatTime(item.updated_at)} bởi {item.updated_by_name}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Chưa có nhân sự cơ sở"
          description="Thêm người đứng đầu hoặc thành viên phụ trách PCCC của cơ sở."
          icon={UserRound}
        />
      )}
    </section>
  );
}

function AttachmentsPanel({ facilityId, canEdit }: { facilityId: string; canEdit: boolean }) {
  const url = `/api/facilities/${encodeURIComponent(facilityId)}/attachments?pageSize=100`;
  const attachments = useApiData<FacilityAttachmentPage>(url);
  const personnel = useApiData<FacilityPersonnelPage>(
    `/api/facilities/${encodeURIComponent(facilityId)}/personnel?pageSize=100`,
  );
  const [file, setFile] = React.useState<File | null>(null);
  const [documentType, setDocumentType] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [personnelId, setPersonnelId] = React.useState("");
  const [issueDate, setIssueDate] = React.useState("");
  const [expiryDate, setExpiryDate] = React.useState("");
  const [permitted, setPermitted] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const input = React.useRef<HTMLInputElement>(null);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      if (!file || !attachments.data) throw new Error("Vui lòng chọn tệp cần tải lên.");
      if (!documentType.trim()) throw new Error("Vui lòng nhập loại tài liệu.");
      if (!permitted) throw new Error("Cần xác nhận tài liệu được phép lưu trên hệ thống.");
      if (issueDate && expiryDate && expiryDate < issueDate)
        throw new Error("Ngày hết hạn phải sau hoặc bằng ngày cấp.");
      const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
      if (!attachments.data.allowedExtensions.includes(extension))
        throw new Error("Chỉ nhận PDF, ảnh, Word hoặc Excel.");
      if (file.size <= 0 || file.size > attachments.data.maxFileBytes)
        throw new Error("Tệp rỗng hoặc vượt quá dung lượng cho phép.");
      const form = new FormData();
      form.set("file", file);
      form.set("documentType", documentType.trim());
      form.set("description", description.trim());
      form.set("personnelId", personnelId);
      form.set("issueDate", issueDate);
      form.set("expiryDate", expiryDate);
      form.set("permitted", "true");
      setSaving(true);
      await apiData(url, { method: "POST", body: form });
      setFile(null);
      setDocumentType("");
      setDescription("");
      setPersonnelId("");
      setIssueDate("");
      setExpiryDate("");
      setPermitted(false);
      if (input.current) input.current.value = "";
      attachments.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tải tài liệu lên.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!window.confirm("Ngừng sử dụng tài liệu này? Hồ sơ sẽ được lưu trong lịch sử.")) return;
    setError("");
    setDeletingId(attachmentId);
    try {
      await apiData(
        `/api/facilities/${encodeURIComponent(facilityId)}/attachments/${encodeURIComponent(attachmentId)}`,
        { method: "DELETE" },
      );
      attachments.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể ngừng sử dụng tài liệu.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="facility-attachments-title">
      <div>
        <h2 id="facility-attachments-title" className="font-semibold">
          Hồ sơ và tài liệu đính kèm
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Tài liệu được lưu trong kho riêng và chỉ mở qua API sau khi kiểm tra quyền cơ sở.
        </p>
      </div>
      {canEdit && attachments.data && (
        <form onSubmit={upload} className="rounded-xl border p-4 sm:p-5">
          <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-4 font-semibold">Tải tài liệu mới</legend>
            <div className="space-y-2">
              <Label htmlFor="facility-document-file">Tệp *</Label>
              <Input
                ref={input}
                id="facility-document-file"
                type="file"
                required
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-muted-foreground text-xs">
                PDF, ảnh, Word hoặc Excel · tối đa {formatBytes(attachments.data.maxFileBytes)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="facility-document-type">Loại tài liệu *</Label>
              <Input
                id="facility-document-type"
                value={documentType}
                maxLength={100}
                required
                list="facility-document-types"
                placeholder="Ví dụ: Phương án chữa cháy"
                onChange={(event) => setDocumentType(event.target.value)}
              />
              <datalist id="facility-document-types">
                <option value="Hồ sơ quản lý PCCC" />
                <option value="Phương án chữa cháy" />
                <option value="Chứng nhận huấn luyện" />
                <option value="Quyết định thành lập đội PCCC" />
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="facility-document-personnel">Liên kết nhân sự</Label>
              <select
                id="facility-document-personnel"
                value={personnelId}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                onChange={(event) => setPersonnelId(event.target.value)}
              >
                <option value="">Tài liệu chung của cơ sở</option>
                {personnel.data?.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.full_name} — {item.position}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="facility-document-description">Mô tả</Label>
              <Input
                id="facility-document-description"
                value={description}
                maxLength={1000}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facility-document-issue-date">Ngày cấp</Label>
              <Input
                id="facility-document-issue-date"
                type="date"
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facility-document-expiry-date">Ngày hết hạn</Label>
              <Input
                id="facility-document-expiry-date"
                type="date"
                min={issueDate || undefined}
                value={expiryDate}
                onChange={(event) => setExpiryDate(event.target.value)}
              />
            </div>
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={permitted}
                onChange={(event) => setPermitted(event.target.checked)}
              />
              <span>
                Tôi xác nhận tài liệu được phép lưu trên hệ thống, không chứa tài liệu mật, bí mật
                nhà nước hoặc dữ liệu chưa được cho phép.
              </span>
            </label>
            {error && (
              <p role="alert" className="text-destructive text-sm sm:col-span-2">
                {error}
              </p>
            )}
            <div className="sm:col-span-2">
              <Button type="submit" size="sm" disabled={saving || !file || !permitted}>
                <Upload /> {saving ? "Đang tải lên…" : "Tải lên"}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      {attachments.loading ? (
        <p role="status" className="text-muted-foreground text-sm">
          Đang tải tài liệu…
        </p>
      ) : attachments.error ? (
        <p role="alert" className="text-destructive text-sm">
          {attachments.error}
        </p>
      ) : attachments.data?.items.length ? (
        <div className="space-y-3">
          {attachments.data.items.map((attachment) => (
            <article
              key={attachment.id}
              className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"
            >
              <FileText className="text-primary size-6 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h3 className="break-words font-medium">{attachment.original_name}</h3>
                <p className="text-muted-foreground text-sm">
                  {attachment.document_type} · {formatBytes(attachment.size_bytes)}
                  {attachment.personnel_name ? ` · ${attachment.personnel_name}` : ""}
                </p>
                {attachment.description && (
                  <p className="mt-1 whitespace-pre-wrap text-sm">{attachment.description}</p>
                )}
                <p className="text-muted-foreground mt-1 text-xs">
                  Tải lên {formatTime(attachment.uploaded_at)} bởi {attachment.uploaded_by_name}
                </p>
                {(attachment.issue_date || attachment.expiry_date) && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {attachment.issue_date ? `Cấp ${attachment.issue_date}` : ""}
                    {attachment.issue_date && attachment.expiry_date ? " · " : ""}
                    {attachment.expiry_date ? `Hết hạn ${attachment.expiry_date}` : ""}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`/api/facilities/${encodeURIComponent(facilityId)}/attachments/${encodeURIComponent(attachment.id)}/view`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Eye /> Xem
                  </a>
                </Button>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deletingId === attachment.id}
                    onClick={() => void removeAttachment(attachment.id)}
                    aria-label={`Ngừng sử dụng ${attachment.original_name}`}
                  >
                    <Trash2 /> {deletingId === attachment.id ? "Đang lưu…" : "Ngừng dùng"}
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`/api/facilities/${encodeURIComponent(facilityId)}/attachments/${encodeURIComponent(attachment.id)}/download`}
                    download
                  >
                    <Download /> Tải xuống
                  </a>
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Chưa có tài liệu"
          description="Tải hồ sơ chung của cơ sở hoặc liên kết tài liệu với một nhân sự cụ thể."
          icon={FileText}
        />
      )}
    </section>
  );
}

export function FacilityProfileManager({
  facilityId,
  canEdit,
}: {
  facilityId: string;
  canEdit: boolean;
}) {
  return (
    <Tabs defaultValue="personnel" className="rounded-xl border p-4 sm:p-5">
      <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-fit">
        <TabsTrigger value="personnel">Nhân sự cơ sở</TabsTrigger>
        <TabsTrigger value="attachments">Hồ sơ & tài liệu</TabsTrigger>
      </TabsList>
      <TabsContent value="personnel">
        <PersonnelPanel facilityId={facilityId} canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="attachments">
        <AttachmentsPanel facilityId={facilityId} canEdit={canEdit} />
      </TabsContent>
    </Tabs>
  );
}
