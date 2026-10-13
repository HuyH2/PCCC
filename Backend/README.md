# Backend Authentication & Authorization — PCCC/CNCH

Backend riêng cho **UC-ADM-01** và **UC-ADM-03**, đối chiếu URD v1.0 và sơ đồ sequence ADM-01. Node.js >= 22.13, HTTP API và SQLite tích hợp (`node:sqlite`). Không cần cài package backend. SQLite ở Node 22 còn có cảnh báo experimental; lựa chọn này phục vụ môi trường đồ án, chưa chốt hạ tầng production Q13.

## Tổ chức và cán bộ — UC-ORG-01, UC-ORG-02

Backend đã bổ sung hai Use Case tổ chức/cán bộ trong `src/organization.js`, được
`app.js` gọi qua `handleOrganization`. Tái sử dụng session cookie, permission M02,
scope, error handler, transaction và append-only audit hiện hữu; giữ convention `/api`
và SQLite thay cho bearer/MySQL/`/api/v1` trong ví dụ sơ đồ.

| Method | Endpoint                                              | Chức năng                                                                                                                                |
| ------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/organization/tree`, `/api/organization/options` | Cây/counts/options từ DB theo scope; M02.view.                                                                                           |
| GET    | `/api/units`, `/api/units/:id`, `/api/regions/:id`    | List/detail đơn vị/khu phố; ngoài scope 404, ancestor context được redaction.                                                            |
| POST   | `/api/units`, `/api/regions`                          | Thêm Khu vực/Phường/Khu phố; M02.create; 201.                                                                                            |
| PATCH  | `/api/units/:id`, `/api/regions/:id`                  | Sửa field được gửi; M02.edit; 200.                                                                                                       |
| PATCH  | `/api/units/:id/status`, `/api/regions/:id/status`    | Body `{status}` với ACTIVE/INACTIVE; kiểm quan hệ/audit, không delete.                                                                   |
| GET    | `/api/officers`, `/api/officers/:id`                  | Danh bạ/detail scoped; q/search, status, unitId, page/pageSize; tìm tiếng Việt có/không dấu.                                             |
| POST   | `/api/officers`                                       | Tạo Master: officerCode/fullName/rank/position/phone/email/unitId/businessRole/notes tùy chọn; ACTIVE mặc định; 201; mã/email trùng 409. |
| PATCH  | `/api/officers/:id`                                   | Partial update hồ sơ; không tự sửa account role/scope; 200.                                                                              |
| PATCH  | `/api/officers/:id/status`                            | `{status,reason,effectiveDate}`; reason 1–1.000 ký tự, ngày YYYY-MM-DD tồn tại; transaction/audit; 200.                                  |

Mutation cần Origin đúng APP_ORIGIN và JSON. Backend lấy actor/quyền/scope từ session,
kiểm lại phiên sau khi đọc body; không tin actor do client gửi. Facility-only scope
không cấp quyền sửa cả khu phố/đơn vị; unit scope không mở toàn bộ cán bộ khác đơn vị
qua tham chiếu cơ sở legacy. List/options/count/detail đều dùng scope trước query.

Migration `002-organization.sql` bổ sung metadata vào `units`/`regions` và bảng `officers`;
không sửa 001 hoặc thay ID/quan hệ cũ. `units` dùng ROOT/AREA/WARD, `regions` là NEIGHBORHOOD.
PC07 ROOT chỉ đọc; khu phố cũ trỏ trực tiếp AREA vẫn được giữ khi không đổi cha. Mới hoặc
di chuyển khu phố phải có cha WARD. Không xóa vật lý; ngưng hoặc reparent có quan hệ
đang dùng bị chặn để bảo toàn dữ liệu/phạm vi. `business_role` là metadata FK `roles`,
không tạo UserRoles/RBAC song song. Tham chiếu officer_id legacy chưa có profile được giữ.

`statusEffectiveDate` lưu ngày nghiệp vụ; trạng thái đổi ngay khi xác nhận, chưa có
scheduler chuyển trạng thái tương lai. Số tài khoản liên kết hiển thị trong profile;
backend không tự khóa tài khoản hoặc chuyển giao địa bàn/scope ngoài UC này. Detail
khảo sát chưa có trường đặc tả: chỉ lưu Master và ghi chú Master tùy chọn.

Seed profiles giả lập/idempotent; không ghi đè accounts/password/grants/scopes hiện có.
Database cũ chưa có M02 cần được quản trị cấp quyền qua `/quan-tri/vai-tro`; không reset
database để mở tính năng. Xem [báo cáo bàn giao](../BAO_CAO_BAN_GIAO_UC_ORG_01_02.md)
cho 41/41 backend tests, integration/browser và ma trận bốn sơ đồ.

## Chạy trên PowerShell

```powershell
cd Backend
Copy-Item .env.example .env
# .env.example đã có DEMO_PASSWORD=PcccDemo@2026 cho team test.
npm run migrate
npm run seed
npm run dev
```

Terminal khác, tại root repo:

```powershell
npm run dev
```

Mở http://localhost:3000/dang-nhap. Backend mặc định http://127.0.0.1:4000, frontend proxy `/api/*` sang backend. Nếu đổi cổng/domain, đặt `APP_ORIGIN` của backend bằng origin frontend; `BACKEND_URL` của Next.js bằng URL backend và khởi động/build lại frontend. Không trộn `localhost` với `127.0.0.1` ở URL frontend vì Origin phải khớp chính xác.

Database mặc định `Backend/data/pccc.sqlite` khi chạy từ `Backend`. Migration tự chạy khi server khởi động, có bảng theo dõi và transaction; CLI `migrate` dùng để kiểm tra riêng. Không commit database, `.env`, mật khẩu thật hoặc session. Mật khẩu demo công khai bên dưới phục vụ team test.

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

| Method | Path                                         | Điều kiện                                                   |
| ------ | -------------------------------------------- | ----------------------------------------------------------- |
| GET    | `/api/health`                                | Public, không trả thông tin nội bộ                          |
| POST   | `/api/auth/login`                            | `{username,password}`; tài khoản và vai trò hoạt động       |
| POST   | `/api/auth/logout`                           | Thu hồi session; idempotent                                 |
| GET    | `/api/auth/me`                               | Session hợp lệ; trả identity, permissions, scopes           |
| POST   | `/api/auth/change-password`                  | `{currentPassword,newPassword}`; session hợp lệ             |
| GET    | `/api/authorization/roles`                   | A05 + all + M01.view                                        |
| PUT    | `/api/authorization/roles/:role/permissions` | A05 + all + M01.edit; `{permissions:["M03.view"]}`          |
| GET    | `/api/authorization/accounts`                | A05 + all + M01.view; phân trang                            |
| GET    | `/api/authorization/accounts/:id`            | A05 + all + M01.view                                        |
| PUT    | `/api/authorization/accounts/:id`            | A05 + all + M01.edit; role + scopes                         |
| GET    | `/api/authorization/scope-options?kind=unit` | A05 + all + M01.view; kind unit/region/facility, phân trang |
| GET    | `/api/audit-logs`                            | A05 + all + M01.view; chỉ đọc, phân trang                   |
| GET    | `/api/facilities`                            | M03.view + lọc scope trước search/count/pagination          |
| GET    | `/api/facilities/:id`                        | M03.view; ngoài scope trả 404                               |
| GET    | `/api/dashboard`                             | M10.view + M03.view; count từ cùng truy vấn scope           |

Danh sách hỗ trợ `page` (mặc định 1), `pageSize` (mặc định 20, tối đa 100). Cơ sở hỗ trợ `search` tên/địa chỉ, tối đa 100 ký tự. Scope options phân trang để tra ID hợp lệ.

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
- Mọi POST/PUT/PATCH yêu cầu `Origin` đúng `APP_ORIGIN` để chống CSRF. Gọi curl/Postman cũng phải gửi header này. CORS chỉ cho origin cấu hình và credentials.
- JSON tối đa 16 KiB; reject unknown fields và giá trị không hợp lệ. SQL có tham số; schema có FK/unique/check/index.
- Audit append-only với trigger chặn UPDATE/DELETE; chỉ admin toàn hệ thống xem được. Không có API sửa/xóa audit.

## Hợp đồng với người phụ trách tài khoản (UC-ADM-02)

Repo chưa có bảng tài khoản thật nên migration cung cấp **một bảng dùng chung `accounts`**, không tạo nguồn tài khoản song song. Người 3 dùng bảng này hoặc tạo migration tích hợp trước khi nhập dữ liệu thật:

| Trường                    | Ý nghĩa                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| id                        | ID ổn định, tham chiếu session/scope/audit                               |
| username                  | Unique, không phân biệt hoa thường; định dạng `[a-z0-9._-]`, 1–100 ký tự |
| password_hash             | Dùng `hashPassword` từ `src/password.js` khi cấp/reset mật khẩu          |
| officer_id                | ID cán bộ; nối FK khi schema cán bộ chung đã có                          |
| full_name                 | Tên hiển thị                                                             |
| role_code                 | FK tới roles.code                                                        |
| status                    | active / locked / inactive; tương ứng Hoạt động / Khóa / Ngưng           |
| must_change_password      | 1 khi cấp/reset, 0 sau đổi mật khẩu hoặc chọn bỏ qua                     |
| last_login_at, created_at | Unix milliseconds                                                        |

Không hard-delete tài khoản có lịch sử. Khi khóa/ngưng, API từ chối ngay; người 3 cần xóa sessions cùng transaction để phiên cũ không sống lại khi mở khóa. Reset mật khẩu cũng phải thu hồi sessions và ghi audit. Các thao tác này thuộc UC-ADM-02/04, không cung cấp CRUD tài khoản ngoài scope task.

`units`/`regions` đã được mở rộng qua migration 002 để quản lý tổ chức dùng chung;
`officers` là nguồn hồ sơ cán bộ thật. `facilities` vẫn là catalog tối thiểu để kiểm chứng
scope. Các phân hệ tiếp theo nối vào nguồn này bằng migration, không tạo nguồn dữ liệu thật song song.

## Frontend và giới hạn bàn giao

Đã nối `/dang-nhap`, `/doi-mat-khau`, `/quan-tri/vai-tro` và hai trang `/to-chuc/don-vi`, `/to-chuc/can-bo`. Reload dùng cookie server; không còn localStorage chứa danh tính hay tài khoản mặc định. Proxy kiểm tra đăng nhập và quyền vào trang cấu hình phân quyền/tổ chức; API kiểm tra quyền/phạm vi độc lập. Sidebar và các màn hình nghiệp vụ khác giữ nguyên UI, dữ liệu mẫu ban đầu; chủ module tiếp tục tích hợp API. `/tong-quan` và `/du-lieu/co-so` chuyển về `/` và `/co-so`. Logout/login dùng full navigation để bỏ router cache tài khoản cũ.

Các trang nghiệp vụ khác vẫn mở dạng demo sau đăng nhập, chưa tích hợp RBAC/scope nghiệp vụ trên giao diện. API thật kiểm quyền độc lập; grants M04–M11 không có nghĩa các workflow đã được triển khai. Không đưa dữ liệu thật vào `src/data/mock.ts`, vì đó là module dữ liệu công khai của giao diện demo.

## Kiểm thử

```powershell
cd Backend
npm run check
npm test
```

Kiểm thử thật qua HTTP với SQLite: migration persistence/idempotence/constraints, seed không ghi đè, login/password/status/rate-limit/CSRF, session hết hạn/thu hồi, RBAC, scopes (all/unit/region/facility/empty), search/count/dashboard/detail, transaction rollback khi mất admin cuối, audit trước/sau và cấm sửa log. Tests dùng password giả và database tạm, không thay DB đang chạy.

Tại root: `npm run typecheck`, `npm run build`, `npm run test:integration` (sau build). Test tích hợp cần cổng 4000 và 3100 trống, tự chạy/dừng server và dùng DB in-memory. Backend JavaScript chạy trực tiếp; không có build/TypeScript compile riêng.

API bỏ qua: "POST /api/auth/skip-password-change", yêu cầu session đang hoạt động và Origin hợp lệ; không nhận ID tài khoản từ client. Audit: "auth.password_change_skipped".
