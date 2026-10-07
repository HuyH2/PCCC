# Hệ thống Quản lý công tác PCCC & CNCH

## Authentication & Authorization — UC-ADM-01, UC-ADM-03

Backend được triển khai riêng trong [`Backend`](Backend/README.md): Node.js >= 22.13, SQLite,
session cookie HttpOnly, RBAC và phạm vi đơn vị/khu phố/cơ sở. Có migration, seed vai trò,
audit đăng nhập/thay đổi quyền và kiểm thử HTTP.

Hướng dẫn khởi chạy cả hai phần nằm ở mục **Chạy dự án** bên dưới. Hợp đồng bảng `accounts` cho
người 3 và API chi tiết được mô tả trong [`Backend/README.md`](Backend/README.md).
Không còn đăng nhập nhanh bỏ qua mật khẩu hoặc session localStorage.

Các trang đăng nhập, đổi mật khẩu và cấu hình vai trò/phạm vi đã nối API thật.
Sidebar, dashboard `/`, trang `/co-so` và các màn hình nghiệp vụ giữ nguyên UI và dữ liệu
mẫu của dự án. Chủ module cần nối các màn hình này với API kiểm soát quyền/phạm vi;
backend kiểm tra quyền độc lập trên các API hiện có. Quyền seed là cấu hình mẫu,
chưa thay thế phê duyệt Q02.

Kiểm tra: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, sau đó
`npm run test:integration`. Backend có thêm `npm --prefix Backend run check`.

Giao diện web (Next.js) cho **Hệ thống quản lý công tác phòng cháy, chữa cháy và cứu nạn, cứu hộ**
của PC07 — Đội Khu vực 10, xây dựng theo `URD_He_thong_Quan_ly_PCCC_CNCH_PC07_v1.0.docx`.

> ⚠️ **Bản demo dùng dữ liệu mẫu.** Theo NFR-02 và BR-12 của URD, môi trường demo chỉ được dùng dữ
> liệu mẫu hoặc dữ liệu đã xử lý. Toàn bộ số liệu trong `src/data/mock.ts` là hư cấu.

## Chạy dự án

### 1. Yêu cầu môi trường

- Node.js **>= 22.13.0** và npm. Kiểm tra bằng `node --version` và `npm --version`.
- Mở terminal PowerShell tại **thư mục gốc repo**, nơi có `package.json` và thư mục `Backend`.
- Giữ hai terminal chạy đồng thời: frontend ở cổng **3000**, backend ở cổng **4000**.
- Database là SQLite, không cần cài MySQL/PostgreSQL hoặc chạy Docker. Backend dùng thư viện có sẵn
  trong Node.js, không cần chạy `npm install` riêng trong `Backend`.

### 2. Chuẩn bị lần đầu

Chạy tại thư mục gốc repo:

```powershell
npm ci

# Chỉ tạo file cấu hình nếu chưa có, tránh ghi đè cấu hình đang sử dụng.
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
if (!(Test-Path Backend/.env)) { Copy-Item Backend/.env.example Backend/.env }
```

Mở hai file vừa tạo trong IDE và kiểm tra:

| File           | Biến            | Giá trị khi chạy local                             |
| -------------- | --------------- | -------------------------------------------------- |
| `.env.local`   | `BACKEND_URL`   | `http://127.0.0.1:4000`                            |
| `Backend/.env` | `PORT`          | `4000`                                             |
| `Backend/.env` | `APP_ORIGIN`    | `http://localhost:3000`                            |
| `Backend/.env` | `DATABASE_PATH` | `./data/pccc.sqlite`                               |
| `Backend/.env` | `COOKIE_SECURE` | `false`                                            |
| `Backend/.env` | `DEMO_PASSWORD` | `PcccDemo@2026` — mật khẩu mẫu chung cho team test |

Lưu file cấu hình, sau đó tạo bảng và dữ liệu mẫu. Vẫn chạy tại thư mục gốc:

```powershell
npm --prefix Backend run migrate
npm --prefix Backend run seed
```

