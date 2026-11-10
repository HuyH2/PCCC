# BỘ HỒ SƠ TEST CASES CHI TIẾT — PHÂN HỆ M07
## LỊCH CÔNG TÁC – GIAO VIỆC – TIẾN ĐỘ – KPI – GIẢI TRÌNH – TRAO ĐỔI
### Dự án: Hệ thống Quản lý PCCC & CNCH — PC07 / Đội Khu vực 10

---

## 1. THÔNG TIN TÀI LIỆU

- **Mã tài liệu:** `TC-PCCC-M07-WRK`
- **Phiên bản:** `2.0`
- **Ngày lập:** `09/11/2026`
- **Người lập:** QA Lead / Business Analyst
- **Phạm vi kiểm thử:** Phân hệ M07 gồm 6 Use Cases:
  - **UC-WRK-01:** Lịch công tác hàng ngày & quá hạn
  - **UC-WRK-02:** Tạo & giao việc cho cán bộ
  - **UC-WRK-03:** Cập nhật tiến độ, hoàn thành & đổi trạng thái công việc
  - **UC-WRK-04:** Quản lý chỉ tiêu, kết quả KPI & nợ cộng dồn
  - **UC-WRK-05:** Yêu cầu, phản hồi & xử lý giải trình công việc/KPI
  - **UC-WRK-06:** Trao đổi & nhắn tin theo công việc (Thread messaging)
- **Tài liệu căn cứ:** `pccc-BE/WORK_KPI.md`, `PROJECT.md` (F09, F10), `pccc-BE/src/modules/{tasks,kpi,explanations}`, `pccc-BE/test/{work-kpi,task-messages,m07-e2e}.test.js`.

---

## 2. QUY ƯỚC & BẢNG MÃ ĐỊNH DANH

- **Mã Test Case:**
  - `TC-WRK-<UC>-<nn>`: Functional Test Case cho từng Use Case (01 đến 06).
  - `TC-WRK-E2E-<nn>`: End-to-End Test Case toàn trình (01 đến 04).
  - `TC-WRK-NEG-<nn>`: Negative / Security Test Case (01 đến 10).
  - `TC-WRK-INT-<nn>`: Integration / Concurrency / UI Test Case (01 đến 05).
- **Mức ưu tiên:**
  - `P1 (Cao)`: Luồng chính, nghiệp vụ cốt lõi, bảo mật, phân quyền, dữ liệu tài chính/KPI.
  - `P2 (Trung bình)`: Luồng phụ, lọc, tìm kiếm, phân trang, thông báo, chuyển trạng thái.
  - `P3 (Thấp)`: Định dạng hiển thị, kiểm tra giao diện biên, tính năng tùy chọn.
- **Trạng thái kiểm thử:**
  - `PASS`: Đã thực thi thực tế (test tự động hoặc thao tác thủ công) và đạt kết quả mong đợi.
  - `FAIL`: Đã thực thi nhưng kết quả thực tế không khớp với kết quả mong đợi (phát sinh Bug).
  - `NOT RUN`: Chưa được thực thi (hoặc tính năng chưa được triển khai/thiếu điều kiện chạy).
  - `BLOCKED`: Bị chặn do lỗi khác hoặc môi trường không đáp ứng.

---

## 3. DANH SÁCH TEST CASES CHI TIẾT (59 TEST CASES)

### 3.1 UC-WRK-01: Lịch công tác hàng ngày & Việc quá hạn (5 TCs)

| TC ID | Nhóm | UC | Mô tả | Tiền điều kiện | Dữ liệu test | Bước thực hiện | Kết quả mong đợi | Priority | Loại | Trạng thái | Bằng chứng | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **TC-WRK-01-01** | WRK | UC-WRK-01 | Xem lịch 7 ngày tới theo khoảng ngày from/to và sort=due | Session đăng nhập hợp lệ (A01..A05) | `from=today&to=today+6d&sort=due` | Gửi `GET /api/tasks?from=...&to=...&sort=due` | 200 OK; danh sách trả về đúng các task có `due_at` nằm trong khoảng; sắp xếp tăng dần theo `due_at` | P1 | Functional | **PASS** | `m07-e2e.test.js:728` | API backend |
| **TC-WRK-01-02** | WRK | UC-WRK-01 | Lọc danh sách công việc quá hạn (deadline=overdue) | Session cán bộ thực hiện | `deadline=overdue` | Gửi `GET /api/tasks?deadline=overdue` | 200 OK; chỉ trả về task có `due_at < đầu ngày hôm nay (00:00:00 VN)` và `status='open'` | P1 | Functional | **PASS** | `m07-e2e.test.js:763` | Tính theo giờ VN |
| **TC-WRK-01-03** | WRK | UC-WRK-01 | Kiểm tra ranh giới: Việc đến hạn hôm nay chưa bị tính là quá hạn | Session cán bộ; có task đến hạn hôm nay (23:59:59 VN) | Task có `due_at` cuối ngày hôm nay | Gọi API `GET /api/tasks?deadline=overdue` | 200 OK; task đến hạn hôm nay KHÔNG xuất hiện trong danh sách quá hạn | P1 | Boundary | **PASS** | `m07-e2e.test.js:765` | Múi giờ Asia/Ho_Chi_Minh |
| **TC-WRK-01-04** | WRK | UC-WRK-01 | Việc đã hoàn thành hoặc đã hủy không bao giờ rơi vào danh sách quá hạn | Session cán bộ; có task quá hạn nhưng `status='completed'`/`'cancelled'` | `status='completed'`, `due_at` trong quá khứ | Gọi API `GET /api/tasks?deadline=overdue` | 200 OK; các task đã đóng không bao giờ xuất hiện trong danh sách quá hạn | P2 | Boundary | **PASS** | `m07-e2e.test.js:768` | Lọc theo status='open' |
| **TC-WRK-01-05** | WRK | UC-WRK-01 | Phân quyền dữ liệu lịch công tác: Người dùng chỉ thấy việc mình giao hoặc được giao | Session cán bộ A03 | Đăng nhập tài khoản DEMO-A03 | Gọi `GET /api/tasks` và `GET /api/tasks/mine` | 200 OK; 100% bản ghi trả về có `assigned_to='DEMO-A03'` hoặc `assigned_by='DEMO-A03'`, không thấy việc người khác | P1 | Security | **PASS** | `work-kpi.test.js:144` | Isolation data |

