# pccc-BE — Backend PCCC/CNCH

## Tổ chức và cán bộ — UC-ORG-01, UC-ORG-02

`src/core/organization.js` và `src/modules/organization/organization.routes.js` dùng lại
session, M02 permission, scope và audit chung. `002-organization.sql` mở rộng `units`,
`regions` và tạo `officers` mà vẫn giữ các ID cũ. ROOT chỉ đọc; cập nhật trạng thái và
chuyển đơn vị được kiểm tra quan hệ và lưu audit.

Trên database mới, `pnpm seed` tạo 15 đơn vị và 79 hồ sơ cán bộ để thử danh sách,
tìm kiếm, lọc trạng thái và phân trang. Trong đó 12 đơn vị và 72 hồ sơ mở rộng có mã
`DEMO-ORG-*`, tên ghi `(mẫu)` và thông tin liên hệ giả lập. Đây là bản ghi SQLite thực
(không phải mock frontend), nhưng không phải danh tính cán bộ thật. Seed chạy lại không
ghi đè hồ sơ đã chỉnh sửa; chỉ dùng trên môi trường demo/local.

| Phương thức | Endpoint                                              | Mục đích                           |
| ----------- | ----------------------------------------------------- | ---------------------------------- |
| GET         | `/api/organization/tree`, `/api/organization/options` | Cây và tùy chọn theo scope         |
| GET, POST   | `/api/units`, `/api/officers`                         | Danh sách hoặc tạo đơn vị/cán bộ   |
| GET, PATCH  | `/api/units/:id`, `/api/officers/:id`                 | Chi tiết hoặc cập nhật             |
| PATCH       | `/api/units/:id/status`, `/api/officers/:id/status`   | Đổi trạng thái có lý do và audit   |
| POST        | `/api/organization/regions`                           | Tạo khu phố M02                    |
| GET, PATCH  | `/api/organization/regions/:id`                       | Chi tiết hoặc cập nhật khu phố M02 |
| PATCH       | `/api/organization/regions/:id/status`                | Đổi trạng thái khu phố M02         |

`/api/regions` thuộc UC-ORG-03 để quản lý phân công hiện tại và lịch sử phụ trách. M09
đăng ký routes trong `src/modules/incidents/incidents.routes.js`; chính sách phân loại,
cảnh báo và upload là cấu hình demo cần xác nhận trước khi dùng làm quy định chính thức.

Backend (modular monolith) của monorepo. Mỗi module nghiệp vụ nằm ở `src/modules/<module>/` (`*.service.js` + `*.routes.js`), hạ tầng chung ở `src/core/`, `src/app.js` đăng ký routes; quy tắc chi tiết ở [PROJECT.md](../PROJECT.md) §2. Phần auth phục vụ **UC-ADM-01** và **UC-ADM-03**, đối chiếu URD v1.0 và sơ đồ sequence ADM-01. Node.js >= 22.13, HTTP API và SQLite tích hợp (`node:sqlite`). Không cần cài package backend. SQLite ở Node 22 còn có cảnh báo experimental; lựa chọn này phục vụ môi trường đồ án, chưa chốt hạ tầng production Q13.

## Chạy trên PowerShell

Tại root repo:

```powershell
pnpm install
Copy-Item pccc-BE/.env.example pccc-BE/.env
# .env.example đã có DEMO_PASSWORD=PcccDemo@2026 cho team test.
pnpm migrate
pnpm seed
pnpm dev:be
```

Terminal khác, tại root repo:

```powershell
pnpm dev:fe
```

Mở http://localhost:3000/dang-nhap. Backend mặc định http://127.0.0.1:4000, frontend proxy `/api/*` sang backend. Nếu đổi cổng/domain, đặt `APP_ORIGIN` của backend bằng origin frontend; `BACKEND_URL` của Next.js bằng URL backend và khởi động/build lại frontend. Không trộn `localhost` với `127.0.0.1` ở URL frontend vì Origin phải khớp chính xác.

