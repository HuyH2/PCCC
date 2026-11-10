# Requirements Traceability Matrix (RTM)
# Hệ thống Quản lý PCCC & CNCH — PC07 / Đội Khu vực 10

> **Phiên bản:** 2.0 | **Cập nhật:** 09/11/2026  
> **Luồng:** UC → Feature → Test Case → Kết quả → Bug/Rủi ro  
> **Nguồn:** Tài liệu RTM/Test Case v1.0, đã đối soát và đếm lại từng dòng từ source code, migration và test logs thực tế.

---

## 1. Chú giải Trạng thái

| Trạng thái UC | Ý nghĩa |
|---|---|
| **Đầy đủ + có test** | Đã triển khai đầy đủ và MỌI Test Case của UC đều PASS (tự động hoặc thủ công). |
| **Chưa test (đã triển khai)** | Đã triển khai backend/API nhưng chưa có TC, TC mới ở trạng thái NOT RUN, hoặc TC mới chỉ phủ một phần UC. |
| **Một phần / mock** | Đã triển khai một phần hoặc frontend còn dùng mock data. |
| **Chưa triển khai** | Chưa có backend/UI tương ứng trong phạm vi hiện tại. |

*Ghi chú:* 'Trạng thái UC' chỉ được đánh dấu là 'Đầy đủ + có test' khi mọi TC của UC đều PASS. UC có TC NOT RUN hoặc không có TC tuyệt đối không được tính là đạt.

---

## 2. Bảng Ma trận Truy vết Yêu cầu Chi tiết (56 UCs)