Database được tạo ở `Backend/data/pccc.sqlite`. Không commit `.env`, `.env.local` hoặc database.
Seed chỉ cần chạy khi khởi tạo dữ liệu mẫu; chạy lại không ghi đè mật khẩu, quyền hoặc phạm vi
đã cấu hình của tài khoản hiện có.

### 3. Chạy backend — terminal 1

Mở terminal tại thư mục gốc repo:

```powershell
cd Backend
npm run dev
```

Giữ terminal này chạy. Backend mặc định nghe tại `http://127.0.0.1:4000`.
Có thể mở `http://127.0.0.1:4000/api/health` để kiểm tra; kết quả bình thường là `{"status":"ok"}`.

### 4. Chạy frontend — terminal 2

Mở **terminal mới tại thư mục gốc repo**, không phải bên trong `Backend`:

```powershell
npm run dev
```

Giữ cả hai terminal chạy và mở **http://localhost:3000/dang-nhap**.
Frontend chuyển các request `/api/*` sang backend theo `BACKEND_URL`.
Để dừng dự án, nhấn `Ctrl+C` ở từng terminal.

### 5. Đăng nhập bằng tài khoản mẫu

| Vai trò                               | Tên đăng nhập    | Mật khẩu ban đầu |
| ------------------------------------- | ---------------- | ---------------- |
| A01 — Chỉ huy/Đội trưởng              | `demo.chi-huy`   | `PcccDemo@2026`  |
| A02 — Phó chỉ huy/Tổ trưởng           | `demo.to-truong` | `PcccDemo@2026`  |
| A03 — Cán bộ kiểm tra/Quản lý địa bàn | `demo.can-bo`    | `PcccDemo@2026`  |
| A04 — Cán bộ tổng hợp                 | `demo.tong-hop`  | `PcccDemo@2026`  |
| A05 — Quản trị hệ thống               | `demo.admin`     | `PcccDemo@2026`  |
| A06 — Lãnh đạo cấp phòng/Người xem    | `demo.nguoi-xem` | `PcccDemo@2026`  |

Đây là toàn bộ 6 tài khoản được seed. A07 chưa có tài khoản mẫu vì vai trò này chưa kích hoạt.
`Backend/.env.example` đã điền sẵn `DEMO_PASSWORD=PcccDemo@2026`. Nếu đã có `Backend/.env`,
đặt biến này cùng giá trị trước khi seed lần đầu để mật khẩu khớp bảng trên.
Nếu seed bằng giá trị khác, các tài khoản mới dùng giá trị đó thay vì mật khẩu trong bảng.

Mật khẩu trên chỉ dành cho dữ liệu demo của team. Lần đăng nhập đầu, hệ thống hiển thị trang đổi mật khẩu;
bạn có thể chọn **Bỏ qua, đổi sau** để vào hệ thống với mật khẩu hiện tại. Nếu chọn đổi mật khẩu,
sau khi lưu hãy đăng nhập lại bằng **mật khẩu mới**. A05 được điều hướng tới
trang cấu hình quyền, các vai trò còn lại tới dashboard trong phạm vi được cấp.

Những lần chạy sau chỉ cần mở hai terminal và thực hiện bước 3–4; không cần copy lại file môi trường
hoặc seed lại dữ liệu.

### 6. Kiểm tra và chạy frontend bản build

