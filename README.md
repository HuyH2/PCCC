# Hệ thống Quản lý công tác PCCC & CNCH — Frontend

Giao diện web (Next.js) cho **Hệ thống quản lý công tác phòng cháy, chữa cháy và cứu nạn, cứu hộ**
của PC07 — Đội Khu vực 10, xây dựng theo `URD_He_thong_Quan_ly_PCCC_CNCH_PC07_v1.0.docx`.

> ⚠️ **Bản demo dùng dữ liệu mẫu.** Theo NFR-02 và BR-12 của URD, môi trường demo chỉ được dùng dữ
> liệu mẫu hoặc dữ liệu đã xử lý. Toàn bộ số liệu trong `src/data/mock.ts` là hư cấu.

## Chạy dự án

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build production
```

## Công nghệ

| Thành phần | Lựa chọn |
|---|---|
| Framework | Next.js 15 (App Router, React 19, TypeScript) |
| Giao diện | Tailwind CSS v4 + shadcn/ui (new-york, Radix primitives) |
| Biểu mẫu | react-hook-form + zod (validate phía client) |
| Biểu đồ | Recharts |
| Icon | lucide-react |
| Font | Inter (subset `vietnamese`) |

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

| Đường dẫn | Phân hệ | Use Case |
|---|---|---|
| `/` | M10 | UC-SYS-02 — Dashboard điều hành (R01–R12) |
| `/tra-cuu` | M10 | UC-SYS-01 — Tìm kiếm toàn hệ thống |
| `/canh-bao` | M10 | UC-SYS-03 — Chuông nhắc việc, cấu hình BR-07 |
| `/to-chuc/don-vi` | M02 | UC-ORG-01 — Cây tổ chức 4 cấp |
| `/to-chuc/can-bo` | M02 | UC-ORG-02 — Danh bạ cán bộ |
| `/to-chuc/khu-vuc` | M02 | UC-ORG-03 — Danh mục khu phố |
| `/to-chuc/phan-cong` | M02 | UC-ORG-03, UC-ADM-04 — Phân công & chuyển giao |
| `/co-so` | M03 | UC-FAC-01, UC-FAC-02 — Danh sách cơ sở |
| `/co-so/them` | M03 | UC-FAC-02 — Biểu mẫu tạo hồ sơ cơ sở |
| `/co-so/[id]` | M03 | UC-FAC-03..08 — Hồ sơ, điều kiện PCCC, nhân sự, lịch sử |
| `/co-so/[id]/sua` | M03 | UC-FAC-02 — Biểu mẫu cập nhật hồ sơ cơ sở |
| `/vi-pham` | M04 | UC-VIO-01..05 — Vi phạm, đình chỉ, khắc phục |
| `/van-ban` | M05 | UC-DOC-01, UC-DOC-02 — Kho văn bản/quy chuẩn |
| `/kiem-tra/ke-hoach` | M06 | UC-INS-01, UC-INS-02 — Chỉ tiêu & nợ chỉ tiêu |
| `/kiem-tra/cuoc-kiem-tra` | M06 | UC-INS-03..08 — Hồ sơ cuộc kiểm tra |
| `/cong-viec/lich` | M07 | UC-WRK-01 — Lịch công tác 7 ngày |
| `/cong-viec/giao-viec` | M07 | UC-WRK-02, UC-WRK-03 — Giao việc & tiến độ |
| `/cong-viec/kpi` | M07 | UC-WRK-04 — KPI & nợ chỉ tiêu |
| `/cong-viec/giai-trinh` | M07 | UC-WRK-05 — Yêu cầu/phản hồi giải trình |
| `/bao-cao` | M08 | UC-RPT-01..04 — Báo cáo & deadline |
| `/su-co` | M09 | UC-INC-01..06 — Sự cố và thiệt hại |
| `/tien-ich/import` | M11 | UC-FAC-07, UC-SYS-04 — Import Excel có preview lỗi |
| `/tien-ich/export` | M11 | UC-RPT-06 — Kết xuất R01–R12 |
| `/quan-tri/tai-khoan` | M01 | UC-ADM-02 — Tài khoản |
| `/quan-tri/vai-tro` | M01 | UC-ADM-03 — Ma trận quyền 7 vai trò × 11 phân hệ |
| `/quan-tri/nhat-ky` | M01 | UC-SYS-05 — Nhật ký thao tác |
| `/dang-nhap` | M01 | UC-ADM-01 — Đăng nhập (layout riêng, ngoài sidebar) |

## Quyết định đã chốt với người sử dụng

| Điểm | Quyết định | Ảnh hưởng tới code |
|---|---|---|
| Q03 | **Một khu phố / một cơ sở có đúng một cán bộ phụ trách.** Đổi người thì dùng chuyển giao phạm vi, giữ nguyên lịch sử. | Giữ quan hệ 1-N hiện tại; biểu mẫu cơ sở chỉ cho chọn một cán bộ |
| Q13 | **Tài khoản nội bộ + mật khẩu** do Quản trị hệ thống cấp, bắt buộc đổi mật khẩu lần đầu. | Đã bỏ nút SSO ở màn hình đăng nhập |
| Q14 | **Web responsive là đủ** cho giai đoạn đầu, chưa làm PWA hay app native. | Không thêm manifest/service worker |

## Biểu mẫu nhập liệu

Ràng buộc dữ liệu tập trung ở [`src/data/schemas.ts`](src/data/schemas.ts) — khi đơn vị chốt bộ trường
chuẩn (Q04), chỉ cần sửa file này là toàn bộ biểu mẫu có hiệu lực theo.

| Biểu mẫu | Dạng | Ràng buộc đáng chú ý |
|---|---|---|
| Cơ sở | Trang riêng, nhiều nhóm trường | Cảnh báo trùng tên + địa chỉ; khu phố lọc theo phường; tách **Lưu nháp** và **Lưu chính thức** (BR-02) |
| Cán bộ | Hộp thoại | Email và điện thoại đúng định dạng; nghỉ/chuyển công tác chỉ đổi trạng thái |
| Vi phạm | Hộp thoại | Đánh dấu đình chỉ thì **bắt buộc có số quyết định**; hạn khắc phục phải sau ngày phát hiện |
| Cuộc kiểm tra | Hộp thoại | Có/không lập thông báo gửi cơ sở quyết định trạng thái khởi tạo |
| Công việc | Hộp thoại | Hạn hoàn thành không được trước ngày giao |
| Báo cáo | Hộp thoại | Số ngày cảnh báo 1–30; báo cáo đột xuất cần số văn bản yêu cầu |
| Sự cố | Hộp thoại | Diện tích cháy chỉ áp dụng cho loại Cháy; cơ sở liên quan lọc theo phường |

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

Bản này là **lớp giao diện dùng dữ liệu mẫu tĩnh**, chưa có backend. Để đưa vào vận hành cần:

1. Thay `src/data/mock.ts` bằng lớp gọi API thật (giữ nguyên kiểu trong `src/data/types.ts`).
2. Nối `onSubmit` của các biểu mẫu vào API; thêm xác thực thật, middleware chặn route và lọc dữ liệu
   theo phạm vi của tài khoản.
3. Bổ sung màn hình chi tiết còn thiếu: cuộc kiểm tra, sự cố, hồ sơ vi phạm, trao đổi theo công việc.
4. Chốt các điểm còn lại Q01, Q02, Q04–Q12, Q15 trước khi làm SRS/FSD.