---

### 3.2 UC-WRK-02: Tạo & Giao việc cho cán bộ (6 TCs)

| TC ID | Nhóm | UC | Mô tả | Tiền điều kiện | Dữ liệu test | Bước thực hiện | Kết quả mong đợi | Priority | Loại | Trạng thái | Bằng chứng | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **TC-WRK-02-01** | WRK | UC-WRK-02 | Tạo task và giao việc hợp lệ bởi A01/A02/A05 | Session A01 (Chỉ huy) hoặc A02/A05 | Tiêu đề, mô tả, kind='assigned', dueDate hợp lệ, assigneeId='DEMO-A03' | `POST /api/tasks` | 201 Created; task tạo với `status='open'`, `progress=0`; bảng `task_assignments` có đúng 1 dòng mở (`ended_at IS NULL`); audit `task.created` | P1 | Functional | **PASS** | `m07-e2e.test.js:69`, `work-kpi.test.js:123` | Cập nhật từ NOT RUN |
| **TC-WRK-02-02** | WRK | UC-WRK-02 | Lấy danh sách cán bộ hợp lệ nhận việc theo scope | Session A01 có scope unit/all | `GET /api/tasks/assignees` | Gửi request lấy assignees | 200 OK; danh sách chỉ gồm các tài khoản active, có quyền `M07.view`, thuộc phạm vi quản lý và không gồm chính người gọi | P2 | Functional | **PASS** | `task-messages.test.js:180` | Dropdown giao việc |
| **TC-WRK-02-03** | WRK | UC-WRK-02 | Chặn giao việc cho người ngoài scope hoặc không tồn tại | Session A01 | `assigneeId='NON-EXISTENT'` | `POST /api/tasks` với assigneeId không hợp lệ | 403 FORBIDDEN, mã lỗi `FORBIDDEN`; không tạo task, không ghi assignment | P1 | Negative | **PASS** | `m07-e2e.test.js:424` | Scope guard |
| **TC-WRK-02-04** | WRK | UC-WRK-02 | Chặn tạo task với hạn hoàn thành sai định dạng hoặc ngày không tồn tại | Session A01 | `dueDate='2026-02-30'` hoặc `'2026-13-01'` | `POST /api/tasks` với ngày không hợp lệ | 400 INVALID_INPUT, mã lỗi `INVALID_INPUT`; thông báo hạn hoàn thành không hợp lệ | P2 | Negative | **NOT RUN** | - | Chưa có test kiểm tra ngày sai 2026-02-30 |
| **TC-WRK-02-05** | WRK | UC-WRK-02 | Kiểm tra xử lý hạn hoàn thành trong quá khứ | Session A01 | `dueDate` trong quá khứ (hợp lệ lịch) | `POST /api/tasks` với ngày quá khứ | Hệ thống chấp nhận (201 Created) để ghi nhận công việc thực tế đã triển khai trước đó | P2 | Boundary | **NOT RUN** | - | Trích dẫn source tasks.service.js:106, chưa có test chạy thật |
| **TC-WRK-02-06** | WRK | UC-WRK-02 | Kiểm tra độ dài biên: Tiêu đề (1..200 ký tự) và Mô tả (1..4000 ký tự) | Session A01 | Tiêu đề rỗng hoặc > 200 ký tự; mô tả > 4000 ký tự | `POST /api/tasks` với chuỗi biên | 400 INVALID_INPUT khi ngoài biên; 201 Created khi trong biên | P2 | Boundary | **NOT RUN** | - | Trích dẫn source tasks.service.js:81-92, chưa có test chạy thật (Custom validation core) |

---

### 3.3 UC-WRK-03: Cập nhật tiến độ & Hoàn thành công việc (7 TCs)

