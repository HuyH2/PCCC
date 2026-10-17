export type PlanStatus = "draft" | "published" | "closed";
export type PeriodType = "year" | "month" | "week";

export interface InspectionPlan {
  id: string;
  code: string;
  year: number;
  title: string;
  facility_group: string;
  legal_basis: string;
  unit_id: string;
  unit_name: string;
  annual_target: number;
  status: PlanStatus;
  version: number;
  inspection_count?: number;
  completed_count?: number;
}

export interface InspectionTarget {
  id: string;
  plan_id: string;
  parent_id: string | null;
  period_type: PeriodType;
  year: number;
  month: number | null;
  week: number | null;
  officer_id: string | null;
  officer_name: string | null;
  region_id: string | null;
  region_name: string | null;
  target_count: number;
  carryover_count: number;
  actual_count: number;
}

export interface PlanningOptions {
  units: Array<{ id: string; name: string }>;
  regions: Array<{ id: string; name: string; unit_id: string }>;
  officers: Array<{ id: string; officer_code: string; full_name: string; position: string }>;
  checklists: Array<{ id: string; name: string; facility_type: string | null }>;
}

export interface PlanningFacility {
  id: string;
  name: string;
  address: string;
  region_id: string;
  region_name: string;
  officer_id: string;
  officer_name: string | null;
  planned_count: number;
}

export interface InspectionSchedule {
  id: string;
  inspection_id: string;
  inspection_code: string;
  plan_id: string | null;
  scheduled_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string;
  status: "scheduled" | "rescheduled" | "cancelled";
  version: number;
  facility_id: string;
  facility_name: string;
  region_name: string;
  lead_officer_name: string | null;
  inspection_status: "planned" | "in_progress" | "completed";
  notice_status: "none" | "draft" | "sent";
}

export interface PlanningInspection {
  id: string;
  code: string;
  plan_id: string;
  target_id: string | null;
  facility_id: string;
  facility_name: string;
  facility_address: string;
  region_name: string;
  unit_id: string;
  scheduled_date: string;
  lead_officer_id: string;
  lead_officer_name: string | null;
  status: "planned" | "in_progress" | "completed";
  version: number;
  schedule_id: string;
  schedule_version: number;
  start_time: string | null;
  end_time: string | null;
  location: string;
  schedule_status: "scheduled" | "rescheduled" | "cancelled";
}

export interface InspectionNotice {
  id: string;
  inspection_id: string;
  notice_number: string;
  recipient_name: string;
  recipient_contact: string;
  notice_text: string;
  sent_date: string | null;
  inspection_date: string;
  status: "draft" | "sent";
  file_name: string | null;
  version: number;
}

export interface InspectionReschedule {
  id: string;
  old_date: string;
  new_date: string;
  old_start_time: string | null;
  new_start_time: string | null;
  reason: string;
  attachment_name: string | null;
  changed_by_name: string;
  changed_at: number;
}

export const planStatusLabels: Record<PlanStatus, string> = {
  draft: "Bản nháp",
  published: "Đã công bố nội bộ",
  closed: "Đã đóng",
};

export const noticeStatusLabels = {
  none: "Chưa có thông báo",
  draft: "Thông báo nháp",
  sent: "Đã gửi thông báo",
} as const;