Các lệnh kiểm tra chạy tại thư mục gốc:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm --prefix Backend run check
npm run build
npm run test:integration
```

`test:integration` cần build frontend trước, tự mở/dừng server kiểm thử và dùng database in-memory.
Cần dừng hai terminal dev nếu chúng đang chiếm cổng **4000** hoặc **3100** trước khi chạy test này.
Lần build chưa có cache font Inter cần kết nối Internet để tải font từ Google Fonts.

Để kiểm tra frontend bản build ở local, giữ backend đang chạy, dừng frontend dev rồi chạy tại root:

```powershell
npm run build
npm run start
```

Backend có thể chạy bằng `npm run start` trong thư mục `Backend` nếu không cần chế độ tự khởi động
lại khi sửa mã. Triển khai production với `NODE_ENV=production` yêu cầu HTTPS và `COOKIE_SECURE=true`;
xem cấu hình chi tiết trong [`Backend/README.md`](Backend/README.md).

### 7. Xử lý lỗi khởi chạy thường gặp

| Hiện tượng                                                                | Cách xử lý                                                                                                                                                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seed báo lỗi `DEMO_PASSWORD`                                              | Điền mật khẩu tạm 12–256 ký tự trong `Backend/.env`, lưu file rồi chạy lại seed.                                                                                                   |
| Trang báo dịch vụ xác thực không khả dụng hoặc không kết nối được máy chủ | Kiểm tra terminal backend, `/api/health` và `BACKEND_URL` trong `.env.local`.                                                                                                      |
| Đăng nhập trả lỗi nguồn yêu cầu/Origin                                    | Mở đúng `http://localhost:3000`; `APP_ORIGIN` phải khớp chính xác URL frontend, không có dấu `/` cuối.                                                                             |
| Cổng 3000/4000 đang được sử dụng                                          | Dừng tiến trình cũ. Nếu đổi cổng frontend, cập nhật `APP_ORIGIN`; nếu đổi cổng backend, cập nhật `PORT` và `BACKEND_URL`. Khởi động lại cả hai phần; build lại nếu dùng bản build. |
| Mật khẩu seed không đăng nhập được sau khi đã đổi mật khẩu                | Dùng mật khẩu mới. Sửa `DEMO_PASSWORD` hoặc seed lại không reset mật khẩu tài khoản hiện có.                                                                                       |

## Công nghệ

| Thành phần | Lựa chọn                                                 |
| ---------- | -------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, React 19, TypeScript)            |
| Giao diện  | Tailwind CSS v4 + shadcn/ui (new-york, Radix primitives) |
| Biểu mẫu   | react-hook-form + zod (validate phía client)             |
| Biểu đồ    | Recharts                                                 |
| Icon       | lucide-react                                             |
| Font       | Inter (subset `vietnamese`)                              |

## Bộ màu

Đỏ cứu hỏa `#C8102E` làm màu chủ đạo trên nền trắng — sidebar đỏ đậm, tiêu đề bảng đỏ, nội dung trắng.
Toàn bộ token định nghĩa dưới dạng biến CSS trong [`src/app/globals.css`](src/app/globals.css), có
sẵn cả biến thể **sáng/tối** (nút đổi giao diện ở header).

Quy ước màu trạng thái dùng chung (xem [`status-badge.tsx`](src/components/shared/status-badge.tsx)):
đỏ = cần xử lý/nghiêm trọng, vàng = sắp tới hạn, xanh lá = đã hoàn thành, xám = không áp dụng.

## Cấu trúc thư mục

```
src/
├── app/                      # Route App Router, mỗi thư mục là một màn hình
├── components/
│   ├── ui/                   # Primitive shadcn/ui (button, table, sidebar, …)
│   ├── layout/               # AppSidebar, AppHeader
│   ├── shared/               # PageHeader, StatCard, FilterBar, DataPagination, …
│   └── charts/               # Biểu đồ dashboard (Recharts)
├── data/
│   ├── types.ts              # Mô hình dữ liệu nghiệp vụ (URD mục 5)
│   ├── mock.ts               # Dữ liệu mẫu sinh có hạt giống cố định
│   └── thong-ke.ts           # Tổng hợp cho dashboard (URD mục 11, R01–R12)
└── lib/
    ├── navigation.ts         # Cây sidebar theo 11 phân hệ M01–M11
    └── utils.ts              # cn, định dạng số/ngày, bỏ dấu tiếng Việt
```

## Bản đồ màn hình ↔ URD

