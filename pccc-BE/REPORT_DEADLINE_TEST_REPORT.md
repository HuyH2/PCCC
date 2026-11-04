# Báo cáo kiểm thử báo cáo, deadline, thông báo và Dashboard

## Phạm vi và môi trường

- **Kết quả kiểm thử mới nhất:** 20/20 test PASS trong các suite báo cáo, export, workflow và dashboard;
  `pnpm format:check` và `pnpm --filter pccc-be check` PASS.
- **Chưa chạy thủ công:** kiểm thử UI trình duyệt và mở file bằng ứng dụng Excel/PDF.

## Ma trận Use Case

| Use Case                                  | Kiểm tra đã có trong source test                                                                                                                                            | Kết quả lần chạy này                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| UC-RPT-01 — Danh mục/chế độ báo cáo       | Seed danh mục; API GET danh mục, loại định kỳ và kiểm tra quyền trong `reports.test.js`, `report-workflow.test.js`                                                          | PASS — covered by 20 passing tests across four suites |
| UC-RPT-02 — Tiếp nhận yêu cầu/văn bản đến | Tạo request qua API, trường bắt buộc, người nhận và phạm vi; danh sách/chi tiết trong `reports.test.js`, `report-workflow.test.js`                                          | PASS — covered by 20 passing tests across four suites |
| UC-RPT-03 — Thiết lập deadline            | ISO date hợp lệ, ngày không tồn tại/format sai, bộ lọc sắp hạn/quá hạn và trạng thái đóng trong `reports.test.js`, `report-workflow.test.js`                                | PASS — covered by 20 passing tests across four suites |
| UC-RPT-04 — Nộp/lưu báo cáo               | Upload PDF, trạng thái submitted/completed, DB metadata/blob, tải file có quyền, audit và file sai định dạng/magic bytes trong `reports.test.js`, `report-workflow.test.js` | PASS — covered by 20 passing tests across four suites |
| UC-RPT-05 — Báo cáo định kỳ/đột xuất      | Tạo request đột xuất; lịch tuần, sinh kỳ, cập nhật kỳ tiếp theo và từ chối sinh trùng trong `reports.test.js`, `report-workflow.test.js`                                    | PASS — covered by 20 passing tests across four suites |
| UC-RPT-06 — Xuất số liệu/biểu mẫu         | Preview, bộ lọc, template, XLSX/PDF, lịch sử, download authorization; test XLSX kiểm tra dữ liệu sau giải nén và lọc vùng trong `report-export.test.js`                     | PASS — covered by 20 passing tests across four suites |
| UC-SYS-02 — Dashboard điều hành           | So sánh API summary/drill-down với bảng nguồn, tổng theo vùng/cán bộ và scope trong `search-dashboard.test.js`, `report-workflow.test.js`                                   | PASS — covered by 20 passing tests across four suites |
| UC-SYS-03 — Thông báo/chuông nhắc việc    | Thông báo giao việc, nhắc deadline dedupe theo ngày, deep-link, đánh dấu đã đọc và quyền chủ sở hữu trong `reports.test.js`, `report-workflow.test.js`                      | PASS — covered by 20 passing tests across four suites |

## Test case và expected result

| ID    | Kịch bản                                                                             | Expected result                                                                                            |
| ----- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| TC-01 | Tạo yêu cầu → giao cán bộ → cán bộ nhận thông báo → nộp PDF → bên yêu cầu hoàn thành | Trạng thái `open → submitted → completed`; file tải lại đúng byte; audit có 3 sự kiện                      |
| TC-02 | Tạo yêu cầu hạn hôm nay → gọi API chuông hai lần → đánh dấu đã đọc                   | Có một nhắc hạn cho cùng ngày; người khác không thể đánh dấu; unread list bỏ thông báo sau khi đọc         |
| TC-03 | Tạo lịch tuần → sinh kỳ → gọi sinh kỳ lần hai                                        | Kỳ được tạo đúng hạn; request gắn schedule; sinh trùng trả HTTP 409                                        |
| TC-04 | Preview theo vùng → export XLSX/PDF → tải file                                       | Row count khớp preview; XLSX chứa CS001 và loại CS002 ngoài vùng; PDF có cấu trúc trang và MIME đúng       |
| TC-05 | Đối chiếu Dashboard với bảng facilities/regions/facility_overview và breakdown       | Summary và tổng breakdown khớp dữ liệu nguồn; người chưa đăng nhập nhận 401, người không có quyền nhận 403 |

## Bằng chứng và giới hạn

- **Notification:** kiểm tra qua API response, `object_id`, `target_path`, `kind`, unread list
  và trạng thái read. Cơ chế hiện tại sinh nhắc deadline khi API `GET /api/notifications`
  được gọi; chưa có bằng chứng scheduler nền hoặc thời điểm gửi theo cron.
- **Export:** test kiểm tra XLSX ZIP entry `sheet2.xml`, nội dung theo filter, chữ ký/MIME, PDF
  header và page objects. Chưa mở file bằng Microsoft Excel, LibreOffice hoặc trình đọc PDF để
  xác nhận render trực quan.
- **Dashboard:** UC-SYS-02 trong code hiện tính cơ sở, cán bộ phụ trách và khu vực. Dashboard
  không đọc bảng báo cáo; vì vậy thay đổi request báo cáo không làm thay đổi các chỉ số này.
  Đã có kiểm tra đối chiếu các chỉ số hiện có với bảng nguồn; chưa có kiểm thử trình duyệt.
- **UI/E2E trình duyệt:** NOT RUN. Các test trong báo cáo là backend HTTP/API và service/database,
  không mô phỏng người dùng qua giao diện trình duyệt.
- **Đồng bộ dữ liệu:** chưa thể xác nhận môi trường production. Bộ test dự kiến xác nhận trong
  cùng database test: trạng thái request, submission blob/metadata, audit, notification và các
  metric dashboard từ bảng nguồn.

## Bug và retest

- No test failures remain in the four suites executed (20/20 PASS).
- **Đã chạy:** bốn suite nêu ở đầu báo cáo (20/20 PASS), `pnpm format:check` và
  `pnpm --filter pccc-be check`.
- **Retest thủ công:** thao tác luồng TC-01/02 trên UI; mở XLSX và PDF được export; đối chiếu
  dashboard với API/database trên môi trường được cấp phép; chụp màn hình notification, file
  export và dashboard để đính kèm Jira.
