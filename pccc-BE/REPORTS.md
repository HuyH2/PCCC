# Báo cáo, deadline và thông báo (M08, UC-SYS-03)

Migration `018-reports-notifications.sql` tạo `report_types`, `report_requests`,
`report_submissions`, `report_schedules` và `notifications`. Dự án dùng `accounts` cho
người dùng, không có bảng `users`. File báo cáo được giữ trong SQLite cùng metadata và
chỉ tải được qua endpoint đã kiểm tra session, `M08.view` và scope. Bản nộp là append-only;
mọi thay đổi chính ghi `audit_logs`.

| Phương thức | Endpoint                                                     | Tác dụng                                                      |
| ----------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| GET, POST   | `/api/reports/types`                                         | Danh mục hoặc tạo loại báo cáo                                |
| PUT         | `/api/reports/types/:id`                                     | Sửa tên, mô tả, ngày nhắc, bật/tắt                            |
| GET         | `/api/reports/assignees`                                     | Cán bộ có quyền nhận/nộp trong scope                          |
| GET, POST   | `/api/reports/requests`                                      | Danh sách có tìm kiếm, phân trang, lọc hạn; tạo yêu cầu       |
| GET, PUT    | `/api/reports/requests/:id`                                  | Chi tiết hoặc điều chỉnh người thực hiện/deadline khi đang mở |
| POST        | `/api/reports/requests/:id/submit`                           | Nộp file, chuyển sang `submitted`                             |
| POST        | `/api/reports/requests/:id/complete`                         | Người yêu cầu xác nhận hoàn thành                             |
| GET         | `/api/reports/requests/:id/submissions/:submissionId/file`   | Tải file đã nộp                                               |
| GET, POST   | `/api/reports/schedules`                                     | Danh sách hoặc tạo lịch lặp                                   |
| PUT         | `/api/reports/schedules/:id`                                 | Tạm dừng/mở lại lịch                                          |
| POST        | `/api/reports/schedules/:id/generate`                        | Sinh một kỳ, tăng ngày hạn kỳ tới                             |
| GET, POST   | `/api/notifications`                                         | Thông báo của tôi; quản trị tạo thông báo dùng chung          |
| POST        | `/api/notifications/:id/read`, `/api/notifications/read-all` | Đánh dấu đã đọc                                               |

Upload dùng body file nhị phân với `Content-Type` và header URI-encoded `X-File-Name`,
`X-Report-Note`; giới hạn 10 MB, nhận PDF/PNG/JPEG/DOCX/XLSX. API mutation yêu cầu
`Origin` hợp lệ. `notifications.service.js` xuất `notifyUser(db, ...)` để các phân hệ khác
ghi thông báo trong transaction nghiệp vụ. Chuông và màn hình thông báo polling mỗi
30 giây. Backend quét hạn khi khởi động, mỗi giờ và khi client lấy thông báo; khóa
dedupe theo báo cáo/ngày tránh nhân bản trong một ngày. Nhắc trước hạn theo
`warning_days` của loại được chép vào yêu cầu lúc tạo; dừng tạo nhắc khi đã nộp/đóng.

Quyền mẫu Q02: A05 toàn hệ thống quản lý danh mục; A01/A02/A04 có thể giao báo cáo
trong scope; người được giao có `M08.edit` mới được nộp; người yêu cầu hoặc A05 với
`M08.approve` mới được xác nhận hoàn thành. Quyền seed chỉ là ví dụ, cần chốt với đơn vị
trước khi vận hành. Chu kỳ và ngưỡng cảnh báo của các loại mẫu cũng là giả lập (Q10).

`pnpm seed` trong môi trường demo tạo 5 loại, 48 yêu cầu, 4 lịch, 10 file mẫu và
thông báo tương ứng các hạn đang mở. Seed lại không thay yêu cầu/file đã chỉnh sửa.
Trên UI `/bao-cao`, dùng `demo.admin` tạo yêu cầu giao `demo.tong-hop`, đặt hạn,
sau đó đăng nhập người nhận để nộp file tại chi tiết. Quay về `demo.admin` để xác
nhận hoàn thành. Mở `/canh-bao` hoặc chuông để xem và đánh dấu đã đọc. Thử
**Lịch định kỳ → Sinh kỳ mới** để kiểm tra kỳ xuất hiện trong danh sách.