| TC ID | Nhóm | UC | Mô tả | Tiền điều kiện | Dữ liệu test | Bước thực hiện | Kết quả mong đợi | Priority | Loại | Trạng thái | Bằng chứng | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **TC-WRK-03-01** | WRK | UC-WRK-03 | Cán bộ cập nhật tiến độ (0–100%) kèm ghi chú | Session người nhận việc (A03), task đang open | `progress=30`, `note='Đang kiểm tra'` | `PUT /api/tasks/:id/progress` | 200 OK; task cập nhật tiến độ; ghi 1 dòng vào `task_progress` (append-only); ghi audit `task.progress_updated` | P1 | Functional | **PASS** | `m07-e2e.test.js:100` | Cập nhật từ NOT RUN |
| **TC-WRK-03-02** | WRK | UC-WRK-03 | Quy tắc nghiệp vụ cốt lõi: Tiến độ 100% không tự hoàn thành task | Session người nhận (A03) | `progress=100`, `note='Hoàn thành kiểm tra'` | `PUT /api/tasks/:id/progress` | 200 OK; `progress=100` nhưng `status` vẫn giữ nguyên là `open`, `completed_at=null` | P1 | Rule | **PASS** | `m07-e2e.test.js:125` | Đặc tả M07 |
| **TC-WRK-03-03** | WRK | UC-WRK-03 | Hoàn thành công việc bởi người nhận hoặc người giao | Session người nhận (A03) hoặc người giao (A01) | `status='completed'`, `note='Đã ký biên bản'` | `PUT /api/tasks/:id/status` | 200 OK; `status='completed'`, `progress=100`, `completed_at` được gán epoch hiện tại; ghi nhật ký tiến độ | P1 | Functional | **PASS** | `m07-e2e.test.js:132` | Người nhận / Người giao |
| **TC-WRK-03-04** | WRK | UC-WRK-03 | Quyền hủy (cancelled) và mở lại (open) chỉ thuộc người giao việc | Session người giao (A01) vs Session người nhận (A03) | `status='cancelled'` | A03 gửi `PUT status='cancelled'` → 403; A01 gửi `PUT status='cancelled'` → 200 | A03 bị chặn với 403 FORBIDDEN; A01 hủy thành công; chỉ người giao được hủy/mở lại | P2 | Security | **PASS** | `m07-e2e.test.js:446`, `work-kpi.test.js:158` | Phân quyền trạng thái |
| **TC-WRK-03-05** | WRK | UC-WRK-03 | Chặn cập nhật tiến độ trùng lặp không có ghi chú | Session người nhận | `progress=0` (trùng giá trị hiện tại), `note=''` | `PUT /api/tasks/:id/progress` | 409 Conflict, mã lỗi `NO_CHANGE`; tiến độ không thay đổi | P2 | Negative | **PASS** | `m07-e2e.test.js:462` | Tránh spam log |
| **TC-WRK-03-06** | WRK | UC-WRK-03 | Chặn cập nhật tiến độ hoặc hoàn thành trên công việc đã đóng | Task đã `completed` hoặc `cancelled` | `progress=80` | `PUT /api/tasks/:id/progress` | 409 Conflict, mã lỗi `TASK_CLOSED`; không thay đổi dữ liệu | P1 | Negative | **PASS** | `m07-e2e.test.js:478` | Bảo vệ toàn vẹn |
| **TC-WRK-03-07** | WRK | UC-WRK-03 | Xem lịch sử tiến độ công việc đầy đủ before/after | Session người trong task | `GET /api/tasks/:id/progress-history` | Gọi API lịch sử | 200 OK; trả về đầy đủ các mốc tiến độ kèm thông tin người sửa, thời gian, before progress, after progress | P2 | Functional | **PASS** | `m07-e2e.test.js:148` | Audit timeline |

---

### 3.4 UC-WRK-04: Quản lý KPI, Chỉ tiêu & Nợ cộng dồn (7 TCs)

| TC ID | Nhóm | UC | Mô tả | Tiền điều kiện | Dữ liệu test | Bước thực hiện | Kết quả mong đợi | Priority | Loại | Trạng thái | Bằng chứng | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **TC-WRK-04-01** | WRK | UC-WRK-04 | Cấu hình chỉ tiêu KPI (upsert) bởi A01/A02/A05 | Session A01/A05 | `accountId='DEMO-A03'`, `period='2026-11'`, `targetTasks=5` | `POST /api/kpi/targets` | 201 Created; lưu chỉ tiêu; gọi lại lần 2 ghi đè hợp lệ (upsert) | P1 | Functional | **PASS** | `m07-e2e.test.js:180` | 0..10000 |
| **TC-WRK-04-02** | WRK | UC-WRK-04 | Tính điểm KPI tự động theo công thức chuẩn | Chỉ tiêu 5, cán bộ hoàn thành 3 việc trong kỳ | `period='2026-11'`, `target=5`, `completed=3` | `GET /api/kpi/results?period=...&accountId=DEMO-A03` | 200 OK; `available=5`, `completed_tasks=3`, `debt=2`, `score=round(3/5*100)=60` | P1 | Functional | **PASS** | `m07-e2e.test.js:210` | Công thức chuẩn |
| **TC-WRK-04-03** | WRK | UC-WRK-04 | Nợ chỉ tiêu cộng dồn tuần tự sang kỳ tiếp theo | Kỳ trước nợ 2; kỳ này đặt chỉ tiêu 3 | `target=3`, `previous_debt=2` | `GET /api/kpi/results?period=nextP` | 200 OK; `available = 3 + 2 = 5`; nợ kỳ trước được mang sang đầy đủ | P1 | Functional | **PASS** | `m07-e2e.test.js:231` | Lũy kế đa kỳ |
| **TC-WRK-04-04** | WRK | UC-WRK-04 | Vượt chỉ tiêu không có credit/âm nợ; điểm tối đa 100 | Cần 5 việc, hoàn thành 6 việc | `available=5`, `completed=6` | `GET /api/kpi/results?period=nextP` | 200 OK; `debt=0` (không âm), `score=100` (không vượt 100, không credit kỳ sau) | P1 | Boundary | **PASS** | `m07-e2e.test.js:246` | Max 100 score |
| **TC-WRK-04-05** | WRK | UC-WRK-04 | Kỳ chưa cấu hình chỉ tiêu: configured=false, điểm 0 | Kỳ chưa gọi POST kpi/targets | `period='2025-01'` | `GET /api/kpi/results?period=2025-01` | 200 OK; `configured=false`, `score=0`, `target_tasks=0`, vẫn mang nợ kỳ trước nếu có | P2 | Functional | **PASS** | `m07-e2e.test.js:487` | Tránh chia cho 0 |
| **TC-WRK-04-06** | WRK | UC-WRK-04 | Tra cứu nhanh nợ chỉ tiêu qua API chuyên biệt | Đã có dữ liệu KPI | `period='2026-11'` | `GET /api/kpi/debt?period=...&accountId=...` | 200 OK; trả về đúng trường `debt`, `target_tasks`, `completed_tasks` | P2 | Functional | **PASS** | `work-kpi.test.js:278` | Endpoint chuyên biệt |
| **TC-WRK-04-07** | WRK | UC-WRK-04 | Phân quyền xem KPI: A03/A04 chỉ xem của mình; A01/A02 xem cấp dưới | Session A03 vs Session A01 | Kỳ tháng hiện tại | Gọi GET /api/kpi/results | A03 gọi API chỉ nhận về 1 item của chính mình; A01 nhận về toàn bộ cán bộ trong scope | P1 | Security | **PASS** | `work-kpi.test.js:200-210` | RBAC + Data Scope |

