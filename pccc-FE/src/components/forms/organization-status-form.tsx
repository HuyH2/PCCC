"use client";

import * as React from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/forms/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { organizationApi, organizationErrorMessage } from "@/lib/organization-client";
import {
  officerStatusNames,
  organizationPath,
  organizationSelectClass,
  type Officer,
  type OfficerStatus,
  type OrganizationNode,
} from "@/lib/organization-contract";

export function OrganizationStatusForm({
  trigger,
  officer,
  node,
  onSaved,
}: {
  trigger: React.ReactNode;
  officer?: Officer;
  node?: OrganizationNode;
  onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<OfficerStatus>(
    officer?.status ?? node?.status ?? "ACTIVE",
  );
  const [reason, setReason] = React.useState("");
  const [effectiveDate, setEffectiveDate] = React.useState("");
  const [confirmed, setConfirmed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fieldId = React.useId();
  const currentStatus = officer?.status ?? node?.status;

  function changeOpen(next: boolean) {
    if (saving) return;
    if (next) {
      setStatus(currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE");
      setReason("");
      setEffectiveDate("");
      setConfirmed(false);
      setError(null);
    }
    setOpen(next);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (status === currentStatus) {
      setError("Chọn trạng thái khác trạng thái hiện tại.");
      return;
    }
    if (!confirmed) {
      setError("Vui lòng xác nhận thay đổi trạng thái.");
      return;
    }
    if (officer && (!reason.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate))) {
      setError("Nhập lý do và ngày hiệu lực hợp lệ.");
      return;
    }
    if (!officer && !node) return;
    setSaving(true);
    setError(null);
    try {
      const path = officer
        ? `/api/officers/${encodeURIComponent(officer.id)}`
        : organizationPath(node!);
      await organizationApi(`${path}/status`, {
        method: "PATCH",
        body: officer ? { status, reason: reason.trim(), effectiveDate } : { status },
      });
      setOpen(false);
      toast.success("Đã cập nhật trạng thái");
      onSaved();
    } catch (cause) {
      setError(organizationErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={changeOpen}
      dangLuu={saving}
      onSubmit={save}
      title="Cập nhật trạng thái"
      nhanLuu="Xác nhận thay đổi"
      description={
        officer ? `${officer.fullName} · ${officer.officerCode}` : `${node?.name} · ${node?.code}`
      }
    >
      <fieldset disabled={saving} className="space-y-4">
        {error && (
          <p role="alert" className="text-destructive rounded-md border p-3 text-sm">
            {error}
          </p>
        )}
        <p className="text-muted-foreground text-sm">
          Trạng thái hiện tại:{" "}
          {officer
            ? officerStatusNames[officer.status]
            : node?.status === "ACTIVE"
              ? "Hoạt động"
              : "Ngưng hoạt động"}
        </p>
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-status`}>Trạng thái mới</Label>
          <select
            id={`${fieldId}-status`}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as OfficerStatus);
              setConfirmed(false);
            }}
            className={organizationSelectClass}
          >
            {(officer ? ["ACTIVE", "INACTIVE", "TRANSFERRED"] : ["ACTIVE", "INACTIVE"])
              .filter((value) => value !== currentStatus)
              .map((value) => (
                <option key={value} value={value}>
                  {officer
                    ? officerStatusNames[value as OfficerStatus]
                    : value === "ACTIVE"
                      ? "Hoạt động"
                      : "Ngưng hoạt động"}
                </option>
              ))}
          </select>
        </div>
        {officer && (
          <>
            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-reason`}>
                Lý do <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id={`${fieldId}-reason`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-date`}>
                Ngày hiệu lực <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`${fieldId}-date`}
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
                required
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Ngày hiệu lực được lưu trong lịch sử thay đổi. Hệ thống cập nhật trạng thái khi xác
              nhận lưu.
            </p>
            {officer.linkedActiveAccountCount > 0 && (
              <p className="text-sm">
                Cán bộ có {officer.linkedActiveAccountCount} tài khoản đang hoạt động. Xử lý tài
                khoản liên quan tại màn hình quản trị trước khi ngưng/chuyển công tác nếu hệ thống
                yêu cầu.
              </p>
            )}
          </>
        )}
        <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 size-4 shrink-0"
          />
          <span>
            Tôi xác nhận thay đổi trạng thái của {officer?.fullName ?? node?.name} và lưu lịch sử
            thao tác.
          </span>
        </label>
      </fieldset>
    </FormDialog>
  );
}
