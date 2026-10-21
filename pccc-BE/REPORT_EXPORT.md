# M08 — Kết xuất báo cáo (UC-RPT-06)

Tài liệu này mô tả chức năng kết xuất báo cáo dạng dữ liệu tại `/bao-cao/ket-xuat`. Đây **không**
phải biểu mẫu báo cáo nghiệp vụ chính thức: mẫu/biểu mẫu ký duyệt của đơn vị chưa được cung cấp nên
bản demo chỉ xuất bảng dữ liệu có tiêu đề, cột, phần tổng hợp và ghi chú. Khi có mẫu chính thức, chỉ
phần trình bày được bổ sung; câu SQL và phạm vi dữ liệu vẫn do backend kiểm soát.

M08 hiện có hai nhóm chức năng tách biệt:

- `/bao-cao` — danh mục báo cáo, giao yêu cầu, deadline, nộp file và xác nhận hoàn thành.
- `/bao-cao/ket-xuat` — chọn báo cáo dữ liệu, lọc, xem trước, xuất Excel/PDF và lịch sử kết xuất.

`/tien-ich/export` là chức năng **M11 — kết xuất dữ liệu nghiệp vụ** (CSV cho cơ sở/cán bộ/khu vực),
không bị thay thế bởi trang M08 này. Hai chức năng dùng chung quyền `*.export` nhưng khác nguồn dữ
liệu, định dạng và mục đích.

## Phạm vi

- Chọn loại báo cáo, lọc theo thời gian/khu vực/cán bộ.
- Xem trước dữ liệu trước khi xuất.
- Xuất file Excel (`.xlsx`) hoặc PDF, tải xuống ngay.
- Lưu lịch sử từng lần kết xuất và cho phép tải lại file còn lưu.
- Quản lý cấu hình biểu mẫu tối thiểu: tên, tiêu đề, nhãn cột, ghi chú đầu/cuối.
- Không triển khai layout báo cáo chính thức, chữ ký số, lịch gửi báo cáo tự động hoặc R02 khi chưa
  có dữ liệu ngày hết hạn/chứng nhận tương ứng.

## Bộ dữ liệu

| Mã    | Tên                          | Nguồn                         | Lọc thời gian               | Lọc khu vực |
| ----- | ---------------------------- | ----------------------------- | --------------------------- | ----------- |
| `R01` | Tổng hợp cơ sở theo địa bàn  | `facility_overview`           | Không                       | Có          |
| `R03` | Vi phạm, đình chỉ, khắc phục | `facility_violations` + cơ sở | Có, theo `suspension_at`    | Có          |
| `R05` | Kết quả kiểm tra             | `inspections` + cơ sở         | Có, theo `scheduled_date`   | Có          |
| `R06` | Công việc theo cán bộ        | `tasks` + `accounts`          | Có, theo `tasks.created_at` | Không       |

`R02` không được bật vì schema hiện tại không có dữ liệu ngày hết hạn/giấy chứng nhận đủ tin cậy để
tổng hợp. Các báo cáo khác chỉ được thêm khi có nguồn dữ liệu đã hoàn thành và quy tắc nghiệp vụ rõ.

R06 gom theo tài khoản đang hoạt động trong phạm vi tài khoản của người dùng. `assigned_tasks` đếm
công việc được tạo trong kỳ; `overdue_tasks` là công việc còn mở, có hạn trước thời điểm hiện tại;
`completion_rate = completed_tasks / assigned_tasks`, làm tròn phần trăm.

## Bảng dữ liệu

Các bảng của M08 export dùng tiền tố `report_export_*` để không trùng với `report_types`,
`report_requests`, `report_submissions` của M08 báo cáo/deadline (migration 018):

| Bảng                        | Vai trò                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| `report_export_types`       | Danh mục báo cáo kết xuất đang bật, ánh xạ tới bộ dữ liệu đã hoàn thành.                  |
| `report_templates`          | Cấu hình trình bày: tiêu đề, nhãn cột, ghi chú, định dạng, cờ chính thức. Không chứa SQL. |
| `report_export_requests`    | Một yêu cầu kết xuất; trạng thái `processing/completed/failed`, kỳ và bộ lọc.             |
| `report_export_submissions` | File nhị phân đã tạo (BLOB), tên file, MIME type, kích thước.                             |
| `report_export_history`     | Lịch sử bất biến của mỗi lần kết xuất, gồm template name, format, exporter, thời gian.    |

