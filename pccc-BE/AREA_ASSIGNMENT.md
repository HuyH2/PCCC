# Phân công cán bộ theo khu vực — UC-ORG-03

## Ánh xạ dữ liệu hiện tại

Yêu cầu nghiệp vụ dùng các tên `areas`, `officer_assignments`, `users`; schema hiện tại đã có
`regions` (khu vực/khu phố), `region_assignments` (người phụ trách hiện tại) và `accounts`
(tài khoản, kèm `officer_id`). Không tạo bảng song song: mọi API mới đọc/ghi trên các bảng này.

`regions.unit_id` trỏ tới `units` (đơn vị/tổ/đội). Mỗi khu vực có tối đa một cán bộ phụ trách
(Q03 của dự án); mỗi cơ sở tiếp tục có một `officer_id`. Danh sách cán bộ lấy từ `accounts` và view
`officer_directory` cho tới khi schema cán bộ dùng chung (UC-ORG-02) được tích hợp.

Migration `011-area-assignment.sql` bổ sung:

- `assignment_events`: lịch sử phân công/bỏ phân công theo khu vực, gồm cán bộ cũ/mới, lý do,
  ngày hiệu lực, người thực hiện và `audit_log_id`. Không xóa/sửa lịch sử.
- Quyền `M02.view/edit` cho A01, A02; `M02.view/create/edit` cho A05. Migration cấp quyền vì seed
  giữ nguyên grant đã chỉnh trên database đang chạy.

## Quyền và phạm vi

| Hành động                              | Điều kiện                                  |
| -------------------------------------- | ------------------------------------------ |
| Xem danh mục/chi tiết khu vực          | `M02.view` + scope `all/unit/region`       |
| Tạo/sửa khu vực                        | `M02.create` / `M02.edit`                  |
| Phân công hoặc bỏ phân công            | `M02.edit`                                 |
| Danh sách tài khoản có thể phân công   | `M02.edit`                                 |

Danh sách khu vực luôn lọc theo `regionScope` trước khi tìm kiếm, đếm và phân trang; khu vực ngoài
phạm vi trả `404`. A01/A02 thao tác trong đơn vị được cấp; A05 có scope `all` quản trị toàn bộ.

## Phân công

`POST /api/regions/:id/assignment` nhận `{accountId, effectiveDate, note}`; `accountId = null` là bỏ
phân công. Tài khoản phải đang hoạt động, vai trò đang bật và mỗi `officer_id` chỉ gắn một tài khoản.

Trong một transaction, API cập nhật `region_assignments`, scope `region` trực tiếp của cán bộ mới,
gỡ scope `region` của cán bộ cũ (giữ scope `facility` cho các cơ sở cũ còn phụ trách), ghi audit và
`assignment_events`. `effectiveDate` là ngày nghiệp vụ (`YYYY-MM-DD`), không phải lịch hẹn tự động:
phân công có hiệu lực ngay, giống UC-ADM-04.

Phân công không thay đổi vai trò hay scope rộng (`all/unit`) của tài khoản. Quyền xem rộng vẫn cấu
hình tại `/quan-tri/vai-tro` (UC-ADM-03).

## Tài khoản — UC-ADM-02

`POST /api/authorization/accounts` tạo tài khoản với `{username, fullName, officerId, role, password,
scopes}`, mật khẩu băm scrypt, `must_change_password = 1`. `PUT /api/authorization/accounts/:id` sửa
họ tên, mã cán bộ, vai trò và phạm vi. `POST .../status` chuyển `active|locked|inactive` (không xóa
vật lý); `POST .../reset-password` đặt mật khẩu tạm và thu hồi mọi phiên. Mọi thay đổi vai trò,
phạm vi, mật khẩu hoặc trạng thái đều ghi audit và buộc đăng nhập lại.

## Kiểm thử

`pccc-BE/test/regions.test.js` kiểm tra: lọc theo scope, 403 khi thiếu `M02`, phân công/bỏ phân công
kèm lịch sử và đồng bộ scope, chặn trùng cán bộ/tên đăng nhập, tạo/sửa/ngưng/kích hoạt tài khoản và
thu hồi phiên khi đặt lại mật khẩu.