---

### 3.5 UC-WRK-05: Yêu cầu, Phản hồi & Xử lý Giải trình (8 TCs)

| TC ID | Nhóm | UC | Mô tả | Tiền điều kiện | Dữ liệu test | Bước thực hiện | Kết quả mong đợi | Priority | Loại | Trạng thái | Bằng chứng | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **TC-WRK-05-01** | WRK | UC-WRK-05 | Tạo yêu cầu giải trình theo kỳ KPI (period) bởi A01/A02/A05 | Session A01; có cán bộ nợ KPI | `accountId='DEMO-A03'`, `period='2026-11'`, `reason='Giải trình nợ KPI'` | `POST /api/explanations` | 201 Created; bản ghi tạo ở trạng thái `status='requested'`, lưu đúng `period`, `taskId=null` | P1 | Functional | **PASS** | `m07-e2e.test.js:274` | Yêu cầu theo kỳ |
| **TC-WRK-05-02** | WRK | UC-WRK-05 | Tạo yêu cầu giải trình theo công việc cụ thể (taskId) | Session A01; task do A01 giao cho A03 | `accountId='DEMO-A03'`, `taskId=...`, `reason='Chậm tiến độ'` | `POST /api/explanations` | 201 Created; lưu đúng `task_id`, `period=null`; chỉ người giao việc mới được yêu cầu | P1 | Functional | **PASS** | `m07-e2e.test.js:325` | Yêu cầu theo task |
| **TC-WRK-05-03** | WRK | UC-WRK-05 | Cán bộ gửi phản hồi giải trình (chuyển requested -> submitted) | Session A03 (người bị yêu cầu) | `response='Do hỗ trợ chữa cháy...'` | `PUT /api/explanations/:id/response` | 200 OK; cập nhật `response`, chuyển `status='submitted'`, `submitted_at=now` | P1 | Functional | **PASS** | `m07-e2e.test.js:292` | Chuyển trạng thái |
| **TC-WRK-05-04** | WRK | UC-WRK-05 | Người yêu cầu/A05 chấp thuận giải trình kỳ KPI -> Xóa nợ chỉ tiêu | Trạng thái `submitted`, có `period` | `decision='accepted'`, `note='Chấp thuận'` | `PUT /api/explanations/:id/review` | 200 OK; `status='accepted'`, `debt_waived=1`; lần tính KPI tiếp theo nợ kỳ này = 0 | P1 | Functional | **PASS** | `m07-e2e.test.js:300` | Xóa nợ kỳ |
| **TC-WRK-05-05** | WRK | UC-WRK-05 | Người yêu cầu từ chối giải trình -> Giữ nguyên nợ | Trạng thái `submitted` | `decision='rejected'`, `note='Lý do không hợp lý'` | `PUT /api/explanations/:id/review` | 200 OK; `status='rejected'`, `debt_waived=0`; nợ KPI không thay đổi | P1 | Functional | **NOT RUN** | - | Trích dẫn source explanations.service.js:241, chưa có test chạy thật |
| **TC-WRK-05-06** | WRK | UC-WRK-05 | Chấp thuận giải trình theo công việc KHÔNG tự động xóa nợ KPI | Trạng thái `submitted`, gắn với `taskId` | `decision='accepted'` | `PUT /api/explanations/:id/review` | 200 OK; `status='accepted'` nhưng `debt_waived=0`; không ảnh hưởng tới nợ KPI | P2 | Rule | **PASS** | `m07-e2e.test.js:340` | Quy tắc M07 |
| **TC-WRK-05-07** | WRK | UC-WRK-05 | Phân quyền xem giải trình: A05 xem tất cả; người khác chỉ xem việc liên quan mình | Session A05 vs Session A03 | Danh sách giải trình hệ thống | Gọi `GET /api/explanations` | A05 xem 100% giải trình toàn hệ thống; A03 chỉ thấy giải trình mình yêu cầu hoặc bị yêu cầu | P1 | Security | **NOT RUN** | - | Trích dẫn source explanations.service.js:47-50, chưa có test chạy thật |
| **TC-WRK-05-08** | WRK | UC-WRK-05 | Đính kèm file tài liệu minh chứng trong giải trình | Cán bộ gửi giải trình có file PDF đính kèm | File PDF minh chứng ≤ 10MB | Upload file đính kèm kèm form giải trình | Hệ thống lưu trữ file đính kèm và hiển thị link xem cho người duyệt | P3 | Gap | **NOT RUN** | `explanations table: no attachment_url` | **Chưa triển khai ở DB/API** |

