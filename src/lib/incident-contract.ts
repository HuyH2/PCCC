export type IncidentType = string;
export type ProcessingStatus = "NEW" | "IN_PROGRESS" | "COMPLETED" | "CLOSED";
export type RecordStatus = "DRAFT" | "OFFICIAL";
export type DeadlineWarning = "NONE" | "ON_TIME" | "DUE_SOON" | "OVERDUE" | "COMPLETED";
export type AssignmentStatus = "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface IncidentAssignment {
  id: string;
  officerId: string;
  officerName: string;
  taskDescription: string;
  deadlineAt: number | null;
  status: AssignmentStatus;
  notes: string;
  assignedBy: string;
  assignedAt: number;
  completedAt: number | null;
  updatedAt: number;
}
export interface Incident {
  id: string;
  incidentCode: string;
  incidentType: IncidentType | null;
  incidentSubtype: string | null;
  title: string;
  description: string;
  occurredAt: number | null;
  reportedAt: number;
  address: string;
  sceneDetails: string;
  regionId: string | null;
  unitId: string | null;
  facilityId: string | null;
  regionName: string | null;
  unitName: string | null;
  facilityName: string | null;
  recordStatus: RecordStatus;
  processingStatus: ProcessingStatus;
  deadlineAt: number | null;
  deadlineWarning: DeadlineWarning;
  completedAt: number | null;
  createdBy: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  assignments: IncidentAssignment[];
}
export interface IncidentDamage {
  id: string;
  damageGroup: "HUMAN" | "PROPERTY";
  damageType: string;
  quantity: number;
  propertyValue: number;
  description: string;
  notes: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
}
export interface IncidentDocument {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: number;
}
export interface IncidentHistory {
  id: string | number;
  fromStatus: string | null;
  toStatus: string | null;
  fromRecordStatus?: RecordStatus | null;
  toRecordStatus?: RecordStatus | null;
  changedBy: string;
  changedAt: number;
  reason: string;
  notes: string;
  oldDeadlineAt: number | null;
  newDeadlineAt: number | null;
}
export interface IncidentAudit {
  id: number;
  action: string;
  actorId: string;
  occurredAt: number;
  before: unknown;
  after: unknown;
}
export interface IncidentDetail {
  incident: Incident;
  damages: IncidentDamage[];
  documents: IncidentDocument[];
  assignments: IncidentAssignment[];
  history?: IncidentHistory[];
  audit?: IncidentAudit[];
}
export interface IncidentList {
  items: Incident[];
  total: number;
  page: number;
  pageSize: number;
}
export interface IncidentOptions {
  units: { id: string; name: string; status?: string }[];
  regions: { id: string; name: string; unitId?: string; status?: string }[];
  facilities: { id: string; name: string; regionId?: string; status?: string }[];
  officers: { id: string; fullName: string; unitId: string; status?: string }[];
  incidentTypes: { code: IncidentType; name: string; subtypes: { code: string; name: string }[] }[];
  policy: {
    warningHours: number;
    requireDocumentCompletion: boolean;
    maxUploadBytes: number;
    allowedExtensions: string[];
    configurationLabel: string;
  };
}
export interface IncidentStatistics {
  total: number;
  byType: { key: string; name: string; count: number }[];
  byDay: { key: string; count: number }[];
  byMonth: { key: string; count: number }[];
  byYear: { key: string; count: number }[];
  byRegion: { key: string | null; name: string; count: number }[];
  damages: { human: { damageType: string; quantity: number }[]; propertyValue: number };
  processing: { new: number; inProgress: number; completed: number; closed: number };
  deadlines: { dueSoon: number; overdue: number };
  draftsExcluded: number;
  filters: Record<string, unknown>;
}

export const incidentTypeNames: Record<IncidentType, string> = {
  FIRE: "Cháy",
  EXPLOSION: "Nổ",
  RESCUE: "Cứu nạn cứu hộ",
  MEDICAL: "Hỗ trợ y tế",
};
export const processingStatusNames: Record<ProcessingStatus, string> = {
  NEW: "Mới tiếp nhận",
  IN_PROGRESS: "Đang xử lý",
  COMPLETED: "Hoàn thành",
  CLOSED: "Đã đóng",
};
export const deadlineWarningNames: Record<DeadlineWarning, string> = {
  NONE: "Chưa có deadline",
  ON_TIME: "Còn hạn",
  DUE_SOON: "Sắp đến hạn",
  OVERDUE: "Quá hạn",
  COMPLETED: "Đã hoàn thành/đóng",
};
export const assignmentStatusNames: Record<AssignmentStatus, string> = {
  ASSIGNED: "Đã giao",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};
export const damageTypeNames: Record<string, string> = {
  DEATH: "Người chết",
  INJURED: "Người bị thương",
  RESCUED: "Người được cứu",
  LOSS: "Tài sản thiệt hại",
  OTHER: "Khác",
};
export const incidentSelectClass =
  "border-input bg-background h-9 w-full min-w-0 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
export function incidentTime(value: number | null | undefined) {
  return value == null
    ? "—"
    : new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        dateStyle: "short",
        timeStyle: "short",
      }).format(value);
}
/** Form values are Vietnam local time regardless of the browser's timezone. */
export function vietnamDateTime(value: number | null | undefined) {
  return value == null ? "" : new Date(value + 7 * 3600000).toISOString().slice(0, 16);
}
export function vietnamTimestamp(value: string) {
  if (!value) return null;
  const timestamp = Date.parse(`${value}:00+07:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
    !Number.isFinite(timestamp) ||
    vietnamDateTime(timestamp) !== value
  ) {
    throw new Error("Ngày giờ không hợp lệ. Vui lòng kiểm tra lại.");
  }
  return timestamp;
}
export function incidentPermissions(permissions: string[]) {
  return {
    view: permissions.includes("M09.view"),
    create: permissions.includes("M09.create"),
    edit: permissions.includes("M09.edit"),
    approve: permissions.includes("M09.approve"),
    statistics: permissions.includes("M09.export"),
    progress: permissions.includes("M09.edit") || permissions.includes("M09.approve"),
  };
}
export type IncidentPermissions = ReturnType<typeof incidentPermissions>;
