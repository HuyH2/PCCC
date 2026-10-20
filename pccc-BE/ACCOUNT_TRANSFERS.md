# Khóa tài khoản và chuyển giao phạm vi — UC-ADM-04

## Ánh xạ dữ liệu hiện tại

Repository hiện có `accounts` (tài khoản + `officer_id`), `regions` (khu vực),
`facilities.officer_id` (người phụ trách cơ sở) và `account_scopes` (quyền truy cập).
Các bảng `users`, `officers`, `areas`, `officer_assignments` trong yêu cầu chưa tồn tại ở schema này.
Migration `009-account-transfers.sql` bổ sung `region_assignments` cho người phụ trách khu vực hiện tại,
`account_transfers` và `account_transfer_items` cho lịch sử. Một khu vực có tối đa một người phụ trách;
mỗi cơ sở tiếp tục có một `officer_id`. Không tạo nguồn cơ sở thứ hai.

Migration `010-region-assignment-backfill.sql` chỉ gán khu vực đang có đúng một tài khoản với scope
`region` trực tiếp. Khu vực có nhiều hoặc không có scope trực tiếp vẫn chưa có người phụ trách trong
bảng mới; cần rà soát dữ liệu đó trước khi chuyển giao. Seed demo tạo phân công mẫu KP01/KP02, không
ghi đè phân công đã có.

## Quyền và thao tác

Chỉ A05 có `M01.view` và scope `all` được xem danh sách/lịch sử; thao tác khóa, mở khóa và chuyển
giao cần thêm `M01.edit`. Không khóa tài khoản đang thực hiện hoặc quản trị hoạt động cuối cùng.
Khóa thu hồi mọi session ngay; chỉ tài khoản `locked` được mở lại, không tự mở `inactive`.

Chuyển giao chỉ áp dụng cho hai tài khoản đang hoạt động, khác cán bộ. Người dùng chọn ít nhất một
khu vực/cơ sở đang thuộc cán bộ cũ; có thể chọn một phần hoặc toàn bộ. Chuyển giao có hiệu lực ngay,
không có lịch hẹn tương lai. API kiểm tra lại chủ sở hữu trong transaction trước khi ghi; lựa chọn cũ
trả `409 ASSIGNMENT_CHANGED`. Người phụ trách hiện tại, scope `region`/`facility` trực tiếp của bên
chuyển và bên nhận, session hai bên, audit và lịch sử được cập nhật cùng transaction. Scope rộng
`region`/`unit`/`all` vẫn là quyền truy cập rộng độc lập; chuyển riêng một cơ sở không tự loại trừ
cơ sở đó khỏi scope khu vực cũ. Quản trị phải rà soát tại Vai trò & phạm vi khi cán bộ đổi công tác.
Khi chuyển khu vực nhưng vẫn giữ cơ sở trong khu vực đó, hệ thống thêm scope cơ sở
trực tiếp để cán bộ cũ không mất quyền với cơ sở còn phụ trách.

Mỗi lần chuyển giao có `effective_at`, người thực hiện, lý do, cán bộ cũ/mới và danh sách đối tượng.
`account_transfers.audit_log_id` trỏ tới audit append-only; lịch sử không xóa khi đổi người tiếp.

## API

| Method | Endpoint                                                 | Nội dung                        |
| ------ | -------------------------------------------------------- | ------------------------------- |
| POST   | `/api/authorization/accounts/:id/lock`                   | Khóa + thu hồi phiên            |
| POST   | `/api/authorization/accounts/:id/unlock`                 | Mở tài khoản bị khóa            |
| GET    | `/api/account-transfers/candidates`                      | Tài khoản hoạt động có thể chọn |
| GET    | `/api/account-transfers/assignments?sourceAccountId=...` | Khu vực/cơ sở đang phụ trách    |
| POST   | `/api/account-transfers`                                 | Chuyển giao                     |
| GET    | `/api/account-transfers?page=1&pageSize=20`              | Lịch sử phân trang              |

Payload tạo: `{ "sourceAccountId": "DEMO-A03", "targetAccountId": "DEMO-A04",
"regionIds": ["KP01"], "facilityIds": ["CS001"], "reason": "Thay đổi công tác" }`.
Danh sách mỗi loại tối đa 100 và tổng tối đa 100. Mutation yêu cầu session và Origin hợp lệ như API
hiện có; lỗi có dạng `{ error: { code, message } }`.