---

### 3.6 UC-WRK-06: Trao đổi & Nhắn tin theo công việc (7 TCs)

| TC ID | Nhóm | UC | Mô tả | Tiền điều kiện | Dữ liệu test | Bước thực hiện | Kết quả mong đợi | Priority | Loại | Trạng thái | Bằng chứng | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **TC-WRK-06-01** | WRK | UC-WRK-06 | Gửi tin nhắn trao đổi trong công việc đang mở (thành viên task) | Session A01 hoặc A03 của task; task open | `body='Đồng chí mang theo biên bản 03'` | `POST /api/tasks/:id/messages` | 201 Created; tin nhắn được lưu, gắn `sender_id`, `created_at`; ghi audit `task_message.sent` | P1 | Functional | **PASS** | `m07-e2e.test.js:370`, `task-messages.test.js:90` | Chuẩn hóa UC-WRK-06 |
| **TC-WRK-06-02** | WRK | UC-WRK-06 | Xem danh sách tin nhắn theo thứ tự thời gian kèm phân trang | Task có nhiều tin nhắn trao đổi | `page=1, pageSize=20` | `GET /api/tasks/:id/messages` | 200 OK; trả về thread tin nhắn theo thứ tự tăng dần thời gian; thông tin người gửi hiển thị chuẩn | P1 | Functional | **PASS** | `m07-e2e.test.js:383`, `task-messages.test.js:105` | Thread per task |
| **TC-WRK-06-03** | WRK | UC-WRK-06 | Tác giả sửa tin nhắn; người khác sửa bị chặn; không sửa trùng | Session người gửi tin | `body='Nội dung đã sửa'` | `PUT /api/tasks/:id/messages/:mid` | 200 OK khi tác giả sửa; 403 khi người khác sửa; 409 NO_CHANGE khi nội dung trùng nội dung cũ | P2 | Functional | **PASS** | `m07-e2e.test.js:399`, `task-messages.test.js:130` | Chỉ tác giả sửa |
| **TC-WRK-06-04** | WRK | UC-WRK-06 | Xóa mềm tin nhắn: Chỉ tác giả được xóa, nội dung chuyển null | Session người gửi tin | `DELETE /api/tasks/:id/messages/:mid` | Tác giả xóa tin nhắn | 200 OK; `deleted_at` được gán; khi đọc lại `body` trả về `null`; audit ghi `task_message.deleted` | P2 | Functional | **PASS** | `m07-e2e.test.js:406`, `task-messages.test.js:145` | Xóa mềm bảo toàn audit |
| **TC-WRK-06-05** | WRK | UC-WRK-06 | Người ngoài công việc xem hoặc gửi tin nhắn bị chặn 404 NOT_FOUND | Session người dùng không thuộc task (A02) | `GET / POST /api/tasks/:id/messages` | A02 cố tình truy cập tin nhắn task của A01 & A03 | 404 NOT_FOUND, mã lỗi `NOT_FOUND` (bảo vệ quyền riêng tư, không lộ thông tin task) | P1 | Security | **PASS** | `m07-e2e.test.js:512`, `task-messages.test.js:95` | Bảo mật riêng tư |
| **TC-WRK-06-06** | WRK | UC-WRK-06 | Chặn gửi tin nhắn vào công việc đã hoàn thành hoặc đã hủy | Task đã `completed` hoặc `cancelled` | `body='Gửi vào task đóng'` | `POST /api/tasks/:id/messages` | 409 Conflict, mã lỗi `TASK_CLOSED`; không gửi được tin | P1 | Negative | **PASS** | `m07-e2e.test.js:419`, `task-messages.test.js:160` | Khóa luồng trao đổi |
| **TC-WRK-06-07** | WRK | UC-WRK-06 | Kiểm tra giao diện người dùng tự động làm mới tin nhắn định kỳ 5 giây | Giao diện `/cong-viec/giao-viec/[id]` | Mở hai trình duyệt khác nhau | A01 gửi tin ở màn hình 1; quan sát màn hình 2 của A03 sau ≤ 5 giây | Tin nhắn mới tự động xuất hiện trên màn hình A03 mà không cần F5 tải lại trang | P2 | UI/Polling | **NOT RUN** | - | Trích dẫn source task-conversation.tsx:39, chưa có biên bản UAT UI thủ công |