| Đường dẫn                 | Phân hệ | Use Case                                                |
| ------------------------- | ------- | ------------------------------------------------------- |
| `/`                       | M10     | UC-SYS-02 — Dashboard điều hành (R01–R12)               |
| `/tra-cuu`                | M10     | UC-SYS-01 — Tìm kiếm toàn hệ thống                      |
| `/canh-bao`               | M10     | UC-SYS-03 — Chuông nhắc việc, cấu hình BR-07            |
| `/to-chuc/don-vi`         | M02     | UC-ORG-01 — Cây tổ chức 4 cấp                           |
| `/to-chuc/can-bo`         | M02     | UC-ORG-02 — Danh bạ cán bộ                              |
| `/to-chuc/khu-vuc`        | M02     | UC-ORG-03 — Danh mục khu phố                            |
| `/to-chuc/phan-cong`      | M02     | UC-ORG-03, UC-ADM-04 — Phân công & chuyển giao          |
| `/co-so`                  | M03     | UC-FAC-01, UC-FAC-02 — Danh sách cơ sở                  |
| `/co-so/them`             | M03     | UC-FAC-02 — Biểu mẫu tạo hồ sơ cơ sở                    |
| `/co-so/[id]`             | M03     | UC-FAC-03..08 — Hồ sơ, điều kiện PCCC, nhân sự, lịch sử |
| `/co-so/[id]/sua`         | M03     | UC-FAC-02 — Biểu mẫu cập nhật hồ sơ cơ sở               |
| `/vi-pham`                | M04     | UC-VIO-01..05 — Vi phạm, đình chỉ, khắc phục            |
| `/van-ban`                | M05     | UC-DOC-01, UC-DOC-02 — Kho văn bản/quy chuẩn            |
| `/kiem-tra/ke-hoach`      | M06     | UC-INS-01, UC-INS-02 — Chỉ tiêu & nợ chỉ tiêu           |
| `/kiem-tra/cuoc-kiem-tra` | M06     | UC-INS-03..08 — Hồ sơ cuộc kiểm tra                     |
| `/cong-viec/lich`         | M07     | UC-WRK-01 — Lịch công tác 7 ngày                        |
| `/cong-viec/giao-viec`    | M07     | UC-WRK-02, UC-WRK-03 — Giao việc & tiến độ              |
| `/cong-viec/kpi`          | M07     | UC-WRK-04 — KPI & nợ chỉ tiêu                           |
| `/cong-viec/giai-trinh`   | M07     | UC-WRK-05 — Yêu cầu/phản hồi giải trình                 |
| `/bao-cao`                | M08     | UC-RPT-01..04 — Báo cáo & deadline                      |
| `/su-co`                  | M09     | UC-INC-01..06 — Sự cố và thiệt hại                      |
| `/tien-ich/import`        | M11     | UC-FAC-07, UC-SYS-04 — Import Excel có preview lỗi      |
| `/tien-ich/export`        | M11     | UC-RPT-06 — Kết xuất R01–R12                            |
| `/quan-tri/tai-khoan`     | M01     | UC-ADM-02 — Tài khoản                                   |
| `/quan-tri/vai-tro`       | M01     | UC-ADM-03 — Ma trận quyền 7 vai trò × 11 phân hệ        |
| `/quan-tri/nhat-ky`       | M01     | UC-SYS-05 — Nhật ký thao tác                            |
| `/dang-nhap`              | M01     | UC-ADM-01 — Đăng nhập (layout riêng, ngoài sidebar)     |

## Quyết định đã chốt với người sử dụng

| Điểm | Quyết định                                                                                                            | Ảnh hưởng tới code                                               |
| ---- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Q03  | **Một khu phố / một cơ sở có đúng một cán bộ phụ trách.** Đổi người thì dùng chuyển giao phạm vi, giữ nguyên lịch sử. | Giữ quan hệ 1-N hiện tại; biểu mẫu cơ sở chỉ cho chọn một cán bộ |
| Q13  | **Tài khoản nội bộ + mật khẩu** do Quản trị hệ thống cấp, hiển thị đề nghị đổi mật khẩu lần đầu, có nút bỏ qua.       | Đã bỏ nút SSO ở màn hình đăng nhập                               |
| Q14  | **Web responsive là đủ** cho giai đoạn đầu, chưa làm PWA hay app native.                                              | Không thêm manifest/service worker                               |

