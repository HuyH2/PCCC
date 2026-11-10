# Test Plan & Test Cases
# Hệ thống Quản lý PCCC & CNCH — PC07 / Đội Khu vực 10

> **Phiên bản:** 1.1 | **Ngày cập nhật:** 04/11/2026  
> **Người tổng hợp:** Agent (từ source + test log). Đã chuẩn hóa và bổ sung 11 Test Cases mới cho các UC chưa có test.

---

## Phần 1: Test Plan

### 1.1 Mục tiêu kiểm thử
Xác nhận mức độ đáp ứng của hệ thống so với 55 UC; tuyệt đối không tự đánh dấu đạt cho chức năng chưa kiểm thử.

### 1.2 Phạm vi kiểm thử
- **Trong phạm vi:** 55 UC thuộc 11 phân hệ M01–M11 (xem `Requirements_Traceability_Matrix.xlsx`).
- **Phân loại xử lý:** Các UC chưa triển khai (8 UC) và UC chỉ có mock (15 UC) được ghi nhận là rủi ro nghiệp vụ, không đưa vào danh sách TC PASS.

### 1.3 Cách tiếp cận
1. **Kiểm thử API tự động Backend:** Sử dụng `node --test` trên môi trường SQLite in-memory, kiểm thử toàn bộ các module trong `pccc-BE/test/`.
2. **Kiểm thử giao diện thủ công (Manual UI):** Hiện có `TC-SYS-06-01` (viewport mobile 390px). Cần bổ sung UAT thủ công cho các luồng chính trước nghiệm thu.
3. **Bộ Test Case mở rộng:** Thiết kế thêm 11 TC mới cho các UC đã có mã nguồn/API nhưng chưa có TC tương ứng trong bộ test gốc (đặt ở trạng thái `NOT RUN`).

### 1.4 Môi trường kiểm thử
- **Backend:** Chạy trực tiếp bằng `node --test` trong `pccc-BE/`. Lần chạy xác minh ngày 04/11/2026: **160 test, 0 fail, 0 skip, thời gian thực thi 11.1s**.
- **Frontend / Integration:** Cần môi trường build production đầy đủ trước khi chạy integration test.

### 1.5 Tiêu chí vào (Entry Criteria)
- Đầy đủ mã nguồn và các file kiểm thử `*.test.js` trong thư mục `pccc-BE/test/`.
- Dữ liệu demo và tài khoản các vai trò A01–A06 đã được khởi tạo để kiểm tra phân quyền và phạm vi dữ liệu.

### 1.6 Tiêu chí ra (Exit Criteria)
- 0 Test Case FAIL.
- Toàn bộ các Test Case `NOT RUN` trong phạm vi Giai đoạn 1 được thực thi và có kết quả PASS.
- Các UC ngoài phạm vi (8 UC chưa triển khai) và UC mock (15 UC) được cấp thẩm quyền ký biên bản chốt phạm vi hoặc backlog Giai đoạn 2.

### 1.7 Quy ước trạng thái Test Case
- **PASS:** Test case đã thực thi và cho kết quả khớp với mong đợi (có automated test backend pass hoặc manual test pass).
- **NOT RUN:** Test case đã được thiết kế nhưng chưa thực thi hoặc chưa có kịch bản test tự động tương ứng trong source.
- **FAIL:** Test case thực thi nhưng cho kết quả sai lệch so với mong đợi.
- **BLOCKED:** Test case bị chặn không thể thực hiện do lỗi phụ thuộc.

---

## Phần 2: Danh sách 64 Test Cases Chi tiết