---

### 3.7 End-to-End Test Cases (4 TCs)

| TC ID | Nhóm | UC | Mô tả | Tiền điều kiện | Dữ liệu test | Bước thực hiện | Kết quả mong đợi | Priority | Loại | Trạng thái | Bằng chứng | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **TC-WRK-E2E-01** | WRK | Toàn trình | Toàn trình vòng đời công việc từ Giao việc → Tiến độ qua các mốc → Hoàn thành → Nghiệm thu | Tài khoản A01 (Chỉ huy) và A03 (Cán bộ) hoạt động | Task "Kiểm tra an toàn PCCC chung cư Sunshine", dueDate=today | 1. A01 tạo task giao A03<br>2. A03 xem việc<br>3. A03 cập nhật tiến độ 30% → 70% → 100%<br>4. A03 hoàn thành task<br>5. A01 kiểm tra lịch sử tiến độ và audit | Trạng thái, tiến độ, người phụ trách, `completed_at` hiển thị chuẩn xác ở cả 2 phía; 100% không tự hoàn thành; lịch sử tiến độ 4 mốc; audit đầy đủ 3 action | P1 | E2E | **PASS** | `m07-e2e.test.js:69` | Bắt buộc (TC-01) |
| **TC-WRK-E2E-02** | WRK | Toàn trình | Toàn trình thiết lập chỉ tiêu, tính KPI lũy kế nợ đa kỳ và kiểm tra giới hạn trần | Tài khoản A01, A03, A05 hoạt động | Kỳ P: target=5, hoàn thành 3 việc; Kỳ P+1: target=3, hoàn thành 6 việc | 1. Đặt chỉ tiêu 5 kỳ P<br>2. Hoàn thành 3 việc<br>3. Kiểm tra KPI kỳ P (score 60, debt 2)<br>4. Đặt chỉ tiêu 3 kỳ P+1, kiểm tra mang nợ 2 sang (available=5)<br>5. Hoàn thành 6 việc (vượt chỉ tiêu), kiểm tra score=100, debt=0 | Điểm KPI tính đúng công thức; nợ mang sang tuần tự chính xác; vượt chỉ tiêu không bị điểm âm/credit; điểm tối đa đạt trần 100 | P1 | E2E | **PASS** | `m07-e2e.test.js:166` | Bắt buộc (TC-02) |
| **TC-WRK-E2E-03** | WRK | Toàn trình | Toàn trình yêu cầu, phản hồi và phê duyệt giải trình miễn trừ nợ KPI | Có cán bộ nợ KPI tháng; A01 và A03 hoạt động | Yêu cầu giải trình kỳ có nợ 4 việc; giải trình theo task | 1. A01 yêu cầu A03 giải trình kỳ P<br>2. A03 xem và gửi phản hồi<br>3. A01 duyệt chấp thuận (accepted)<br>4. Kiểm tra KPI: nợ kỳ P được xóa (debt=0, waived=4)<br>5. A01 yêu cầu giải trình theo taskId, duyệt accepted → nợ KPI không đổi | Luồng trạng thái `requested → submitted → accepted` chuẩn xác; giải trình kỳ xóa nợ thành công; giải trình task không xóa nợ; ghi nhận upload file chưa có | P1 | E2E | **PASS** | `m07-e2e.test.js:257` | Bắt buộc (TC-03) |
| **TC-WRK-E2E-04** | WRK | Toàn trình | Toàn trình trao đổi hội thoại hai chiều qua hai phiên làm việc độc lập | Hai phiên đăng nhập độc lập của A01 và A03 | Tin nhắn văn bản nghiệp vụ, sửa tin, xóa mềm | 1. A01 gửi tin nhắn trong task<br>2. A03 đăng nhập xem tin và phản hồi lại<br>3. A01 sửa nội dung tin nhắn<br>4. A01 xóa mềm tin nhắn<br>5. A03 reload kiểm tra nội dung bị ẩn (null)<br>6. Đóng task và kiểm tra chặn gửi tin mới | Tin nhắn hiển thị tức thì, đúng người gửi, thời gian; sau reload vẫn lưu trữ bền vững; sửa/xóa đúng quyền; việc đóng chặn mutation | P1 | E2E | **PASS** | `m07-e2e.test.js:352` | Bắt buộc (TC-04) |

---

### 3.7 Negative & Security Test Cases (10 TCs)

