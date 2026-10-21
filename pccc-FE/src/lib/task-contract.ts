export interface TaskRecord {
  id: string;
  code: string;
  title: string;
  description: string;
  status: "open" | "completed" | "cancelled";
  kind: "routine" | "unscheduled" | "assigned";
  due_at: number | null;
  progress: number;
  completed_at: number | null;
  updated_at: number | null;
  created_at: number;
  assigned_by: string;
  assigned_to: string;
  assigner_name: string;
  assignee_name: string;
}

export interface TaskMessage {
  id: number;
  task_id: string;
  sender_id: string;
  sender_name: string;
  sender_username: string;
  body: string | null;
  created_at: number;
  edited_at: number | null;
  deleted_at: number | null;
}

export interface TaskMessagePage {
  items: TaskMessage[];
  total: number;
  page: number;
  pageSize: number;
}