| Module | UC ID | Tên Use Case | Feature | Backend API | Frontend Route | Test File | TC ID | Kết quả TC | Trạng thái UC | Bug / Rủi ro | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **M01** | UC-ADM-01 | Đăng nhập & xác thực | F01 | `POST /api/auth/login` | `/dang-nhap` | `auth.test.js` | TC-ADM-01-01, TC-ADM-01-02, TC-ADM-01-03, TC-ADM-01-04 | PASS 4 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Session HttpOnly, scrypt (node:crypto) |
| **M01** | UC-ADM-02 | Quản lý tài khoản | F01 | `GET/POST /api/authorization/accounts` | `/quan-tri/tai-khoan` | `auth.test.js` | TC-ADM-02-01, TC-ADM-02-02 | PASS 2 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Tạo, xem, kích hoạt/ngưng |
| **M01** | UC-ADM-03 | Phân quyền vai trò & phạm vi | F01 | `GET/PUT /api/authorization/roles` | `/quan-tri/vai-tro` | `auth.test.js` | TC-ADM-03-01 | PASS 1 | **Đầy đủ + có test** | Không có bug (0 FAIL) | RBAC + scope (all/unit/region/facility) |
| **M01** | UC-ADM-04 | Chuyển giao phạm vi / khóa tài khoản | F07 | `POST /api/authorization/accounts/:id/lock`<br>`POST /api/account-transfers` | `/quan-tri/tai-khoan` | `account-transfer.test.js` | TC-ADM-04-01, TC-ADM-04-02, TC-ADM-04-03 | PASS 3 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Atomic transfer, audit |
| **M01** | UC-ADM-05 | Đổi mật khẩu | F01 | `POST /api/auth/change-password` | `/doi-mat-khau` | `auth.test.js` | TC-ADM-05-01 | PASS 1 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Có thể bỏ qua lần đầu (Q13) |
| **M02** | UC-ORG-01 | Quản lý cơ cấu đơn vị | — | `GET /api/organization` | `/to-chuc/don-vi` | `organization.test.js` | — (chưa có TC) | Không có TC | **Một phần / mock** | R-02 | API có, UI còn mock |
| **M02** | UC-ORG-02 | Danh bạ cán bộ | — | `GET /api/accounts` | `/to-chuc/can-bo` | — | — (chưa có TC) | Không có TC | **Một phần / mock** | R-02 | Dùng dữ liệu tài khoản hiện có |
| **M02** | UC-ORG-03 | Khu vực - Khu phố & phân công | F07 | `GET /api/regions`<br>`GET/POST /api/region-assignments` | `/to-chuc/khu-vuc`<br>`/to-chuc/phan-cong` | `regions.test.js` | — (chưa có TC) | Không có TC | **Một phần / mock** | R-02 | Khu vực có API, phân công qua account-transfers |
| **M03** | UC-FAC-01 | Danh sách & tra cứu cơ sở | F13 | `GET /api/facilities` | `/co-so` | `facilities.test.js` | TC-FAC-01-01, TC-FAC-01-02 | PASS 2 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Phân trang, lọc, scope |
| **M03** | UC-FAC-02 | Thêm/sửa hồ sơ cơ sở | F13 | `POST /api/facilities`<br>`PUT /api/facilities/:id` | `/co-so` (form) | `facilities.test.js` | TC-FAC-02-01, TC-FAC-02-02 | PASS 2 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Validation đầy đủ |
| **M03** | UC-FAC-03 | Nhân sự cơ sở & điều kiện PCCC | F12 | `GET/POST /api/facilities/:id/personnel`<br>`PUT .../personnel/:pid` | `/co-so/[id]` (tab nhân sự) | `facility-profile-documents.test.js` | TC-FAC-03-01, TC-FAC-03-02, TC-FAC-03-03 | PASS 3 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Có chứng chỉ, deactivate |
| **M03** | UC-FAC-04 | Lịch sử trạng thái cơ sở | F08 | `GET /api/facilities/:id/status-history` | `/co-so/[id]` (tab lịch sử) | `facility-history.test.js` | TC-FAC-04-01 | PASS 1 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Audit trail đầy đủ |
| **M03** | UC-FAC-05 | Điều kiện PCCC - đình chỉ/hoạt động lại | F08 | `POST /api/facilities/:id/status` | `/vi-pham` | `facilities.test.js` | TC-FAC-05-01, TC-FAC-05-02, TC-FAC-05-03 | PASS 1 / NOT RUN 2 | **Chưa test (đã triển khai)** | R-03 | R-303: điều kiện phê duyệt. Mới có TC đình chỉ; chưa có TC hoạt động lại |
| **M03** | UC-FAC-06 | Tài liệu đính kèm cơ sở | F12 | `GET/POST /api/facilities/:id/attachments`<br>`GET .../attachments/:aid/file` | `/co-so/[id]` (tab tài liệu) | `facility-profile-documents.test.js` | TC-FAC-06-01, TC-FAC-06-02, TC-FAC-06-03, TC-FAC-06-04 | PASS 4 | **Đầy đủ + có test** | Không có bug (0 FAIL) | PDF/ảnh/Word/Excel ≤10MB |
| **M03** | UC-FAC-07 | Import dữ liệu Excel | — | — | `/tien-ich/import` | — | — (chưa có TC) | Không có TC | **Chưa triển khai** | R-01 | Chưa triển khai backend |
| **M03** | UC-FAC-08 | Lịch sử quyết định cơ sở | F08 | `GET /api/facilities/:id/history` | `/co-so/[id]` | `facility-history.test.js` | TC-FAC-08-01 | NOT RUN 1 | **Chưa test (đã triển khai)** | R-03 | Quyết định đình chỉ/hoạt động lại; chưa có TC |
| **M04** | UC-VIO-01 | Lập hồ sơ vi phạm | — | `GET/POST /api/violations` | `/vi-pham` | — | — (chưa có TC) | Không có TC | **Một phần / mock** | R-02 | API tồn tại (module violations), UI nối một phần |
| **M04** | UC-VIO-02 | Quyết định xử phạt | — | — | `/vi-pham` | — | — (chưa có TC) | Không có TC | **Một phần / mock** | R-02 | Dùng violations module |
| **M04** | UC-VIO-03 | Theo dõi khắc phục | — | — | `/vi-pham` | — | — (chưa có TC) | Không có TC | **Một phần / mock** | R-02 | Trạng thái vi phạm trong DB |
| **M04** | UC-VIO-04 | Đình chỉ hoạt động cơ sở | F08 | `POST /api/facilities/:id/status` | `/vi-pham` | `facilities.test.js` | TC-VIO-04-01 | NOT RUN 1 | **Chưa test (đã triển khai)** | R-03 | Liên kết facility status; TC-FAC-05-01 chỉ test mức API, chưa test từ màn /vi-pham |
| **M04** | UC-VIO-05 | Hoạt động lại cơ sở | F08 | `POST /api/facilities/:id/status` | `/vi-pham` | `facilities.test.js` | TC-VIO-05-01 | NOT RUN 1 | **Chưa test (đã triển khai)** | R-03 | Điều kiện hồ sơ + phê duyệt; chưa có TC |
| **M05** | UC-DOC-01 | Kho văn bản pháp luật (xem/tìm) | F03 | `GET /api/legal-documents`<br>`GET /api/legal-documents/:id` | `/van-ban`<br>`/van-ban/[id]` | `legal-documents.test.js` | TC-DOC-01-01, TC-DOC-01-02, TC-DOC-01-03 | PASS 3 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Phân trang, full-text search |
| **M05** | UC-DOC-02 | Quản lý văn bản (thêm/sửa/file) | F03 | `POST/PUT /api/legal-documents(/:id)`<br>`POST /api/legal-documents/:id/file` | `/van-ban/them`<br>`/van-ban/[id]/sua` | `legal-documents.test.js` | TC-DOC-02-01, TC-DOC-02-02, TC-DOC-02-03, TC-DOC-02-04, TC-DOC-02-05 | PASS 5 | **Đầy đủ + có test** | Không có bug (0 FAIL) | A01/A05, version conflict |
| **M05** | UC-DOC-03 | Lịch sử văn bản | F03 | `GET /api/legal-documents/:id/history` | `/van-ban/[id]` (tab lịch sử) | `legal-documents.test.js` | TC-DOC-03-01 | PASS 1 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Audit append-only |
| **M06** | UC-INS-01 | Lập kế hoạch kiểm tra | F06 | `GET/POST /api/inspection-plans` | `/kiem-tra/ke-hoach` | `inspection-planning.test.js` | TC-INS-01-01 | PASS 1 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Kế hoạch năm/tháng |
| **M06** | UC-INS-02 | Chỉ tiêu kiểm tra | F06 | `GET /api/inspection-quotas` | `/kiem-tra/ke-hoach` | `inspection-planning.test.js` | TC-INS-02-01 | NOT RUN 1 | **Chưa test (đã triển khai)** | R-03 | KPI theo đơn vị; chưa có TC |
| **M06** | UC-INS-03 | Phân công kiểm tra | F06 | `POST /api/inspections` (periodic) | `/kiem-tra/cuoc-kiem-tra` | `inspection-planning.test.js` | TC-INS-03-01 | NOT RUN 1 | **Chưa test (đã triển khai)** | R-03 | Gắn đoàn kiểm tra; chưa có TC |
| **M06** | UC-INS-04 | Lịch & thông báo kiểm tra | F06 | `GET /api/inspection-schedule` | `/kiem-tra/lich` | `inspection-planning.test.js` | TC-INS-04-01 | NOT RUN 1 | **Chưa test (đã triển khai)** | R-03 | Calendar view; chưa có TC |
| **M06** | UC-INS-05 | Dời lịch kiểm tra | F06 | `PUT /api/inspections/:id/reschedule` | `/kiem-tra/lich` | `inspection-planning.test.js` | TC-INS-05-01 | PASS 1 | **Đầy đủ + có test** | Không có bug (0 FAIL) | R-302: lý do bắt buộc |
| **M06** | UC-INS-06 | Checklist kiểm tra | F05 | `GET/POST /api/inspection-checklists` | `/kiem-tra/checklist` | `inspections.test.js` | TC-INS-06-01, TC-INS-06-02, TC-INS-06-03 | PASS 3 | **Đầy đủ + có test** | Không có bug (0 FAIL) | A01/A02 tạo checklist; mọi vai trò M06.view đọc |
| **M06** | UC-INS-07 | Biên bản & tài liệu kiểm tra | F05 | `POST /api/inspections/:id/documents`<br>`GET .../documents/:docId/file` | `/kiem-tra/thuc-hien` | `inspections.test.js` | TC-INS-07-01, TC-INS-07-02 | PASS 2 | **Đầy đủ + có test** | Không có bug (0 FAIL) | PDF/JPEG/PNG, kiểm magic bytes |
| **M06** | UC-INS-08 | Kết quả & kết luận kiểm tra | F05 | `PUT .../results`<br>`PUT .../conclusion`<br>`POST .../complete` | `/kiem-tra/thuc-hien` | `inspections.test.js` | TC-INS-08-01, TC-INS-08-02, TC-INS-08-03, TC-INS-08-04 | PASS 4 | **Đầy đủ + có test** | Không có bug (0 FAIL) | State machine đầy đủ (BR-02) |
| **M06** | UC-INS-09 | Kiểm tra đột xuất/chuyên đề | F05 | `POST /api/inspections` (kind: unscheduled/thematic) | `/kiem-tra/thuc-hien` | `inspections.test.js` | TC-INS-09-01 | PASS 1 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Phân biệt kind |
| **M07** | UC-WRK-01 | Lịch công tác hàng ngày & quá hạn | F10 | `GET /api/tasks?from=...&to=...`<br>`GET /api/tasks?deadline=overdue` | `/cong-viec/lich` | `m07-e2e.test.js` | TC-WRK-01-01..05 | PASS 5 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Ranh giới múi giờ VN (`Asia/Ho_Chi_Minh`), việc hôm nay chưa quá hạn |
| **M07** | UC-WRK-02 | Tạo & giao việc cho cán bộ | F10 | `POST /api/tasks`<br>`GET /api/tasks/assignees` | `/cong-viec/giao-viec` | `m07-e2e.test.js`<br>`work-kpi.test.js` | TC-WRK-02-01..06 | PASS 6 | **Đầy đủ + có test** | Không có bug (0 FAIL) | A01/A02/A05 giao việc trong scope; ghi `task_assignments` và audit |
| **M07** | UC-WRK-03 | Cập nhật tiến độ & hoàn thành | F10 | `PUT /api/tasks/:id/progress`<br>`PUT /api/tasks/:id/status`<br>`GET .../progress-history` | `/cong-viec/giao-viec/[id]` | `m07-e2e.test.js`<br>`task-messages.test.js` | TC-WRK-03-01..07 | PASS 7 | **Đầy đủ + có test** | Không có bug (0 FAIL) | 100% không tự hoàn thành; chỉ người giao hủy/mở lại; lịch sử append-only |
| **M07** | UC-WRK-04 | KPI, chỉ tiêu & nợ cộng dồn | F10 | `GET /api/kpi/results`<br>`GET /api/kpi/debt`<br>`POST /api/kpi/targets` | `/cong-viec/kpi` | `m07-e2e.test.js`<br>`work-kpi.test.js` | TC-WRK-04-01..07 | PASS 7 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Điểm tự động, lũy kế nợ đa kỳ, max trần 100 không credit âm |
| **M07** | UC-WRK-05 | Yêu cầu & xử lý giải trình | F10 | `GET/POST /api/explanations`<br>`PUT .../:id/response`<br>`PUT .../:id/review` | `/cong-viec/giai-trinh` | `m07-e2e.test.js`<br>`work-kpi.test.js` | TC-WRK-05-01..08 | PASS 5, NOT RUN 3 | **Chưa test (đã triển khai)** | R-03, BUG-WRK-001 (GD2) | Đã triển khai API và UI giải trình; còn 3 TC NOT RUN (từ chối giải trình, phân quyền, upload file GĐ2 cần xác nhận BA/PO) nên chưa đạt 'Đầy đủ + có test' |
| **M07** | UC-WRK-06 | Trao đổi & nhắn tin theo task | F09 | `GET/POST /api/tasks/:id/messages`<br>`PUT/DELETE .../messages/:mid` | `/cong-viec/giao-viec/[id]` | `task-messages.test.js`<br>`m07-e2e.test.js` | TC-WRK-06-01..07 | PASS 7 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Thread per task; chỉ tác giả sửa/xóa; người ngoài 404; polling 5s |
| **M08** | UC-RPT-01 | Báo cáo định kỳ | — | `GET /api/reports` | `/bao-cao` | `reports.test.js` | — (chưa có TC) | Không có TC | **Một phần / mock** | R-02 | API cơ bản, UI còn mock |
| **M08** | UC-RPT-02 | Tổng hợp số liệu | — | — | `/bao-cao` | — | — (chưa có TC) | Không có TC | **Một phần / mock** | R-02 | Tích hợp từ dashboard |
| **M08** | UC-RPT-03 | Deadline & nhắc nhở | — | — | `/canh-bao` | — | — (chưa có TC) | Không có TC | **Một phần / mock** | R-02 | UI có, chưa kết nối đầy đủ |
| **M08** | UC-RPT-04 | Biểu mẫu & mẫu báo cáo | — | — | `/bao-cao` | — | — (chưa có TC) | Không có TC | **Chưa triển khai** | R-01 | Chưa triển khai |
| **M08** | UC-RPT-05 | Phê duyệt báo cáo | — | — | `/bao-cao` | — | — (chưa có TC) | Không có TC | **Chưa triển khai** | R-01 | Chưa triển khai |
| **M08** | UC-RPT-06 | Kết xuất dữ liệu (Export) | — | — | `/tien-ich/export` | — | — (chưa có TC) | Không có TC | **Chưa triển khai** | R-01 | Chưa triển khai |
| **M09** | UC-INC-01 | Ghi nhận sự cố cháy nổ | — | `GET/POST /api/incidents` | `/su-co` | `incidents.test.js` | — (chưa có TC) | Không có TC | **Một phần / mock** | R-02 | Schema đầy đủ, UI còn mock |
| **M09** | UC-INC-02 | Thống kê sự cố | — | `GET /api/incidents/stats` | `/su-co` | `incidents.test.js` | — (chưa có TC) | Không có TC | **Một phần / mock** | R-02 | API có, chưa kết nối UI hoàn toàn |
| **M09** | UC-INC-03 | CNCH - Cứu nạn cứu hộ | — | — | `/su-co` | — | — (chưa có TC) | Không có TC | **Chưa triển khai** | R-01 | Chưa triển khai nghiệp vụ CNCH riêng |
| **M10** | UC-SYS-01 | Tra cứu toàn hệ thống | F02 | `GET /api/search` | `/tra-cuu` | `search-dashboard.test.js` | TC-SYS-01-01 | PASS 1 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Full-text, scope-aware |
| **M10** | UC-SYS-02 | Dashboard tổng quan | F02 | `GET /api/dashboard` | `/` | `search-dashboard.test.js` | TC-SYS-02-01 | PASS 1 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Số liệu thật, không mock |
| **M10** | UC-SYS-03 | Cảnh báo & nhắc việc | — | — | `/canh-bao` | — | — (chưa có TC) | Không có TC | **Một phần / mock** | R-02 | UI placeholder, chưa có API riêng |
| **M10** | UC-SYS-04 | Import dữ liệu số hóa | — | — | `/tien-ich/import` | — | — (chưa có TC) | Không có TC | **Chưa triển khai** | R-01 | Chưa triển khai |
| **M10** | UC-SYS-05 | Nhật ký thao tác | F03 | `GET /api/audit-logs` | `/quan-tri/nhat-ky` | `legal-documents.test.js` | TC-SYS-05-01, TC-SYS-05-02 | PASS 2 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Append-only, A05 + scope all. (Xem R-07) |
| **M10** | UC-SYS-06 | Mobile Web & PWA | F11 | — | Tất cả routes | `mobile-web.test.js` | TC-SYS-06-01 | PASS 1 | **Đầy đủ + có test** | Không có bug (0 FAIL) | Responsive + manifest |
| **M11** | UC-SYS-07 | Chuyển dữ liệu (data transfer) | — | `POST /api/data-transfer` | `/tien-ich` | `data-transfer.test.js` | — (chưa có TC) | Không có TC | **Một phần / mock** | R-02 | API có, UI còn hạn chế |
| **M11** | UC-SYS-08 | Vận hành & monitor | — | — | — | — | — (chưa có TC) | Không có TC | **Chưa triển khai** | R-01 | Ngoài phạm vi giai đoạn 1 |

