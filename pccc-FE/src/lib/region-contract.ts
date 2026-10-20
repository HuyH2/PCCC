export interface RegionUnit {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface Region {
  id: string;
  name: string;
  unit_id: string;
  unit_name: string;
  officer_account_id: string | null;
  officer_name: string | null;
  officer_code: string | null;
  assigned_at: number | null;
  facility_count: number;
  effective_date: string | null;
  assignment_note: string | null;
}

export interface RegionFacility {
  id: string;
  name: string;
  address: string;
  status: string;
  officer_id: string;
  officer_name: string | null;
}

export interface RegionOfficer {
  officer_id: string;
  full_name: string | null;
  account_id: string | null;
  role_code: string | null;
  status: string | null;
}

export interface AssignmentEvent {
  id: number;
  action: "assign" | "unassign";
  reason: string | null;
  effective_date: string | null;
  occurred_at: number;
  from_name: string | null;
  to_name: string | null;
  performed_by_name: string | null;
}

export interface RegionDetail {
  region: Region;
  facilities: RegionFacility[];
  officers: RegionOfficer[];
  history: AssignmentEvent[];
}

export interface AssignableOfficer {
  id: string;
  full_name: string;
  officer_id: string;
  role_code: string;
  region_count: number;
}

export async function regionApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401) {
    window.location.assign("/dang-nhap");
    throw new Error("Phiên đăng nhập đã hết hạn.");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Không thể xử lý yêu cầu.");
  return data as T;
}