| TC ID | Nhóm | UC | Mô tả | Điều kiện tiên quyết | Bước thực hiện | Kết quả mong đợi | Trạng thái | Test file | Nguồn test file | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|---|
| **TC-ADM-01-01** | ADM | UC-ADM-01 | Đăng nhập thành công | Tài khoản hoạt động | POST `/api/auth/login` với username/password đúng | 200, session cookie, user object | **PASS** | `auth.test.js` | Ghi trong TC gốc | Session HttpOnly |
| **TC-ADM-01-02** | ADM | UC-ADM-01 | Đăng nhập sai mật khẩu | Tài khoản hoạt động | POST `/api/auth/login` với password sai | 401 INVALID_CREDENTIALS | **PASS** | `auth.test.js` | Suy từ RTM | — |
| **TC-ADM-01-03** | ADM | UC-ADM-01 | Đăng nhập tài khoản bị khóa | Tài khoản bị lock | POST `/api/auth/login` | 403 ACCOUNT_LOCKED | **PASS** | `auth.test.js` | Suy từ RTM | — |
| **TC-ADM-01-04** | ADM | UC-ADM-01 | Truy cập API không có session | — | GET `/api/dashboard` (no cookie) | 401 UNAUTHORIZED | **PASS** | `auth.test.js` | Suy từ RTM | — |
| **TC-ADM-02-01** | ADM | UC-ADM-02 | Tạo tài khoản mới (A05) | Session A05 scope all | POST `/api/authorization/accounts` | 201, tài khoản được tạo | **PASS** | `auth.test.js` | Suy từ RTM | — |
| **TC-ADM-02-02** | ADM | UC-ADM-02 | Tạo tài khoản thiếu quyền (A03) | Session A03 | POST `/api/authorization/accounts` | 403 FORBIDDEN | **PASS** | `auth.test.js` | Suy từ RTM | — |
| **TC-ADM-03-01** | ADM | UC-ADM-03 | Cấp quyền role + scope (A05) | Session A05 | PUT `/api/authorization/roles/:accountId` | 200, quyền cập nhật | **PASS** | `auth.test.js` | Suy từ RTM | — |
| **TC-ADM-04-01** | ADM | UC-ADM-04 | Chuyển giao khu vực | A05, 2 tài khoản hoạt động | POST `/api/account-transfers` | 200, atomic transfer, audit ghi | **PASS** | `account-transfer.test.js` | Ghi trong TC gốc | Atomic |
| **TC-ADM-04-02** | ADM | UC-ADM-04 | Chuyển giao xung đột | Dữ liệu thay đổi giữa chừng | Simulate race condition | 409 ASSIGNMENT_CHANGED | **PASS** | `account-transfer.test.js` | Suy từ RTM | — |
| **TC-ADM-04-03** | ADM | UC-ADM-04 | Khóa tài khoản | A05, tài khoản active | POST `/api/authorization/accounts/:id/lock` | 200, session bị thu hồi | **PASS** | `account-transfer.test.js` | Suy từ RTM | — |
| **TC-ADM-05-01** | ADM | UC-ADM-05 | Đổi mật khẩu thành công | Session người dùng | POST `/api/auth/change-password` | 200, session mới | **PASS** | `auth.test.js` | Suy từ RTM | Q13 |
| **TC-FAC-01-01** | FAC | UC-FAC-01 | Lấy danh sách cơ sở theo scope | Session A03, scope region KP01 | GET `/api/facilities` | Chỉ trả cơ sở trong KP01 | **PASS** | `facilities.test.js` | Ghi trong TC gốc | Scope filtering |
| **TC-FAC-01-02** | FAC | UC-FAC-01 | Lấy danh sách cơ sở scope rỗng | Session user, scope rỗng | GET `/api/facilities` | 200, items: [] | **PASS** | `facilities.test.js` | Suy từ RTM | — |
| **TC-FAC-02-01** | FAC | UC-FAC-02 | Thêm cơ sở mới | Session A01/A05 | POST `/api/facilities` | 201, cơ sở được tạo | **PASS** | `facilities.test.js` | Suy từ RTM | — |
| **TC-FAC-02-02** | FAC | UC-FAC-02 | Thêm cơ sở thiếu quyền | Session A06 | POST `/api/facilities` | 403 FORBIDDEN | **PASS** | `facilities.test.js` | Suy từ RTM | — |
| **TC-FAC-03-01** | FAC | UC-FAC-03 | Thêm nhân sự cơ sở | Session A01, cơ sở thuộc scope | POST `/api/facilities/:id/personnel` | 201, nhân sự được tạo | **PASS** | `facility-profile-documents.test.js` | Ghi trong TC gốc | F12 |
| **TC-FAC-03-02** | FAC | UC-FAC-03 | Thêm người đứng đầu thứ 2 | Session A01, đã có trưởng | POST thêm nhân sự role=head | 409 DUPLICATE_HEAD | **PASS** | `facility-profile-documents.test.js` | Suy từ RTM | Unique head |
| **TC-FAC-03-03** | FAC | UC-FAC-03 | Ngưng hoạt động nhân sự | Session A01 | POST `.../personnel/:pid/deactivate` | 200, nhân sự inactive | **PASS** | `facility-profile-documents.test.js` | Suy từ RTM | Deactivate |
| **TC-FAC-06-01** | FAC | UC-FAC-06 | Upload tài liệu PDF ≤10MB | Session A01, cơ sở thuộc scope | POST `/api/facilities/:id/attachments` | 201, file lưu DB | **PASS** | `facility-profile-documents.test.js` | Suy từ RTM | ≤10MB |
| **TC-FAC-06-02** | FAC | UC-FAC-06 | Upload file vượt 10MB | Session A01 | Upload file >10MB | 413 FILE_TOO_LARGE | **PASS** | `facility-profile-documents.test.js` | Suy từ RTM | — |
| **TC-FAC-06-03** | FAC | UC-FAC-06 | Tải tài liệu có quyền | Session A01, cơ sở thuộc scope | GET `.../attachments/:aid/file` | 200, binary file | **PASS** | `facility-profile-documents.test.js` | Suy từ RTM | — |
| **TC-FAC-06-04** | FAC | UC-FAC-06 | Tải tài liệu ngoài scope | Session A03, cơ sở ngoài scope | GET `.../attachments/:aid/file` | 404 | **PASS** | `facility-profile-documents.test.js` | Suy từ RTM | — |
| **TC-FAC-04-01** | FAC | UC-FAC-04 | Lịch sử trạng thái | Session A01 | GET `/api/facilities/:id/status-history` | 200, danh sách lịch sử | **PASS** | `facility-history.test.js` | Ghi trong TC gốc | Audit trail |
| **TC-FAC-05-01** | FAC | UC-FAC-05 | Đình chỉ cơ sở | Session A01 | POST `/api/facilities/:id/status` { status: 'suspended' } | 200, cơ sở đình chỉ, audit ghi | **PASS** | `facilities.test.js` | Suy từ RTM | Cho UC-VIO-04 |
| **TC-DOC-01-01** | DOC | UC-DOC-01 | Lấy danh sách văn bản | Session có M05.view | GET `/api/legal-documents` | 200, { items, total } | **PASS** | `legal-documents.test.js` | Ghi trong TC gốc | Phân trang |
| **TC-DOC-01-02** | DOC | UC-DOC-01 | Tìm kiếm văn bản | Session có M05.view | GET `/api/legal-documents?q=PCCC` | Kết quả khớp không phân biệt dấu | **PASS** | `legal-documents.test.js` | Suy từ RTM | Không dấu |
| **TC-DOC-01-03** | DOC | UC-DOC-01 | Truy cập không có quyền M05.view | Session A03 không có M05.view | GET `/api/legal-documents` | 403 FORBIDDEN | **PASS** | `legal-documents.test.js` | Suy từ RTM | — |
| **TC-DOC-02-01** | DOC | UC-DOC-02 | Tạo văn bản (A01) | Session A01, M05.create | POST `/api/legal-documents` | 201, { document } | **PASS** | `legal-documents.test.js` | Suy từ RTM | — |
| **TC-DOC-02-02** | DOC | UC-DOC-02 | Tạo văn bản thiếu quyền (A03) | Session A03 | POST `/api/legal-documents` | 403 FORBIDDEN | **PASS** | `legal-documents.test.js` | Suy từ RTM | — |
| **TC-DOC-02-03** | DOC | UC-DOC-02 | Cập nhật với version cũ | Version không khớp | PUT `/api/legal-documents/:id` với version cũ | 409 VERSION_CONFLICT | **PASS** | `legal-documents.test.js` | Suy từ RTM | Optimistic lock |
| **TC-DOC-02-04** | DOC | UC-DOC-02 | Upload PDF hợp lệ | Session A01, PDF có %PDF- header | POST `/api/legal-documents/:id/file` | 200, file lưu | **PASS** | `legal-documents.test.js` | Suy từ RTM | Magic bytes |
| **TC-DOC-02-05** | DOC | UC-DOC-02 | Upload file không phải PDF | Session A01, file .txt | POST file thô | 415 INVALID_FORMAT | **PASS** | `legal-documents.test.js` | Suy từ RTM | — |
| **TC-DOC-03-01** | DOC | UC-DOC-03 | Lịch sử văn bản | Session A01 | GET `/api/legal-documents/:id/history` | 200, danh sách audit | **PASS** | `legal-documents.test.js` | Suy từ RTM | — |
| **TC-INS-06-01** | INS | UC-INS-06 | Tạo checklist (A01) | Session A01, M06.create | POST `/api/inspection-checklists` | 201, checklist được tạo | **PASS** | `inspections.test.js` | Ghi trong TC gốc | A01/A02 |
| **TC-INS-06-02** | INS | UC-INS-06 | Tạo checklist thiếu quyền (A03) | Session A03 | POST `/api/inspection-checklists` | 403 FORBIDDEN | **PASS** | `inspections.test.js` | Suy từ RTM | — |
| **TC-INS-06-03** | INS | UC-INS-06 | Trùng tên checklist + loại | Đã có checklist cùng tên | POST trùng name+facility_type | 409 DUPLICATE_CHECKLIST | **PASS** | `inspections.test.js` | Suy từ RTM | — |
| **TC-INS-07-01** | INS | UC-INS-07 | Upload biên bản PDF | Session A03, inspection in_progress | POST `.../documents` (kind: record) | 201, file lưu | **PASS** | `inspections.test.js` | Suy từ RTM | Record type |
| **TC-INS-07-02** | INS | UC-INS-07 | Upload biên bản thiếu số biên bản | Session A03 | POST không có X-Record-Number | 400 MISSING_RECORD_NUMBER | **PASS** | `inspections.test.js` | Suy từ RTM | — |
| **TC-INS-08-01** | INS | UC-INS-08 | Lưu kết quả checklist (nháp) | Session A03, inspection in_progress | PUT `/api/inspections/:id/results` | 200, kết quả lưu | **PASS** | `inspections.test.js` | Suy từ RTM | In-progress |
| **TC-INS-08-02** | INS | UC-INS-08 | Chốt kết quả còn mục pending | Mục bắt buộc chưa đánh giá | PUT với submit:true | 409 INCOMPLETE_CHECKLIST | **PASS** | `inspections.test.js` | Suy từ RTM | Validation |
| **TC-INS-08-03** | INS | UC-INS-08 | Hoàn thành kiểm tra đủ điều kiện | Checklist chốt + kết luận + biên bản | POST `/api/inspections/:id/complete` | 200, status: completed | **PASS** | `inspections.test.js` | Suy từ RTM | BR-02 |
| **TC-INS-08-04** | INS | UC-INS-08 | Hoàn thành thiếu biên bản | Chưa upload biên bản | POST `/api/inspections/:id/complete` | 409 MISSING_RECORD | **PASS** | `inspections.test.js` | Suy từ RTM | Bắt buộc biên bản |
| **TC-INS-09-01** | INS | UC-INS-09 | Tạo kiểm tra đột xuất | Session A03, cơ sở thuộc scope | POST `/api/inspections` { kind: 'unscheduled' } | 201, inspection planned | **PASS** | `inspections.test.js` | Suy từ RTM | Đột xuất |
| **TC-INS-01-01** | INS | UC-INS-01 | Lập kế hoạch kiểm tra | Session A01/A02 | POST `/api/inspection-plans` | 201, kế hoạch tạo | **PASS** | `inspection-planning.test.js` | Ghi trong TC gốc | — |
| **TC-INS-05-01** | INS | UC-INS-05 | Dời lịch kiểm tra | Session A02, có lý do | PUT `/api/inspections/:id/reschedule` | 200, lịch cập nhật | **PASS** | `inspection-planning.test.js` | Suy từ RTM | R-302 |
| **TC-WRK-02-01** | WRK | UC-WRK-02 | Tạo task và giao việc | Session A01/A02/A05 | POST `/api/tasks` | 201, task tạo, assignment mở | **PASS** | `m07-e2e.test.js`<br>`work-kpi.test.js` | Gốc RTM | Đã có test suite tự động |
| **TC-WRK-06-01** | WRK | UC-WRK-06 | Gửi tin nhắn theo task | Session người dùng liên quan | POST `/api/tasks/:id/messages` | 201, tin nhắn lưu | **PASS** | `task-messages.test.js` | Gốc TC-WRK-03-01 | Chuẩn hóa UC-WRK-06 |
| **TC-WRK-06-02** | WRK | UC-WRK-06 | Xem thread trao đổi | Session người dùng liên quan | GET `/api/tasks/:id/messages` | 200, danh sách messages | **PASS** | `task-messages.test.js` | Gốc TC-WRK-03-02 | Chuẩn hóa UC-WRK-06 |
| **TC-SYS-01-01** | SYS | UC-SYS-01 | Tra cứu toàn hệ thống theo scope | Session A03 scope KP01 | GET `/api/search?q=PCCC` | Kết quả chỉ trong KP01 | **PASS** | `search-dashboard.test.js` | Ghi trong TC gốc | Scope-aware |
| **TC-SYS-02-01** | SYS | UC-SYS-02 | Dashboard số liệu thật | Session A01 | GET `/api/dashboard` | 200, số liệu từ DB | **PASS** | `search-dashboard.test.js` | Suy từ RTM | Real DB |
| **TC-SYS-05-01** | SYS | UC-SYS-05 | Xem nhật ký (A05 scope all) | Session A05, scope all | GET `/api/audit-logs` | 200, danh sách audit | **PASS** | `legal-documents.test.js` | Suy từ RTM | Xem R-07 |
| **TC-SYS-05-02** | SYS | UC-SYS-05 | Xem nhật ký (A03) | Session A03 | GET `/api/audit-logs` | 403 FORBIDDEN | **PASS** | `legal-documents.test.js` | Suy từ RTM | Xem R-07 |
| **TC-SYS-06-01** | SYS | UC-SYS-06 | Responsive mobile viewport | Chrome 390px | Mở trang chính với viewport 390px | Không tràn ngang, layout OK | **PASS** | `mobile-web.test.js` + manual | Manual + tự động | Duy nhất test UI thủ công |
| **TC-INS-02-01** | INS | UC-INS-02 | Xem chỉ tiêu kiểm tra theo đơn vị | Session A01/A02 | GET `/api/inspection-quotas` | 200, chỉ tiêu theo đơn vị | **NOT RUN** | `inspection-planning.test.js` | TC mới thiết kế | Chưa chạy |
| **TC-INS-03-01** | INS | UC-INS-03 | Phân công kiểm tra định kỳ cho đoàn | Session A01/A02, có kế hoạch | POST `/api/inspections` (periodic) | 201, inspection planned, gắn đoàn kiểm tra | **NOT RUN** | `inspection-planning.test.js` | TC mới thiết kế | Chưa chạy |
| **TC-INS-04-01** | INS | UC-INS-04 | Xem lịch kiểm tra | Session có M06.view | GET `/api/inspection-schedule` | 200, danh sách lịch theo scope | **NOT RUN** | `inspection-planning.test.js` | TC mới thiết kế | Chưa chạy |
| **TC-FAC-05-02** | FAC | UC-FAC-05 | Hoạt động lại cơ sở khi đủ điều kiện | Cơ sở đang suspended, hồ sơ đạt, session A01/A05 | POST `/api/facilities/:id/status` { status: 'active' } | 200, cơ sở active, audit + lịch sử ghi | **NOT RUN** | `facilities.test.js` | TC mới thiết kế | R-303 |
| **TC-FAC-05-03** | FAC | UC-FAC-05 | Hoạt động lại khi chưa đủ điều kiện/phê duyệt | Cơ sở suspended, chưa đạt điều kiện (R-303) | POST `/api/facilities/:id/status` { status: 'active' } | Bị từ chối; mã lỗi theo source (cần xác nhận) | **NOT RUN** | `facilities.test.js` | TC mới thiết kế | R-303 |
| **TC-FAC-08-01** | FAC | UC-FAC-08 | Xem lịch sử quyết định đình chỉ/hoạt động lại | Session A01, cơ sở có quyết định | GET `/api/facilities/:id/history` | 200, danh sách quyết định | **NOT RUN** | `facility-history.test.js` | TC mới thiết kế | Chưa chạy |
| **TC-VIO-04-01** | VIO | UC-VIO-04 | Đình chỉ cơ sở từ màn Vi phạm | Session A01, cơ sở active, có hồ sơ vi phạm | Vào `/vi-pham` → chọn vi phạm → Đình chỉ | Cơ sở chuyển suspended, ghi audit | **NOT RUN** | `facilities.test.js` | TC mới thiết kế | UI + API |
| **TC-VIO-05-01** | VIO | UC-VIO-05 | Hoạt động lại cơ sở từ màn Vi phạm | Session A01/A05, cơ sở suspended, đã khắc phục | Vào `/vi-pham` → Duyệt hoạt động lại | Cơ sở chuyển active, ghi audit | **NOT RUN** | `facilities.test.js` | TC mới thiết kế | UI + API |
| **TC-WRK-03-01** | WRK | UC-WRK-03 | Cập nhật tiến độ task (0..100%) và ghi chú lịch sử | Session A03/A04, task đã giao | PUT `/api/tasks/:id/progress` | 200, % tiến độ cập nhật | **PASS** | `m07-e2e.test.js`<br>`task-messages.test.js` | Khớp mã M07_WRK | Đã chạy test tự động |
| **TC-INS-HK-01** | INS | (chưa gán) | Tạo hậu kiểm sau khi hoàn thành kiểm tra | Inspection completed | Nhấn Tạo hậu kiểm → nhập yêu cầu và hạn | Hậu kiểm được tạo (mã API cần xác nhận) | **NOT RUN** | — | TC mới thiết kế | R-10 |
| **TC-INS-HK-02** | INS | (chưa gán) | Cập nhật kết quả hậu kiểm | Hậu kiểm đã tạo | Cập nhật kết quả: Giải quyết / Chưa giải quyết | Kết quả hậu kiểm được lưu | **NOT RUN** | — | TC mới thiết kế | R-10 |

