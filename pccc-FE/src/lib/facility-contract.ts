export interface FacilityRecord {
  id: string;
  name: string;
  address: string;
  region_id: string;
  officer_id: string;
  status: string;
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

export const facilityStatusNames: Record<string, string> = {
  active: "Đang hoạt động",
  paused: "Tạm ngừng",
  suspended: "Đang đình chỉ",
  unlicensed: "Không phép",
};
