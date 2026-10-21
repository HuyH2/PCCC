export interface KpiRow {
  account_id: string;
  full_name: string;
  username: string;
  role_code: string;
  period: string;
  target_tasks: number;
  completed_tasks: number;
  previous_debt: number;
  debt: number;
  waived_debt: number;
  score: number;
  configured: boolean;
}

export interface KpiResultResponse {
  period: string;
  items: KpiRow[];
}

export interface KpiTarget {
  id: number;
  account_id: string;
  period: string;
  target_tasks: number;
  note: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
  full_name?: string;
  username?: string;
  role_code?: string;
}

export interface TaskAssignee {
  id: string;
  full_name: string;
  username: string;
  role_code: string;
}
