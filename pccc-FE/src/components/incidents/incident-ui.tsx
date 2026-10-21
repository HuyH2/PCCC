"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { incidentApi, incidentErrorMessage } from "@/lib/incident-client";
import {
  deadlineWarningNames,
  processingStatusNames,
  type Incident,
  type IncidentOptions,
} from "@/lib/incident-contract";

export function IncidentState({ incident }: { incident: Incident }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant={incident.recordStatus === "DRAFT" ? "muted" : "outline"}>
        {incident.recordStatus === "DRAFT" ? "Nháp" : "Chính thức"}
      </Badge>
      <Badge
        variant={
          incident.processingStatus === "COMPLETED" || incident.processingStatus === "CLOSED"
            ? "success"
            : "info"
        }
      >
        {processingStatusNames[incident.processingStatus]}
      </Badge>
    </div>
  );
}
export function DeadlineBadge({ incident }: { incident: Incident }) {
  const warning = incident.deadlineWarning;
  return (
    <Badge
      variant={
        warning === "OVERDUE"
          ? "danger"
          : warning === "DUE_SOON"
            ? "warning"
            : warning === "COMPLETED"
              ? "success"
              : "muted"
      }
    >
      {deadlineWarningNames[warning]}
    </Badge>
  );
}
export function IncidentLoading({
  children = "Đang tải dữ liệu…",
}: {
  children?: React.ReactNode;
}) {
  return (
    <p role="status" className="flex items-center justify-center gap-2 p-10 text-sm">
      <Loader2 className="size-4 animate-spin" />
      {children}
    </p>
  );
}
export function IncidentError({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-lg border p-4">
      <p className="text-destructive text-sm">{message}</p>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          Thử lại
        </Button>
      )}
    </div>
  );
}
export function useIncidentOptions(revision = 0) {
  const [options, setOptions] = React.useState<IncidentOptions | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    const controller = new AbortController();
    setError(null);
    incidentApi<IncidentOptions>("/api/incidents/options", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setOptions(result);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(incidentErrorMessage(cause));
      });
    return () => controller.abort();
  }, [revision]);
  return { options, error };
}