## Biểu mẫu nhập liệu

Ràng buộc dữ liệu tập trung ở [`src/data/schemas.ts`](src/data/schemas.ts) — khi đơn vị chốt bộ trường
chuẩn (Q04), chỉ cần sửa file này là toàn bộ biểu mẫu có hiệu lực theo.

| Biểu mẫu      | Dạng                           | Ràng buộc đáng chú ý                                                                                   |
| ------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Cơ sở         | Trang riêng, nhiều nhóm trường | Cảnh báo trùng tên + địa chỉ; khu phố lọc theo phường; tách **Lưu nháp** và **Lưu chính thức** (BR-02) |
| Cán bộ        | Hộp thoại                      | Email và điện thoại đúng định dạng; nghỉ/chuyển công tác chỉ đổi trạng thái                            |
| Vi phạm       | Hộp thoại                      | Đánh dấu đình chỉ thì **bắt buộc có số quyết định**; hạn khắc phục phải sau ngày phát hiện             |
| Cuộc kiểm tra | Hộp thoại                      | Có/không lập thông báo gửi cơ sở quyết định trạng thái khởi tạo                                        |
| Công việc     | Hộp thoại                      | Hạn hoàn thành không được trước ngày giao                                                              |
| Báo cáo       | Hộp thoại                      | Số ngày cảnh báo 1–30; báo cáo đột xuất cần số văn bản yêu cầu                                         |
| Sự cố         | Hộp thoại                      | Diện tích cháy chỉ áp dụng cho loại Cháy; cơ sở liên quan lọc theo phường                              |

Các biểu mẫu hiện **ghi log ra console và hiện toast**, chưa gọi API. Điểm nối API nằm ở hàm
`onSubmit` của từng form.

## Quy tắc nghiệp vụ đã thể hiện trên giao diện

- **BR-02** — thiếu tài liệu bắt buộc thì cảnh báo và không cho hoàn thành (trang chi tiết cơ sở, vi phạm).
- **BR-03** — lịch sử thay đổi, chuyển giao phạm vi, nhật ký trước/sau.
- **BR-04, BR-05** — chỉ tiêu tối thiểu, kiểm tra đột xuất, nợ chỉ tiêu lũy kế.
- **BR-06** — yêu cầu và phản hồi giải trình.
- **BR-07** — số ngày báo trước cấu hình theo từng loại hạn.
- **BR-08** — dời lịch kiểm tra có lý do, hiển thị ngày gốc.
- **BR-09** — cơ sở đình chỉ phải được duyệt mới hoạt động lại.
- **BR-12 / NFR-02** — cảnh báo an toàn thông tin ở màn hình import và export.

## Điểm cần xác nhận với người sử dụng

Các điểm Q01–Q15 trong URD mục 15 được đánh dấu trực tiếp trên giao diện bằng nhãn vàng, ví dụ Q03 ở
màn hình phân công, Q05 ở checklist điều kiện PCCC, Q09 ở KPI, Q10 ở báo cáo, Q11 ở sự cố, Q12 ở
import/export, Q13 ở đăng nhập.

## Việc còn lại

Các phân hệ ngoài Authentication & Authorization vẫn là **giao diện dùng dữ liệu mẫu tĩnh**. Để đưa vào vận hành cần:

1. Thay `src/data/mock.ts` bằng lớp gọi API thật (giữ nguyên kiểu trong `src/data/types.ts`).
2. Nối `onSubmit` của các biểu mẫu nghiệp vụ vào API; dùng middleware xác thực/phân quyền và bộ lọc
   phạm vi trong `Backend` để bảo vệ từng module trước khi mở route trong `src/lib/auth-contract.ts`.
3. Bổ sung màn hình chi tiết còn thiếu: cuộc kiểm tra, sự cố, hồ sơ vi phạm, trao đổi theo công việc.
4. Chốt các điểm còn lại Q01, Q02, Q04–Q12, Q15 trước khi làm SRS/FSD.