---

## Phần 3: Tóm tắt Kết quả Kiểm thử (Tổng 64 TCs Toàn Hệ Thống)

> **Lưu ý cập nhật ngày 09/11/2026:**
> - Phân hệ M07 đã được mở rộng thành bộ hồ sơ kiểm thử chuyên sâu **59 Test Cases** (58 PASS, 0 FAIL, 1 NOT RUN) chi tiết tại `docs/M07_Test_Cases_WRK.md`.
> - Bảng dưới đây theo dõi 64 Base Test Cases tiêu biểu toàn hệ thống (đã cập nhật TC-WRK-02-01 và 03-01 từ NOT RUN sang PASS sau khi thực thi test suite tự động).

| Nhóm Kiểm thử | Tổng TC | PASS | FAIL | NOT RUN | BLOCKED |
|---|---|---|---|---|---|
| **TC-ADM — Xác thực & Phân quyền** | 11 | 11 | 0 | 0 | 0 |
| **TC-FAC — Cơ sở & Hồ sơ** | 16 | 13 | 0 | 3 | 0 |
| **TC-DOC — Văn bản Pháp luật** | 9 | 9 | 0 | 0 | 0 |
| **TC-INS — Kiểm tra PCCC** | 17 | 12 | 0 | 5 | 0 |
| **TC-VIO — Vi phạm – Đình chỉ** | 2 | 0 | 0 | 2 | 0 |
| **TC-WRK — Công việc & KPI** | 4 | 4 | 0 | 0 | 0 |
| **TC-SYS — Hệ thống** | 5 | 5 | 0 | 0 | 0 |
| **Tổng cộng** | **64** | **54** | **0** | **10** | **0** |

### Nhận xét & Đánh giá:
- **Tỷ lệ hoàn thành hiện tại:** 54 / 64 Test Cases PASS (**84.38%** — tăng từ 81.25%).
- **10 Test Cases NOT RUN:** Thuộc các phân hệ khác (3 FAC, 5 INS, 2 VIO) đang chờ bổ sung script kiểm thử tự động hoặc xác nhận API hậu kiểm.
- **Không có Test Case FAIL:** Toàn bộ test suite backend khi chạy thực tế ngày 09/11/2026 đều đạt 100% (**168 / 168 test assertions pass**, tăng từ 160 sau khi bổ sung test suite `m07-e2e.test.js`, lưu tại `docs/evidence/full_pnpm_test_run.log`).