Database mặc định `pccc-BE/data/pccc.sqlite` (script chạy trong thư mục `pccc-BE`). Migration tự chạy khi server khởi động, có bảng theo dõi và transaction; CLI `migrate` dùng để kiểm tra riêng. Không commit database, `.env`, mật khẩu thật hoặc session. Mật khẩu demo công khai bên dưới phục vụ team test.

## Tài khoản mẫu

| Vai trò | Username         | Mật khẩu ban đầu | Phạm vi mẫu              |
| ------- | ---------------- | ---------------- | ------------------------ |
| A01     | `demo.chi-huy`   | `PcccDemo@2026`  | Đơn vị DV-KV10           |
| A02     | `demo.to-truong` | `PcccDemo@2026`  | Đơn vị DV-KV10           |
| A03     | `demo.can-bo`    | `PcccDemo@2026`  | Khu phố KP01 (chỉ CS001) |
| A04     | `demo.tong-hop`  | `PcccDemo@2026`  | Đơn vị DV-KV10           |
| A05     | `demo.admin`     | `PcccDemo@2026`  | Toàn hệ thống            |
| A06     | `demo.nguoi-xem` | `PcccDemo@2026`  | Toàn hệ thống, chỉ xem   |

Đây là toàn bộ 6 tài khoản được seed, với `DEMO_PASSWORD=PcccDemo@2026` đã có sẵn trong `.env.example`. Nếu `.env` đang có mật khẩu khác, chỉnh biến này trước khi seed lần đầu để khớp bảng; seed bằng giá trị khác sẽ tạo tài khoản mới với giá trị đó.

Lần đầu hiển thị trang đổi mật khẩu với nút **Bỏ qua, đổi sau**. Bỏ qua giữ mật khẩu và session hiện tại, lưu lựa chọn để lần đăng nhập sau vào thẳng hệ thống và ghi audit; RBAC và phạm vi dữ liệu vẫn được áp dụng. Có thể đổi sau từ menu tài khoản → Đổi mật khẩu. Nếu đổi, mật khẩu mới ít nhất 12 ký tự. Đổi mật khẩu thu hồi tất cả session và yêu cầu đăng nhập lại. Seed không reset mật khẩu, phạm vi hoặc quyền đã cấu hình khi chạy lại, nên tài khoản đã đổi mật khẩu phải dùng mật khẩu mới. A07 được tạo trong danh mục nhưng chưa kích hoạt và chưa có tài khoản mẫu vì thuộc giai đoạn mở rộng. Dữ liệu cơ sở seed hoàn toàn giả lập.

**Q02 chưa được phê duyệt:** grants trong seed chỉ là cấu hình mẫu để kiểm thử, có thể sửa qua API/UI; không xem đây là ma trận quyền chính thức. Seed bị chặn khi `NODE_ENV=production`.

## API

Response lỗi thống nhất: `{ "error": { "code": "FORBIDDEN", "message": "..." } }`.

