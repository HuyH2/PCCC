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
  "inspection_checklist.created": "Tạo checklist kiểm tra",
  "inspection.created": "Tạo cuộc kiểm tra",
  "inspection.seeded": "Khởi tạo cuộc kiểm tra mẫu",
  "inspection.results_saved": "Lưu nháp kết quả checklist",
  "inspection.results_submitted": "Chốt kết quả checklist",
  "inspection.document_uploaded": "Tải biên bản / tài liệu kiểm tra",
  "inspection.conclusion_updated": "Cập nhật kết luận kiểm tra",
  "inspection.completed": "Hoàn thành cuộc kiểm tra",
  "inspection.follow_up_created": "Tạo yêu cầu hậu kiểm",
  "inspection.follow_up_completed": "Cập nhật kết quả hậu kiểm",
  "auth.login": "Đăng nhập",
  "auth.login_failed": "Đăng nhập không thành công",
  "auth.logout": "Đăng xuất",
  "auth.password_changed": "Đổi mật khẩu",
  "auth.password_change_skipped": "Bỏ qua đổi mật khẩu lần đầu",
  "authorization.role_permissions_changed": "Thay đổi quyền vai trò",
  "authorization.account_changed": "Thay đổi quyền / phạm vi tài khoản",
  "account.locked": "Khóa tài khoản",
  "account.unlocked": "Mở khóa tài khoản",
  "account.transfer_completed": "Chuyển giao phạm vi quản lý",
};
export function formatAuditTime(value: number) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}