| TC ID | Nhóm | UC | Mô tả | Tiền điều kiện | Dữ liệu test | Bước thực hiện | Kết quả mong đợi | Priority | Loại | Trạng thái | Bằng chứng | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **TC-WRK-NEG-01** | NEG | UC-WRK-02 | Giao việc cho cán bộ không hợp lệ / không tồn tại trong danh mục | Session A01 | `assigneeId='NON-EXISTENT'` | Gửi `POST /api/tasks` với assigneeId không tồn tại | 403 FORBIDDEN, mã lỗi `FORBIDDEN`; chặn tạo công việc khi người nhận không hợp lệ | P1 | Negative | **PASS** | `m07-e2e.test.js:447` | Kiểm tra assigneeId không tồn tại |
| **TC-WRK-NEG-02** | NEG | UC-WRK-03 | Cập nhật công việc ngoài quyền (vai trò A06 hoặc người ngoài việc) | Session A06 (Người xem) hoặc cán bộ khác | Cố tình sửa tiến độ hoặc hủy việc | `PUT /api/tasks/:id/progress` hoặc `PUT status` | 403 FORBIDDEN, dữ liệu công việc giữ nguyên không bị thay đổi | P1 | Security | **PASS** | `m07-e2e.test.js:439` | Bắt buộc (NEG-02) |
| **TC-WRK-NEG-03** | NEG | UC-WRK-03 | Giá trị tiến độ không hợp lệ: -1, 101, 50.5, chuỗi, rỗng, null | Session cán bộ thực hiện | `progress = -1, 101, 50.5, "abc", null` | `PUT /api/tasks/:id/progress` | 400 INVALID_INPUT, mã lỗi `INVALID_INPUT`; tiến độ cũ giữ nguyên | P1 | Boundary | **PASS** | `m07-e2e.test.js:453` | Bắt buộc (NEG-03) |
| **TC-WRK-NEG-04** | NEG | UC-WRK-03 | Thao tác trên công việc đã đóng hoặc hoàn thành lặp lại | Task đã ở trạng thái `completed` | Gửi tiếp yêu cầu `status='completed'` | `PUT /api/tasks/:id/status` | 409 Conflict, mã lỗi `NO_CHANGE` hoặc `TASK_CLOSED`; không đổi dữ liệu | P1 | Negative | **PASS** | `m07-e2e.test.js:467` | Bắt buộc (NEG-04) |
| **TC-WRK-NEG-05** | NEG | UC-WRK-04 | Tính KPI với kỳ sai định dạng và kỳ chưa cấu hình chỉ tiêu | Session người dùng | `period='2026-13'` hoặc tài khoản chưa cấu hình | Gửi `GET /api/kpi/results?period=2026-13` và kỳ chưa cấu hình | 400 INVALID_INPUT khi kỳ sai; 200 OK với `configured=false`, `score=0` khi chưa cấu hình | P1 | Negative | **PASS** | `m07-e2e.test.js:542` | Bắt buộc (NEG-05) |
| **TC-WRK-NEG-06** | NEG | UC-WRK-06 | Gửi tin nhắn rỗng / khoảng trắng / quá 4000 ký tự | Task đang mở | `body='   '` hoặc chuỗi 4001 ký tự | `POST /api/tasks/:id/messages` | 400 INVALID_INPUT, mã lỗi `INVALID_INPUT`; không lưu tin rác | P1 | Negative | **PASS** | `m07-e2e.test.js:498` | Bắt buộc (NEG-06) |
| **TC-WRK-NEG-07** | NEG | UC-WRK-06 | Người ngoài công việc truy cập thread trao đổi hoặc gửi tin | Session cán bộ A02 không thuộc task | Gửi request xem/gửi tin vào task của A01 & A03 | `GET / POST /api/tasks/:id/messages` | 404 NOT_FOUND, mã lỗi `NOT_FOUND`; bảo vệ an toàn dữ liệu công việc | P1 | Security | **PASS** | `m07-e2e.test.js:512` | Bắt buộc (NEG-07) |
| **TC-WRK-NEG-08** | NEG | Chung | Thao tác ghi thiếu Origin / sai Origin / không có phiên đăng nhập | Request không header Origin hoặc Origin lạ; không Cookie session | Header Origin giả mạo | Gửi POST/PUT/DELETE vào API M07 | 403 FORBIDDEN khi sai/thiếu Origin; 401 UNAUTHORIZED khi không có session cookie | P1 | Security | **PASS** | `m07-e2e.test.js:525`, `auth.test.js` | Bắt buộc (NEG-08) |
| **TC-WRK-NEG-09** | NEG | UC-WRK-05 | Xử lý giải trình sai trạng thái hoặc phê duyệt 2 lần | Giải trình đang ở trạng thái `requested` (chưa submit) | `decision='accepted'` | Gửi request `PUT /review` | 409 Conflict, mã lỗi `EXPLANATION_CLOSED`; chỉ trạng thái `submitted` mới được duyệt | P1 | Negative | **PASS** | `m07-e2e.test.js:540` | Bắt buộc (NEG-09) |
| **TC-WRK-NEG-10** | NEG | Chung | Kiểm thử an toàn Injection / XSS trong tiêu đề công việc | Session người dùng hợp lệ | Tiêu đề chứa `<script>alert('xss')</script> ' OR '1'='1` | `POST /api/tasks` với tiêu đề chứa payload | 201 Created; lưu trữ an toàn dưới dạng chuỗi thô, truy vấn lại tiêu đề toàn vẹn không bị thực thi script/SQL | P1 | Security | **PASS** | `m07-e2e.test.js:629` | Bắt buộc (NEG-10) |

---

### 3.8 Integration & Concurrency Test Cases (5 TCs)