| Method | Path                                             | Điều kiện                                                                      |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| GET    | `/api/health`                                    | Public, không trả thông tin nội bộ                                             |
| POST   | `/api/auth/login`                                | `{username,password}`; tài khoản và vai trò hoạt động                          |
| POST   | `/api/auth/logout`                               | Thu hồi session; idempotent                                                    |
| GET    | `/api/auth/me`                                   | Session hợp lệ; trả identity, permissions, scopes                              |
| POST   | `/api/auth/change-password`                      | `{currentPassword,newPassword}`; session hợp lệ                                |
| GET    | `/api/authorization/roles`                       | A05 + all + M01.view                                                           |
| PUT    | `/api/authorization/roles/:role/permissions`     | A05 + all + M01.edit; `{permissions:["M03.view"]}`                             |
| GET    | `/api/authorization/accounts`                    | A05 + all + M01.view; phân trang, `search`                                     |
| GET    | `/api/authorization/accounts/:id`                | A05 + all + M01.view                                                           |
| POST   | `/api/authorization/accounts`                    | A05 + all + M01.edit; tạo tài khoản + role + scope + mật khẩu tạm              |
| PUT    | `/api/authorization/accounts/:id`                | A05 + all + M01.edit; role, scopes, fullName, officerId                        |
| POST   | `/api/authorization/accounts/:id/status`         | A05 + all + M01.edit; `{status: active\|locked\|inactive}`                     |
| POST   | `/api/authorization/accounts/:id/reset-password` | A05 + all + M01.edit; thu hồi session, bắt đổi ở lần đăng nhập tới             |
| POST   | `/api/authorization/accounts/:id/lock`           | A05 + all + M01.edit; khóa và thu hồi session                                  |
| POST   | `/api/authorization/accounts/:id/unlock`         | A05 + all + M01.edit; mở tài khoản đã khóa                                     |
| GET    | `/api/authorization/scope-options?kind=unit`     | A05 + all + M01.view; kind unit/region/facility, phân trang                    |
| GET    | `/api/account-transfers/candidates`              | A05 + all + M01.view; tài khoản có thể chọn                                    |
| GET    | `/api/account-transfers/assignments`             | A05 + all + M01.view; phạm vi hiện phụ trách theo `sourceAccountId`            |
| POST   | `/api/account-transfers`                         | A05 + all + M01.edit; chuyển giao trong transaction                            |
| GET    | `/api/account-transfers`                         | A05 + all + M01.view; lịch sử phân trang                                       |
| GET    | `/api/audit-logs`                                | A05 + all + M01.view; chỉ đọc, phân trang                                      |
| GET    | `/api/regions`                                   | M02.view + scope; phân trang, `search`, `unitId`                               |
| POST   | `/api/regions`                                   | M02.view + M02.create; `{id,name,unitId}`                                      |
| GET    | `/api/regions/:id`                               | M02.view; chi tiết + cơ sở + cán bộ theo scope, lịch sử phân trang             |
| PUT    | `/api/regions/:id`                               | M02.view + M02.edit; `{name,unitId}`, đơn vị trong scope                       |
| POST   | `/api/regions/:id/assignment`                    | M02.edit; `{accountId\|null,effectiveDate,note}`; tài khoản đích trong scope   |
| GET    | `/api/regions/officers?regionId=`                | M02.edit; ứng viên theo `accountScope` + đơn vị của khu vực                    |
| GET    | `/api/regions/:id/officers`                      | M02.view; cán bộ phụ trách khu vực và cơ sở theo scope                         |
| GET    | `/api/units`                                     | M02.view; danh mục đơn vị theo scope                                           |
| GET    | `/api/facilities`                                | M03.view + lọc scope trước search/count/pagination                             |
| GET    | `/api/facilities/:id`                            | M03.view; ngoài scope trả 404                                                  |
| GET    | `/api/dashboard`                                 | M10.view + M03.view; `facilityCount`, `regionCount`, `officerCount` theo scope |
| GET    | `/api/dashboard/facilities-by-region`            | M10.view + M03.view; số cơ sở theo khu vực, phân trang                         |
| GET    | `/api/dashboard/facilities-by-officer`           | M10.view + M03.view; số cơ sở theo cán bộ, phân trang                          |
| GET    | `/api/search?q=&limit=`                          | M10.view; tìm không dấu, nhóm kết quả theo loại và scope                       |

API thực hiện kiểm tra M06 (`/api/inspections*`, `/api/inspection-checklists*`): xem [INSPECTIONS.md](INSPECTIONS.md).
Schema, payload và giới hạn chuyển giao: [ACCOUNT_TRANSFERS.md](ACCOUNT_TRANSFERS.md).

Danh sách hỗ trợ `page` (mặc định 1), `pageSize` (mặc định 20, tối đa 100). Cơ sở hỗ trợ `search` tên/địa chỉ, tối đa 100 ký tự. Scope options phân trang để tra ID hợp lệ.

