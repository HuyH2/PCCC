"use client";

import * as React from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { incidentApi, incidentErrorMessage } from "@/lib/incident-client";
import {
  incidentSelectClass,
  processingStatusNames,
  vietnamDateTime,
  vietnamTimestamp,
  type Incident,
  type IncidentOptions,
  type IncidentPermissions,
  type ProcessingStatus,
} from "@/lib/incident-contract";

export function IncidentProgressForm({
  incident,
  options,
  permissions,
  onSaved,
}: {
  incident: Incident;
  options: IncidentOptions;
  permissions: IncidentPermissions;
  onSaved: () => void;
}) {
  const [mode, setMode] = React.useState<"deadline" | "status" | "complete" | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deadline, setDeadline] = React.useState(vietnamDateTime(incident.deadlineAt));
  const [status, setStatus] = React.useState<ProcessingStatus>(
    incident.processingStatus === "NEW" ? "IN_PROGRESS" : "CLOSED",
  );
  const [reason, setReason] = React.useState("");
  const id = React.useId();
  const terminal =
    incident.processingStatus === "COMPLETED" || incident.processingStatus === "CLOSED";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const deadlineAt = mode === "deadline" ? vietnamTimestamp(deadline) : null;
      if (
        mode === "deadline" &&
        incident.deadlineAt != null &&
        (deadlineAt == null || deadlineAt > incident.deadlineAt) &&
        !reason.trim()
      )
        throw new Error("Gia hạn hoặc bỏ deadline phải có lý do.");
      setSaving(true);
      await incidentApi(
        `/api/incidents/${encodeURIComponent(incident.id)}/${mode === "complete" ? "complete" : mode}`,
        {
          method: mode === "complete" ? "POST" : "PATCH",
          body: {
            reason,
            version: incident.version,
            ...(mode === "deadline"
              ? { deadlineAt }
              : mode === "status"
                ? { processingStatus: status }
                : {}),
          },
        },
      );
      toast.success(
        mode === "deadline"
          ? "Đã cập nhật deadline"
          : mode === "complete"
            ? "Đã hoàn thành hồ sơ"
            : "Đã cập nhật trạng thái",
      );
      setMode(null);
      onSaved();
    } catch (cause) {
      setError(incidentErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  function open(next: typeof mode) {
    setReason("");
    setError(null);
    setDeadline(vietnamDateTime(incident.deadlineAt));
    setMode(next);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {permissions.progress && !terminal && (
        <Button variant="outline" size="sm" onClick={() => open("deadline")}>
          Thiết lập / gia hạn deadline
        </Button>
      )}
      {((permissions.progress &&
        incident.recordStatus === "OFFICIAL" &&
        incident.processingStatus === "NEW") ||
        (permissions.approve && incident.processingStatus === "COMPLETED")) && (
        <Button variant="outline" size="sm" onClick={() => open("status")}>
          {incident.processingStatus === "COMPLETED" ? "Đóng hồ sơ" : "Cập nhật tiến độ"}
        </Button>
      )}
      {permissions.approve && incident.recordStatus === "OFFICIAL" && !terminal && (
        <Button size="sm" onClick={() => open("complete")}>
          Hoàn thành hồ sơ
        </Button>
      )}
      {mode && (
        <FormDialog
          trigger={<span className="hidden" />}
          open
          onOpenChange={(next) => {
            if (!next && !saving) setMode(null);
          }}
          title={
            mode === "deadline"
              ? "Thiết lập / gia hạn deadline"
              : mode === "complete"
                ? "Xác nhận hoàn thành hồ sơ"
                : "Cập nhật trạng thái"
          }
          description={
            mode === "complete"
              ? `Hoàn thành sẽ dừng cảnh báo deadline. ${options.policy.requireDocumentCompletion ? "Cấu hình hiện tại yêu cầu có tài liệu chứng minh." : "Tài liệu chứng minh chưa được cấu hình bắt buộc."}`
              : "Thay đổi được lưu vào lịch sử hồ sơ và nhật ký thao tác."
          }
          dangLuu={saving}
          nhanLuu={mode === "complete" ? "Xác nhận hoàn thành" : "Lưu"}
          onSubmit={submit}
        >
          <fieldset disabled={saving} className="space-y-4">
            {mode === "deadline" && (
              <div className="space-y-2">
                <Label htmlFor={`${id}-deadline`}>
                  Deadline (UTC+7); để trống nếu chưa xác định
                </Label>
                <Input
                  id={`${id}-deadline`}
                  type="datetime-local"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                />
              </div>
            )}
            {mode === "status" && (
              <div className="space-y-2">
                <Label htmlFor={`${id}-status`}>Trạng thái mới</Label>
                <select
                  id={`${id}-status`}
                  value={status}
                  className={incidentSelectClass}
                  onChange={(event) => setStatus(event.target.value as ProcessingStatus)}
                >
                  <option
                    value={incident.processingStatus === "COMPLETED" ? "CLOSED" : "IN_PROGRESS"}
                  >
                    {
                      processingStatusNames[
                        incident.processingStatus === "COMPLETED" ? "CLOSED" : "IN_PROGRESS"
                      ]
                    }
                  </option>
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={`${id}-reason`}>Lý do / ghi chú</Label>
              <Textarea
                id={`${id}-reason`}
                maxLength={2000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
          </fieldset>
        </FormDialog>
      )}
    </div>
  );
}
