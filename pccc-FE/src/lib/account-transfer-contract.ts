export interface ManagedAccount {
  id: string;
  username: string;
  full_name: string;
  officer_id: string;
  role_code: string;
  status: "active" | "locked" | "inactive";
  facility_count?: number;
  region_count?: number;
}

export interface ManagedItem {
  id: string;
  name: string;
  region_name?: string;
  unit_name?: string;
  address?: string;
}

export interface AccountTransfer {
  id: string;
  source_account_id: string;
  target_account_id: string;
  source_name: string;
  target_name: string;
  actor_name: string;
  effective_at: number;
  reason: string;
  audit_log_id: number;
  items: Array<{ kind: "region" | "facility"; id: string; name: string }>;
}

export async function accountApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
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
