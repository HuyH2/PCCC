export type ExplanationStatus = "requested" | "submitted" | "accepted" | "rejected";

export interface ExplanationRecord {
  id: number;
  task_id: string | null;
  account_id: string;
  period: string | null;
  requested_by: string;
  reason: string;
  response: string | null;
  status: ExplanationStatus;
  requested_at: number;
  submitted_at: number | null;
  reviewed_by: string | null;
  reviewed_at: number | null;
  review_note: string | null;
  debt_waived: number;
  account_name: string;
  account_username: string;
  requester_name: string;
  task_code: string | null;
  task_title: string | null;
  reviewer_name: string | null;
}

export interface ExplanationPage {
  items: ExplanationRecord[];
  total: number;
  page: number;
  pageSize: number;
  accounts: Array<{ id: string; full_name: string; username: string }>;
}