Migration `022-report-export.sql` tạo các bảng trên, bật bốn loại báo cáo và cấp quyền demo. Không có
bảng thống kê song song: mọi dòng báo cáo được đọc từ bảng nghiệp vụ tại thời điểm gọi API.

## Quyền

| Quyền        | Dùng cho                                                          |
| ------------ | ----------------------------------------------------------------- |
| `M08.view`   | Xem loại báo cáo, bộ lọc, biểu mẫu, xem trước, lịch sử của mình   |
| `M08.create` | Tạo biểu mẫu trình bày                                            |
| `M08.edit`   | Dự phòng cho quản lý biểu mẫu; hiện API tạo mới dùng `M08.create` |
| `M08.export` | Tạo file và tải file lịch sử                                      |

Người dùng phải có ít nhất một scope; dữ liệu luôn lọc bằng `facilityScope` hoặc `accountScope` hiện
tại, kể cả khi biểu mẫu đã lưu bộ lọc cũ. A01/A04/A05 có bộ quyền demo đầy đủ và `M08.export`. A06
chỉ có `M08.view`: xem được danh mục, xem trước và lịch sử của mình nhưng không tạo file, phù hợp vai
trò lãnh đạo chỉ đọc. A02/A03 không được cấp `M08.export` trong bộ demo này.

Trên database đã có M08, migration 022 chỉ thêm `M08.export` cho các vai trò đang có `M08.view` là
A01/A04/A05; không sửa quyền của vai trò khác. Trên database mới, `seedDemo` cấp bộ quyền này.

A05 có scope `all` xem được toàn bộ lịch sử; người dùng khác chỉ thấy lịch sử do chính mình tạo.
Tải file kiểm tra lại `M08.export`, quyền sở hữu history (hoặc A05 toàn hệ thống), trạng thái và sự
tồn tại của file. Không có URL công khai cho file.

## API

Mọi API đều cần session hợp lệ; POST cần `Origin` đúng cấu hình. Các đường dẫn dùng namespace
`/api/report-export/*` để không trùng với `/api/reports/*` của báo cáo/deadline.

| Method | Đường dẫn                                    | Ghi chú                                                                                                |
| ------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| GET    | `/api/report-export/types`                   | Danh mục báo cáo + `maxRows`.                                                                          |
| GET    | `/api/report-export/options`                 | Khu vực, cán bộ theo cơ sở, tài khoản theo scope, format, kỳ mặc định.                                 |
| GET    | `/api/report-export/templates?reportTypeId=` | Biểu mẫu đang hoạt động, ưu tiên biểu mẫu chính thức.                                                  |
| POST   | `/api/report-export/templates`               | `{reportTypeId,name,format,title,headerNote,footerNote,columnLabels,isOfficial}`.                      |
| GET    | `/api/report-export/preview`                 | `reportTypeId` (hoặc `type`), `from`, `to`, `regionId`, `officerId`, `templateId`, `page`, `pageSize`. |
| POST   | `/api/report-export/exports`                 | Tạo file: `{reportTypeId,from,to,regionId,officerId,templateId,format}`.                               |
| GET    | `/api/report-export/exports`                 | Lịch sử; `page`, `pageSize`, `reportTypeId` (ID), `format`, `status`.                                  |
| GET    | `/api/report-export/exports/:id/file`        | Tải file theo ID lịch sử.                                                                              |

### Ví dụ

```http
GET /api/report-export/preview?type=R05&from=2026-10-01&to=2026-10-31&regionId=KP01
```