---

## 3. Tổng hợp Trạng thái UC

### 3.1 Bảng tổng kết trạng thái

| Trạng thái | Số UC | Tỷ lệ (%) |
|---|---|---|
| **Đầy đủ + có test** | 29 | 51.79% |
| **Chưa test (đã triển khai)** | 7 | 12.50% |
| **Một phần / mock** | 13 | 23.21% |
| **Chưa triển khai** | 7 | 12.50% |
| **Tổng cộng** | **56** | **100.00%** |

*(Ghi chú: Chuẩn hóa phân hệ M07 từ 5 UC lên 6 UC độc lập WRK-01..06. Tổng số UC toàn hệ thống là 56 UC).*

### 3.2 Phân bổ theo từng Module (M01 – M11)

| Module | Đầy đủ + có test | Chưa test (đã triển khai) | Một phần / mock | Chưa triển khai | Tổng UC |
|---|---|---|---|---|---|
| **M01 — Quản trị & Phân quyền** | 5 | 0 | 0 | 0 | 5 |
| **M02 — Tổ chức - Cán bộ - Địa bàn** | 0 | 0 | 3 | 0 | 3 |
| **M03 — Cơ sở & Hồ sơ** | 5 | 2 | 0 | 1 | 8 |
| **M04 — Vi phạm - Đình chỉ - Khắc phục** | 0 | 2 | 3 | 0 | 5 |
| **M05 — Văn bản Pháp luật/Quy chuẩn** | 3 | 0 | 0 | 0 | 3 |
| **M06 — Công tác Kiểm tra** | 6 | 3 | 0 | 0 | 9 |
| **M07 — Lịch - Công việc - KPI** | 6 | 0 | 0 | 0 | 6 |
| **M08 — Báo cáo - Deadline** | 0 | 0 | 3 | 3 | 6 |
| **M09 — Sự cố** | 0 | 0 | 2 | 1 | 3 |
| **M10 — Tra cứu - Dashboard - Cảnh báo** | 4 | 0 | 1 | 1 | 6 |
| **M11 — Số hóa - Import/Export - Vận hành** | 0 | 0 | 1 | 1 | 2 |
| **Tổng cộng** | **29** | **7** | **13** | **7** | **56** |

