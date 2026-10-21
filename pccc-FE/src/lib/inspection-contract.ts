/** Response shapes of /api/inspections* and /api/inspection-checklists* (M06, SCRUM-22). */
export const inspectionStatuses = {
  planned: "Lên kế hoạch",
  in_progress: "Đang thực hiện",
  evaluated: "Đã đánh giá",
  completed: "Hoàn thành",
} as const;
export const inspectionKinds = {
  periodic: "Định kỳ",
  unscheduled: "Đột xuất",
  thematic: "Chuyên đề",
} as const;
export const inspectionOutcomes = {
  pass: "Đạt",
  conditional: "Đạt có điều kiện",
  fail: "Không đạt",
} as const;
export const checklistResultStatuses = {
  pending: "Chưa đánh giá",
  pass: "Đạt",
  fail: "Không đạt",
  not_applicable: "Không áp dụng",
} as const;
export const followUpOutcomes = {
  resolved: "Đã khắc phục",
  unresolved: "Chưa khắc phục",
} as const;
export const documentKinds = { record: "Biên bản", evidence: "Hình ảnh / tài liệu" } as const;
export const acceptedInspectionFiles = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export interface Inspection {
  id: string;
  code: string;
  facility_id: string;
  facility_name: string;
  facility_address: string;
  region_name: string;
  kind: keyof typeof inspectionKinds;
  topic: string | null;
  reason: string;
  scheduled_date: string;
  lead_officer_id: string;
  lead_officer_name: string | null;
  status: keyof typeof inspectionStatuses;
  checklist_id: string | null;
  checklist_name: string | null;
  officer_note: string;
  results_submitted_at: number | null;
  results_submitted_by_name: string | null;
  outcome: keyof typeof inspectionOutcomes | null;
  conclusion: string;
  completed_at: number | null;
  version: number;
  created_at: number;
  updated_at: number;
}
export interface ChecklistSummary {
  id: string;
  name: string;
  facility_type: string | null;
  description: string;
  legal_document_id: string | null;
  legal_document_title: string | null;
  item_count: number;
}
export interface ChecklistItem {
  id: string;
  position: number;
  content: string;
  guidance: string;
  legal_reference: string;
  is_required: 0 | 1;
}
export interface InspectionItem extends ChecklistItem {
  status: keyof typeof checklistResultStatuses;
  note: string;
}
export interface InspectionDocument {
  id: string;
  kind: keyof typeof documentKinds;
  follow_up_id: string | null;
  record_number: string | null;
  description: string;
  file_name: string;
  content_type: string;
  file_size: number;
  uploaded_by_name?: string | null;
  uploaded_at: number;
}
export interface FollowUp {
  id: string;
  requirement: string;
  due_date: string;
  status: "open" | "completed";
  outcome: keyof typeof followUpOutcomes | null;
  result_note: string;
  completed_by_name?: string | null;
  created_at: number;
  completed_at: number | null;
}
export interface InspectionDetail {
  inspection: Inspection;
  items: InspectionItem[];
  documents: InspectionDocument[];
  followUps: FollowUp[];
}

export const formatIsoDate = (value: string) => value.split("-").reverse().join("/");
