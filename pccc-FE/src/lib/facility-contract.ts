export interface FacilityRecord {
  id: string;
  name: string;
  address: string;
  region_id: string;
  region_name: string;
  officer_id: string;
  officer_name: string | null;
  status: string;
}

export interface FacilityRegionOption {
  id: string;
  name: string;
  unit_id: string;
  unit_name: string;
}

export interface FacilityOfficerOption {
  id: string;
  full_name: string;
  officer_code: string;
  unit_id: string;
}

export interface FacilityOptions {
  regions: FacilityRegionOption[];
  officers: FacilityOfficerOption[];
}

export interface FacilityTimelineItem {
  id: number;
  type: "status" | "details";
  previous_status: string | null;
  new_status: string | null;
  reason: string | null;
  decision_reference: string | null;
  before_json: string | null;
  after_json: string | null;
  occurred_at: number;
  actor_name: string | null;
  actor_username: string | null;
}

export interface FacilityTimelinePage {
  items: FacilityTimelineItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FacilityPersonnel {
  id: string;
  facility_id: string;
  full_name: string;
  position: string;
  phone: string | null;
  email: string | null;
  is_head: number;
  training_status: string | null;
  certificate_expiry: string | null;
  notes: string;
  is_active: number;
  version: number;
  created_at: number;
  updated_at: number;
  created_by_name: string;
  updated_by_name: string;
}

export interface FacilityPersonnelPage {
  items: FacilityPersonnel[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FacilityAttachment {
  id: string;
  facility_id: string;
  personnel_id: string | null;
  personnel_name: string | null;
  document_type: string;
  description: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  checksum: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  uploaded_by_name: string;
  uploaded_at: number;
}

export interface FacilityAttachmentPage {
  items: FacilityAttachment[];
  total: number;
  page: number;
  pageSize: number;
  maxFileBytes: number;
  allowedExtensions: string[];
}

export const facilityStatusNames: Record<string, string> = {
  active: "Đang hoạt động",
  paused: "Tạm ngừng",
  suspended: "Đang đình chỉ",
  unlicensed: "Không phép",
};