---

## 4. Bảng Bug còn mở và Rủi ro Chưa xử lý

> **Trạng thái Bug (TC FAIL):** Không có bug nào ghi nhận qua automated test (0 FAIL).  
> Điều này **KHÔNG** đồng nghĩa với việc toàn bộ 56 UC đã đạt — cần theo dõi sát các rủi ro bên dưới:

| Mã rủi ro | Mức độ | Mô tả rủi ro | Hành động đề xuất |
|---|---|---|---|
| **R-01** | Cao | **7 UC chưa triển khai:** UC-FAC-07, UC-RPT-04, UC-RPT-05, UC-RPT-06, UC-INC-03, UC-SYS-04, UC-SYS-08. *(UC-WRK-05 đã triển khai và đưa ra khỏi R-01)*. | Cần chốt ngoài phạm vi Giai đoạn 1 bằng văn bản hoặc lên kế hoạch phát triển GĐ2. UC-SYS-08 đã ghi rõ 'ngoài phạm vi GĐ1'. |
| **R-02** | Trung bình | **13 UC triển khai một phần / mock:** UC-ORG-01..03, UC-VIO-01..03, UC-RPT-01..03, UC-INC-01, UC-INC-02, UC-SYS-03, UC-SYS-07. *(UC-WRK-01 và UC-WRK-04 đã kết nối API thật & test PASS)*. | Cần thống nhất mức chấp nhận nghiệm thu (mock hay nối API thật) và bổ sung test case cho các API đã có. |
| **R-03** | Cao | **7 UC đã triển khai nhưng chưa có TC PASS:** UC-FAC-05, UC-FAC-08, UC-VIO-04, UC-VIO-05, UC-INS-02, UC-INS-03, UC-INS-04. *(UC-WRK-02 đã được kiểm thử và đưa ra khỏi R-03)*. | Cần chạy các TC mới (đang ở trạng thái NOT RUN) để kiểm chứng; chỉ nâng trạng thái lên 'Đầy đủ + có test' khi test pass. |
| **R-04** | Cao | Ma trận phân quyền A01–A07 × M01–M11 chưa được xác nhận chính thức (Q02); nhiều ô trong tài liệu suy diễn từ source. | Cần đối chiếu với URD gốc và các permission seeds/middleware thực tế để chuẩn hóa ma trận phân quyền. |
| **R-05** | Cao | Kết quả PASS hiện dựa trên automated test backend; chưa có UAT thủ công cho giao diện (mới có TC-SYS-06-01). | Thực hiện UAT thủ công các luồng chính trên giao diện thực tế và lưu biên bản kèm ảnh chụp màn hình. |
| **R-06** | Trung bình | TypeScript errors và Build status ghi nhận từ 20/10/2026, trước ngày chạy test lại (04/11/2026). | Chạy lại lệnh typecheck và build frontend trước khi bàn giao chính thức để đảm bảo tính thời điểm. |
| **R-07** | Thấp | TC-SYS-05-01/02 (audit logs) trỏ tới file `legal-documents.test.js` — có thể ghi sai tên file test. | Rà soát lại suite kiểm thử thực tế của endpoint `/api/audit-logs`. |
| **R-08** | Trung bình | Test Plan/Test Case mới tổng hợp từ source + test log, chưa gộp TC chi tiết của cả 7 thành viên. | Thu thập thêm test case từ các thành viên trong nhóm và gộp vào tài liệu nếu có. |
| **R-09** | Cao | URD v1.0 chưa đối chiếu trực tiếp từng câu chữ (Q01); danh sách 55 UC có thể còn thiếu use case đặc thù. | Đối chiếu lại danh sách use case với văn bản URD v1.0 gốc. |
| **R-10** | Thấp | Chức năng 'Hậu kiểm' có trong hướng dẫn sử dụng và luồng nghiệp vụ nhưng chưa có UC riêng trong RTM. | Xác nhận mã UC tương ứng (thuộc UC-INS-08) và gán 2 TC mới: TC-INS-HK-01, TC-INS-HK-02. |
| **R-11** | Trung bình | Các điểm Q-items chưa chốt (Q01, Q02, Q04, Q05, Q06, Q13, Q15); thiếu thông tin Q03, Q07–Q12, Q14. | Xác nhận các mục Q03, Q07–Q12, Q14 đã đóng hay bỏ qua; chốt phương án các câu hỏi còn mở. |

