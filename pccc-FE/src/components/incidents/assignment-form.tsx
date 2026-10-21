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
  assignmentStatusNames,
  incidentSelectClass,
  vietnamDateTime,
  vietnamTimestamp,
  type IncidentAssignment,
  type IncidentOptions,
} from "@/lib/incident-contract";

export function AssignmentForm({
  incidentId,
  assignment,
  options,
  onSaved,
  progressOnly = false,
}: {
  incidentId: string;
  assignment?: IncidentAssignment;
  options: IncidentOptions;
  onSaved: () => void;
  progressOnly?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [officerId, setOfficerId] = React.useState(assignment?.officerId ?? "");
  const [task, setTask] = React.useState(assignment?.taskDescription ?? "");
  const [deadline, setDeadline] = React.useState(vietnamDateTime(assignment?.deadlineAt));
  const [status, setStatus] = React.useState(assignment?.status ?? "ASSIGNED");
  const [notes, setNotes] = React.useState(assignment?.notes ?? "");
  const [reason, setReason] = React.useState("");
  const id = React.useId();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (!officerId || !task.trim()) throw new Error("Chọn cán bộ và nhập nhiệm vụ cụ thể.");
      const deadlineAt = vietnamTimestamp(deadline);
      if (
        !progressOnly &&
        assignment?.deadlineAt != null &&
        (deadlineAt == null || deadlineAt > assignment.deadlineAt) &&
        !reason.trim()
      )
        throw new Error("Gia hạn nhiệm vụ phải có lý do.");
      if (!progressOnly && assignment && assignment.officerId !== officerId && !reason.trim())
        throw new Error("Điều chỉnh cán bộ phụ trách phải có lý do.");
      setSaving(true);
      await incidentApi(
        `/api/incidents/${encodeURIComponent(incidentId)}/assignments${assignment ? `/${encodeURIComponent(assignment.id)}` : ""}`,
        {
          method: assignment ? "PATCH" : "POST",
          body: progressOnly
            ? { status, notes }
            : { officerId, taskDescription: task, deadlineAt, status, notes, reason },
        },
      );
      toast.success("Đã lưu phân công");
      setOpen(false);
      onSaved();
    } catch (cause) {
      setError(incidentErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  return (
    <FormDialog
      trigger={
        <Button variant={assignment ? "ghost" : "outline"} size="sm">
          {progressOnly ? "Cập nhật tiến độ" : assignment ? "Điều chỉnh" : "Phân công cán bộ"}
        </Button>
      }
      title={
        progressOnly
          ? "Cập nhật tiến độ nhiệm vụ"
          : assignment
            ? "Điều chỉnh phân công"
            : "Phân công xử lý"
      }
      description="Một hồ sơ có thể giao nhiều cán bộ, mỗi người có nhiệm vụ và deadline riêng. Ngày giờ theo UTC+7."
      open={open}
      onOpenChange={(next) => {
        if (!saving) {
          setOpen(next);
          setError(null);
        }
      }}
      dangLuu={saving}
      onSubmit={submit}
    >
      <fieldset disabled={saving} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${id}-officer`}>Cán bộ</Label>
          <select
            id={`${id}-officer`}
            required
            disabled={progressOnly}
            value={officerId}
            onChange={(event) => setOfficerId(event.target.value)}
            className={incidentSelectClass}
          >
            <option value="">Chọn cán bộ đang công tác</option>
            {assignment &&
              !options.officers.some((officer) => officer.id === assignment.officerId) && (
                <option value={assignment.officerId}>{assignment.officerName}</option>
              )}
            {options.officers
              .filter(
                (officer) =>
                  !officer.status ||
                  officer.status === "ACTIVE" ||
                  officer.id === assignment?.officerId,
              )
              .map((officer) => (
                <option key={officer.id} value={officer.id}>
                  {officer.fullName}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-task`}>Nhiệm vụ</Label>
          <Textarea
            id={`${id}-task`}
            required
            disabled={progressOnly}
            maxLength={2000}
            value={task}
            onChange={(event) => setTask(event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${id}-deadline`}>Deadline nhiệm vụ (không bắt buộc)</Label>
            <Input
              id={`${id}-deadline`}
              type="datetime-local"
              disabled={progressOnly}
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-status`}>Tiến độ nhiệm vụ</Label>
            <select
              id={`${id}-status`}
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className={incidentSelectClass}
            >
              {Object.entries(assignmentStatusNames)
                .filter(
                  ([key]) =>
                    !assignment ||
                    !["COMPLETED", "CANCELLED"].includes(assignment.status) ||
                    key === assignment.status,
                )
                .map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-notes`}>Ghi chú</Label>
          <Textarea
            id={`${id}-notes`}
            maxLength={2000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        {assignment && !progressOnly && (
          <div className="space-y-2">
            <Label htmlFor={`${id}-reason`}>Lý do điều chỉnh / gia hạn</Label>
            <Textarea
              id={`${id}-reason`}
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </fieldset>
    </FormDialog>
  );
}
