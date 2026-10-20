# Phân công cán bộ theo khu vực — UC-ORG-03

## Ánh xạ dữ liệu hiện tại

Yêu cầu nghiệp vụ dùng các tên `areas`, `officer_assignments`, `users`; schema hiện tại đã có
`regions` (khu vực/khu phố), `region_assignments` (người phụ trách hiện tại) và `accounts`
(tài khoản, kèm `officer_id`). Không tạo bảng song song: mọi API mới đọc/ghi trên các bảng này.

`regions.unit_id` trỏ tới `units` (đơn vị/tổ/đội). Mỗi khu vực có tối đa một cán bộ phụ trách
(Q03 của dự án); mỗi cơ sở tiếp tục có một `officer_id`. Danh sách cán bộ lấy từ `accounts` cho tới
khi schema cán bộ dùng chung (UC-ORG-02) được tích hợp; view `officer_directory` vẫn dùng để tra cứu
tên cán bộ của cơ sở.

Migration `011-area-assignment.sql` bổ sung:

- `assignment_events`: lịch sử phân công/bỏ phân công theo khu vực, gồm cán bộ cũ/mới, lý do,
  ngày hiệu lực, người thực hiện và `audit_log_id`. Không xóa/sửa lịch sử.
- Quyền `M02.view/edit` cho A01, A02; `M02.view/create/edit` cho A05. Migration cấp quyền vì seed
  giữ nguyên grant đã chỉnh trên database đang chạy.

## Quyền và phạm vi

| Hành động                              | Điều kiện                                            |
| -------------------------------------- | ---------------------------------------------------- |
| Xem danh mục/chi tiết khu vực          | `M02.view` + scope `all/unit/region/facility`        |
| Tạo/sửa khu vực                        | `M02.view` + `M02.create` / `M02.edit`               |
| Phân công hoặc bỏ phân công            | `M02.view` + `M02.edit`                              |
| Danh sách tài khoản có thể phân công   | `M02.edit` + tài khoản đích trong phạm vi người gọi  |

Danh sách khu vực luôn lọc theo `regionScope` trước khi tìm kiếm, đếm và phân trang; khu vực ngoài
phạm vi trả `404`. Chi tiết khu vực chỉ trả các cơ sở thuộc `facilityScope` và `facility_count` cũng
đếm theo phạm vi đó, nên người chỉ được cấp một cơ sở không thấy cơ sở khác trong cùng khu vực.

A01/A02 thao tác trong đơn vị được cấp; A05 có scope `all` quản trị toàn bộ. Danh sách tài khoản có
thể phân công dùng `accountScope`: tài khoản phải có scope `unit`/`region`/`facility` nằm trong phạm
vi người gọi; tài khoản chỉ có scope `all` (quản trị, người xem toàn hệ thống) không hiện với A01/A02.
Khi phân công, backend kiểm tra lại tài khoản đích; người không có `all` không thể giao khu vực cho
tài khoản ngoài phạm vi (trả `403 ACCOUNT_OUT_OF_SCOPE`).

## Phân công

`POST /api/regions/:id/assignment` nhận `{accountId, effectiveDate, note}`; `accountId = null` là bỏ
phân công. Tài khoản phải đang hoạt động, vai trò đang bật và mỗi `officer_id` chỉ gắn một tài khoản.

Trong một transaction, API cập nhật `region_assignments`, scope `region` trực tiếp của cán bộ mới,
gỡ scope `region` của cán bộ cũ (giữ scope `facility` cho các cơ sở cũ còn phụ trách), ghi audit và
`assignment_events`. `effectiveDate` là ngày nghiệp vụ (`YYYY-MM-DD`) và phải là ngày có thật
(`2026-02-30` bị từ chối), không phải lịch hẹn tự động: phân công có hiệu lực ngay, giống UC-ADM-04.

Chuyển giao UC-ADM-04 cũng ghi `assignment_events` cho từng khu vực trong cùng transaction, với
`effectiveDate` là ngày chuyển giao và lý do chuyển giao. Nhờ vậy khu vực không hiện người phụ trách
mới kèm ngày hiệu lực/ghi chú của người cũ.

Phân công không thay đổi vai trò hay scope rộng (`all/unit`) của tài khoản. Quyền xem rộng vẫn cấu
hình tại `/quan-tri/vai-tro` (UC-ADM-03).

## Tài khoản — UC-ADM-02

`POST /api/authorization/accounts` tạo tài khoản với `{username, fullName, officerId, role, password,
scopes}`, mật khẩu băm scrypt, `must_change_password = 1`. Kiểm tra trùng username/`officer_id` chạy
bên trong transaction sau khi băm mật khẩu, nên hai request đồng thời không tạo được bản ghi trùng.

`PUT /api/authorization/accounts/:id` sửa họ tên, mã cán bộ, vai trò và phạm vi. Không được đổi
`officerId` khi tài khoản đang phụ trách khu vực hoặc cơ sở (trả `409 ACCOUNT_ASSIGNED`) vì
`region_assignments`/`facilities.officer_id` tham chiếu mã cũ. Nếu PUT bỏ scope `region` của một khu
vực tài khoản đang phụ trách, backend gỡ phân công khu vực đó và ghi `assignment_events` `unassign`
(reason "Thu hồi qua cập nhật phạm vi") trong cùng transaction, để không còn người phụ trách nhưng
không có quyền đọc dữ liệu.

`POST .../status` chuyển `active|locked|inactive` (không xóa vật lý); `POST .../reset-password` đặt
mật khẩu tạm và thu hồi mọi phiên. Mọi thay đổi vai trò, phạm vi, mật khẩu hoặc trạng thái đều ghi
audit và buộc đăng nhập lại (trừ kích hoạt lại tài khoản đang ngưng).

## Kiểm thử

`pccc-BE/test/regions.test.js` kiểm tra: lọc theo scope (kể cả `facility`), 403 khi thiếu `M02`,
danh sách cán bộ và tài khoản đích không vượt phạm vi, phân công/bỏ phân công kèm lịch sử và đồng bộ
scope, chuyển giao ghi thêm lịch sử, ngày hiệu lực hợp lệ, chặn đổi mã cán bộ đang phụ trách, giữ
scope `region` khi cập nhật tài khoản, chống trùng khi tạo đồng thời, chặn tự khóa và rollback khi
audit lỗi.