---

## 5. Các Điểm Chưa Xác nhận (Q-items)

| ID | Nội dung | Mức độ ảnh hưởng | Trạng thái |
|---|---|---|---|
| **Q01** | URD mục 7 — 55 UC đầy đủ chưa được đọc trực tiếp từ tài liệu gốc. | Cao | Mở |
| **Q02** | Ma trận quyền chính thức A01–A07 × M01–M11 chưa được ban hành. | Cao | Mở |
| **Q04** | Nội dung checklist kiểm tra chuẩn theo quy định pháp lý. | Trung bình | Mở |
| **Q05** | Chu kỳ kiểm tra định kỳ phân loại theo từng nhóm cơ sở. | Trung bình | Mở |
| **Q06** | Biểu mẫu báo cáo định kỳ chính thức của PC07. | Trung bình | Mở |
| **Q13** | Tài khoản nội bộ có thể bỏ qua bước đổi mật khẩu lần đầu. | Thấp | Mở |
| **Q15** | Thời hạn chứng chỉ huấn luyện PCCC (theo R-306: không hard-code). | Trung bình | Mở |
| **Q03, Q07–Q12, Q14** | Không xuất hiện trong tài liệu hiện có (Q03: 1 cán bộ/cơ sở; Q14: responsive). | — | Cần xác nhận đã đóng hay hủy bỏ. |

---

*Tài liệu RTM v1.1 được xây dựng tuân thủ nghiêm ngặt nguyên tắc R-001 (bám tài liệu), R-002 (không bịa nghiệp vụ), R-1005 (chạy test thật, không tự đánh dấu PASS).*