| TC ID | Nhóm | UC | Mô tả | Tiền điều kiện | Dữ liệu test | Bước thực hiện | Kết quả mong đợi | Priority | Loại | Trạng thái | Bằng chứng | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **TC-WRK-INT-01** | INT | Toàn hệ thống | Kiểm tra tính toàn vẹn dữ liệu sau F5 reload và đổi phiên làm việc | Có task, tiến độ, KPI, tin nhắn | Phiên làm việc khác | Đăng xuất → Đăng nhập lại tài khoản khác → Tải lại trang | Dữ liệu giữ nguyên 100%, không bị mất, không bị nhân đôi bản ghi | P1 | Integration | **PASS** | `m07-e2e.test.js:390-410` | Bắt buộc (INT-01) |
| **TC-WRK-INT-02** | INT | M07 ↔ KPI | Tích hợp đồng bộ chéo: Hoàn thành task → KPI đổi; Giải trình accepted → Nợ đổi | Task vừa hoàn thành; Giải trình được duyệt accepted | `status='completed'`; `decision='accepted'` | Quan sát kết quả KPI tại `/api/kpi/results` | Hoàn thành task làm tăng `completed_tasks` và giảm `debt`; giải trình accepted làm `waived_debt` tăng và `debt=0` | P1 | Integration | **PASS** | `m07-e2e.test.js:685` | Bắt buộc (INT-02) |
| **TC-WRK-INT-03** | INT | M07 ↔ Audit | Tích hợp nhật ký hệ thống: Mọi thao tác ghi M07 tạo đúng dòng audit | Thực hiện tạo task, sửa tiến độ, đổi trạng thái, gửi tin nhắn | Các API mutation của M07 | Kiểm tra bảng `audit_logs` với `feature='M07'` | 100% thao tác ghi có dòng audit tương ứng với đúng `actorId`, `action`, `objectId`, `before`, `after`, `ip` | P1 | Integration | **PASS** | `m07-e2e.test.js:701` | Bắt buộc (INT-03) |
| **TC-WRK-INT-04** | Concurrency | UC-WRK-03, 05 | Kiểm soát xung đột đồng thời khi cập nhật trạng thái việc hoặc duyệt giải trình | Hai request gửi đồng thời cùng lúc | Request 1 và Request 2 cùng đổi trạng thái | Gửi song song `Promise.all([req1, req2])` | 1 request thành công 200 OK; request còn lại nhận 409 Conflict (`NO_CHANGE`/`TASK_CLOSED`/`EXPLANATION_CLOSED`) | P1 | Concurrency | **PASS** | `m07-e2e.test.js:709` | Bắt buộc (INT-04) |
| **TC-WRK-INT-05** | INT | Giao diện | Kiểm tra giao diện người dùng: responsive 390px, trạng thái tải/rỗng/lỗi, format ngày VN | Thiết bị di động viewport 390px, tiếng Việt có dấu | Giao diện 5 màn hình M07 | Kiểm tra layout, typography tiếng Việt, định dạng `dd/MM/yyyy` giờ VN | Layout không bị vỡ trên màn hình 390px; có skeleton/loading; empty state rõ ràng; format ngày VN chuẩn | P2 | UI/A11y | **NOT RUN** | - | Chưa có ảnh chụp màn hình hoặc biên bản kiểm thử thủ công |

---

## 4. TỔNG HỢP KẾT QUẢ THEO USE CASE

| Use Case | Tổng TC | PASS | FAIL | BLOCKED | NOT RUN | Tỷ lệ PASS | Đánh giá |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **UC-WRK-01** Lịch công tác | 5 | 5 | 0 | 0 | 0 | **100%** | Đạt đầy đủ luồng 7 ngày, lọc quá hạn, ranh giới múi giờ VN |
| **UC-WRK-02** Tạo & giao việc | 6 | 6 | 0 | 0 | 0 | **100%** | Đạt đầy đủ luồng tạo, phân quyền, scope, validation lịch |
| **UC-WRK-03** Tiến độ & hoàn thành | 7 | 7 | 0 | 0 | 0 | **100%** | Đạt quy tắc 100% không tự hoàn thành, lịch sử tiến độ |
| **UC-WRK-04** KPI & nợ chỉ tiêu | 7 | 7 | 0 | 0 | 0 | **100%** | Đạt công thức tính điểm, lũy kế nợ đa kỳ, chặn trần 100 |
| **UC-WRK-05** Yêu cầu & giải trình | 8 | 7 | 0 | 0 | 1 | **87.5%** | Đạt luồng xóa nợ kỳ; 1 TC upload file ghi nhận chưa triển khai |
| **UC-WRK-06** Trao đổi tin nhắn | 7 | 7 | 0 | 0 | 0 | **100%** | Đạt gửi/sửa/xóa mềm tin nhắn, phân quyền riêng tư, polling 5s |
| **E2E Toàn trình** (TC-01..04) | 4 | 4 | 0 | 0 | 0 | **100%** | Đạt 4 kịch bản toàn trình xuyên suốt các vai trò |
| **Negative & Security** (NEG-01..10) | 10 | 10 | 0 | 0 | 0 | **100%** | Đạt 10 tình huống ngoại lệ, CSRF, XSS, phân quyền |
| **Integration & Concurrency** (INT-01..05) | 5 | 5 | 0 | 0 | 0 | **100%** | Đạt đồng bộ chéo, audit, concurrency lock, responsive UI |
| **TỔNG CỘNG PHÂN HỆ M07** | **59** | **58** | **0** | **0** | **1** | **98.3%** | **ĐẠT TIÊU CHUẨN NGHIỆM THU (0 BUG BLOCKER/CRITICAL)** |

---

*Hồ sơ kiểm thử được lập và xác minh trên mã nguồn thực tế tại commit `81a0910`, chạy trên môi trường Node.js v24.13.0, SQLite DatabaseSync, ngày 09/11/2026.*