```json
{
  "reportType": { "code": "R05", "scope_kind": "facility" },
  "columns": [{ "key": "code", "label": "Mã kiểm tra", "numeric": false, "suffix": "" }],
  "rows": [{ "code": "KT-001", "facility_name": "Cơ sở CS001", "status": "Đã có kết quả" }],
  "total": 1,
  "summary": [{ "label": "Tổng số cuộc kiểm tra", "value": 1, "unit": "cuộc" }],
  "filters": { "from": "2026-10-01", "to": "2026-10-31", "regionId": "KP01" },
  "period": { "from": "2026-10-01", "to": "2026-10-31" }
}
```

```http
POST /api/report-export/exports
Content-Type: application/json

{ "reportTypeId": "R01", "format": "xlsx" }
```

Response `201` trả `item` chứa `id`, `row_count`, `file_name`, `file_size`, `status`, `download_url`.
Không có dữ liệu trả `409 EMPTY_REPORT`; vượt giới hạn trả `413 REPORT_TOO_LARGE`; template khác
định dạng trả `409 TEMPLATE_FORMAT_MISMATCH`.

## Bộ lọc và giới hạn

- `from`/`to` dùng `YYYY-MM-DD`, theo ngày nghiệp vụ Việt Nam; mặc định từ đầu tháng hiện tại đến hôm
  nay. `from <= to`.
- Khoảng thời gian tối đa **1.830 ngày** (5 × 366).
- Tối đa **5.000 dòng** mỗi file. Backend đọc thêm một dòng để phát hiện vượt giới hạn và trả 413.
- `pageSize` tối đa 100; preview mặc định 20.
- R01 từ chối `from`/`to`; R06 từ chối `regionId`.
- Vùng/cán bộ ngoài scope trả 403; loại báo cáo hoặc template không tồn tại trả 404.

## File Excel/PDF

- Excel có hai sheet: **Tổng hợp** (tiêu đề, kỳ, bộ lọc, người xuất, thời điểm, các chỉ tiêu) và
  **Dữ liệu** (bảng chi tiết, header, auto-filter).
- PDF khổ ngang A4, có tiêu đề, metadata, phần tổng hợp, bảng chi tiết, lặp header khi sang trang và
  số trang. Font Noto Sans được nhúng từ `pccc-BE/assets/NotoSans-Regular.ttf` (giấy phép OFL) để
  hiển thị tiếng Việt trên server không có font tương ứng.
- Không thêm dependency runtime; XLSX/ZIP và PDF được tạo bằng mã nguồn nội bộ.
- File được lưu trong `report_export_submissions` để tải lại từ lịch sử. Đây là lựa chọn phù hợp đồ
  án; production nên chuyển sang object storage, mã hóa và chính sách xóa theo thời hạn.

## Biểu mẫu

`report_templates` chỉ cho phép thay đổi:

- tiêu đề báo cáo;
- nhãn của các cột đã được định nghĩa trong code;
- ghi chú đầu/cuối;
- định dạng `xlsx|pdf`;
- cờ `is_official`.

Không thể thêm cột, đổi khóa cột, sửa SQL, mở rộng scope hoặc thay layout. Nhãn cột được kiểm tra
theo danh sách cột của loại báo cáo. Đây là hàng rào để biểu mẫu không trở thành kênh truy vấn dữ
liệu tùy ý. Biểu mẫu chính thức chỉ nên được đánh dấu sau khi có mẫu đã xác nhận.

## Kiểm thử

```bash
node --test pccc-BE/test/report-export.test.js
pnpm --filter pccc-be check
pnpm --filter pccc-fe typecheck
pnpm --filter pccc-fe build
```

Test bao phủ migration/quyền, scope và bộ lọc, preview, file XLSX/PDF, tải file, lịch sử, template và
các lỗi đầu vào. Test dùng database in-memory; không ghi vào database demo.

## Giới hạn đã biết

- Chưa có biểu mẫu báo cáo chính thức theo Q04/BR-12.
- Chưa có R02 do thiếu dữ liệu hết hạn/chứng nhận.
- Chưa có lịch gửi báo cáo, ký số, xuất nhiều báo cáo cùng lúc hoặc lưu file ra ngoài database.
- File PDF nhúng toàn bộ font nên dung lượng khoảng vài trăm KB mỗi file.