Tra cứu và dashboard (UC-SYS-01/02, SCRUM-18): `q` 2–100 ký tự, `limit` 1–50 (mặc định 10) mỗi nhóm. Nhóm `facilities` và `officers` cần thêm M03.view, thiếu quyền thì nhóm bị bỏ khỏi kết quả; `regions` và `units` luôn lọc theo scope (scope khu vực/cơ sở không thấy đơn vị). Mọi số liệu đọc từ view `facility_overview` (migration 003) với cùng bộ lọc scope, nên tổng theo khu vực và theo cán bộ luôn bằng `facilityCount`. "Cán bộ" là `facilities.officer_id`; tên lấy từ view `officer_directory` (bảng `accounts`) cho đến khi tích hợp bảng cán bộ dùng chung, khi đó chỉ cần thay view này. Tìm kiếm dùng hàm SQLite `fold` (bỏ dấu, không phân biệt hoa thường) và quét toàn bảng; quy mô hàng nghìn cơ sở chưa cần index riêng.

Ví dụ cấp phạm vi:

```json
{
  "role": "A03",
  "scopes": [
    { "kind": "region", "targetId": "KP01" },
    { "kind": "facility", "targetId": "CS002" }
  ]
}
```

Các scope kết hợp bằng OR; unit gồm đơn vị con. `[]` không cho xem cơ sở nào. `[{"kind":"all"}]` cấp toàn hệ thống, không kết hợp scope khác. Mọi target phải tồn tại trong database. Thay role/scope thu hồi session của tài khoản đó. Thay grants của role áp dụng ngay lần gọi API tiếp theo. Transaction + audit trước/sau; chặn thao tác làm mất quản trị cuối cùng có khả năng cấu hình.

## Cơ chế bảo vệ

- Mật khẩu hash scrypt với salt ngẫu nhiên; không lưu plaintext.
- Token session ngẫu nhiên 256 bit; database chỉ lưu SHA-256 của token.
- Cookie `pccc_session`: HttpOnly, SameSite=Lax, Path=/, hạn mặc định 8 giờ. Có thể cấu hình 60–604800 giây. Cookie Secure bắt buộc khi production.
- Đăng nhập kiểm tra mật khẩu trước khi thông báo tài khoản khóa/ngưng; log thành công/thất bại không chứa password/token.
- Mỗi API đọc lại trạng thái tài khoản, role, quyền và scope từ DB. Quyền từ body/header/client không được tin.
- Giới hạn 10 lần đăng nhập thất bại trong 15 phút theo IP và username; đăng nhập thành công không tiêu hao ngân sách lỗi của các tài khoản dùng chung frontend proxy. Đây là ngưỡng kỹ thuật demo, không phải quy tắc khóa tài khoản nghiệp vụ. IP lấy từ socket, không tin X-Forwarded-For. Cần cấu hình trusted proxy và chiến lược limiter khi hạ tầng được chốt.
- Mọi POST/PUT yêu cầu `Origin` đúng `APP_ORIGIN` để chống CSRF. Gọi curl/Postman cũng phải gửi header này. CORS chỉ cho origin cấu hình và credentials.
- JSON tối đa 16 KiB; reject unknown fields và giá trị không hợp lệ. SQL có tham số; schema có FK/unique/check/index.
- Audit append-only với trigger chặn UPDATE/DELETE; chỉ admin toàn hệ thống xem được. Không có API sửa/xóa audit.

## Hợp đồng với người phụ trách tài khoản (UC-ADM-02)

Repo chưa có bảng tài khoản thật nên migration cung cấp **một bảng dùng chung `accounts`**, không tạo nguồn tài khoản song song. Người 3 dùng bảng này hoặc tạo migration tích hợp trước khi nhập dữ liệu thật:

| Trường                    | Ý nghĩa                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| id                        | ID ổn định, tham chiếu session/scope/audit                               |
| username                  | Unique, không phân biệt hoa thường; định dạng `[a-z0-9._-]`, 1–100 ký tự |
| password_hash             | Dùng `hashPassword` từ `src/core/password.js` khi cấp/reset mật khẩu     |
| officer_id                | ID cán bộ; nối FK khi schema cán bộ chung đã có                          |
| full_name                 | Tên hiển thị                                                             |
| role_code                 | FK tới roles.code                                                        |
| status                    | active / locked / inactive; tương ứng Hoạt động / Khóa / Ngưng           |
| must_change_password      | 1 khi cấp/reset, 0 sau đổi mật khẩu hoặc chọn bỏ qua                     |
| last_login_at, created_at | Unix milliseconds                                                        |

Không hard-delete tài khoản có lịch sử. API khóa tài khoản đã xóa sessions cùng transaction để
phiên cũ không sống lại khi mở khóa. Reset mật khẩu cũng phải thu hồi sessions và ghi audit.
Đã cung cấp CRUD tài khoản (tạo, sửa hồ sơ/vai trò/phạm vi, khóa/ngưng, đặt lại mật khẩu) trong phạm vi
A05 + `M01.edit`; không xóa vật lý tài khoản có lịch sử. Chi tiết phân công địa bàn xem
[AREA_ASSIGNMENT.md](AREA_ASSIGNMENT.md).

`units`, `regions`, `facilities` là catalog tích hợp tối thiểu để kiểm chứng scope. Khi người phụ trách nghiệp vụ hoàn thành schema dùng chung, nối các FK/query vào nguồn đó bằng migration, không duy trì hai nguồn dữ liệu thật.

## Frontend và giới hạn bàn giao

Đã nối `/dang-nhap`, `/doi-mat-khau`, `/quan-tri/vai-tro`, `/quan-tri/tai-khoan` và
`/to-chuc/phan-cong`. Reload dùng cookie server; không còn localStorage chứa danh tính hay tài khoản
mặc định. Proxy kiểm tra đăng nhập và quyền vào các trang quản trị; API kiểm tra quyền/phạm vi độc
lập. Nhiều màn hình nghiệp vụ khác vẫn dùng dữ liệu mẫu; riêng `/co-so` chưa phản ánh kết quả chuyển
giao. `/tong-quan` và `/du-lieu/co-so` chuyển về `/` và `/co-so`. Logout/login dùng full navigation
để bỏ router cache tài khoản cũ. Luồng thử trên UI nằm ở [README root](../README.md#khóa-tài-khoản-và-chuyển-giao-phạm-vi--uc-adm-04).

Mã các màn hình nghiệp vụ tĩnh cũ vẫn được giữ. Chúng bị ẩn/chặn đến khi chủ module nối API có kiểm soát scope. Cấp quyền M04–M11 trong ma trận không tự mở các màn hình chưa tích hợp. Đây là giới hạn rõ ràng của phần tích hợp, không phải quyền chính thức đã chốt. Không đưa dữ liệu thật vào `src/data/mock.ts`, vì đó là module dữ liệu công khai của giao diện demo.

## Kiểm thử

```powershell
pnpm check
pnpm test
```

Kiểm thử thật qua HTTP với SQLite: migration persistence/idempotence/constraints, seed không ghi đè, login/password/status/rate-limit/CSRF, session hết hạn/thu hồi, RBAC, scopes (all/unit/region/facility/empty), search/count/dashboard/detail, transaction rollback khi mất admin cuối, audit trước/sau và cấm sửa log. Tests dùng password giả và database tạm, không thay DB đang chạy.

Tại root: `pnpm typecheck`, `pnpm build`, `pnpm test:integration` (sau build). Test tích hợp cần cổng 4000 và 3100 trống, tự chạy/dừng server và dùng DB in-memory. Backend JavaScript chạy trực tiếp; không có build/TypeScript compile riêng.

API bỏ qua: "POST /api/auth/skip-password-change", yêu cầu session đang hoạt động và Origin hợp lệ; không nhận ID tài khoản từ client. Audit: "auth.password_change_skipped".
