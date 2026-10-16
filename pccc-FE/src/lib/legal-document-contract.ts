export const documentStatuses = {
  effective: "Còn hiệu lực",
  expired: "Hết hiệu lực",
  pending: "Chưa có hiệu lực",
} as const;
export interface DocumentCategory {
  id: string;
  name: string;
}
export interface LegalDocument {
  id: string;
  category_id: string;
  category_name: string;
  title: string;
  reference_number: string;
  issuing_authority: string;
  issued_date: string | null;
  effective_date: string;
  status: keyof typeof documentStatuses;
  source_url: string | null;
  file_name: string | null;
  file_size: number | null;
  notes: string;
  version: number;
  created_by: string;
  updated_by: string;
  created_at: number;
  updated_at: number;
}
export interface AuditEntry {
  id: number;
  actor_id?: string | null;
  actor_name: string | null;
  actor_username?: string | null;
  feature?: string;
  object_type?: string;
  object_id?: string | null;
  action: string;
  occurred_at: number;
  before_json: string | null;
  after_json: string | null;
  ip?: string;
}
export const auditActionLabels: Record<string, string> = {
  "legal_document.created": "Thêm văn bản",
  "legal_document.updated": "Cập nhật / phân loại văn bản",
  "legal_document.file_uploaded": "Thay file văn bản",
  "legal_document.seeded": "Khởi tạo văn bản mẫu",
  "auth.login": "Đăng nhập",
  "auth.login_failed": "Đăng nhập không thành công",
  "auth.logout": "Đăng xuất",
  "auth.password_changed": "Đổi mật khẩu",
  "auth.password_change_skipped": "Bỏ qua đổi mật khẩu lần đầu",
  "authorization.role_permissions_changed": "Thay đổi quyền vai trò",
  "authorization.account_changed": "Thay đổi quyền / phạm vi tài khoản",
};
export function formatAuditTime(value: number) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}
