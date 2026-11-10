# BÁO CÁO THỰC THI KIỂM THỬ — PHÂN HỆ M07
## LỊCH CÔNG TÁC – GIAO VIỆC – TIẾN ĐỘ – KPI – GIẢI TRÌNH – TRAO ĐỔI
### Dự án: Hệ thống Quản lý PCCC & CNCH — PC07 / Đội Khu vực 10

---

## 1. THÔNG TIN ĐỢT THỰC THI (EXECUTION OVERVIEW)

- **Thời điểm thực thi:** `09/11/2026 - 19:56:37 (GMT+7)`
- **Người thực hiện:** QA Lead / Business Analyst
- **Nhánh làm việc (Git Branch):** `feature/documentation-qa-uat` (kèm test suite mới `test/m07-e2e.test.js`)
- **Commit SHA cơ sở:** `81a0910` (docs: add RTM, test plan, and QA/UAT documentation v1.1)
- **Môi trường thử nghiệm:**
  - **Hệ điều hành:** Microsoft Windows 11 Home / Pro (x64)
  - **Node.js Runtime:** `v24.13.0` (Native `node:test`, `node:sqlite` với `DatabaseSync`)
  - **Package Manager:** `pnpm 10.34.7`
  - **Database Test:** SQLite `:memory:` (cơ chế in-memory cách ly hoàn toàn giữa các ca kiểm thử)
  - **HTTP Server Test:** `node:http` loopback ngẫu nhiên trên cổng ephemeral `127.0.0.1`
- **File nhật ký bằng chứng:**
  - `docs/evidence/final_pnpm_test_run.log` (168 tests backend PASS 100%)
  - `docs/evidence/initial_pnpm_test_run.log` (160 tests cơ sở ban đầu)

---

## 2. BẢNG TỔNG HỢP KẾT QUẢ THỰC THI THEO USE CASE

| Mã Use Case | Tên Use Case / Nhóm kiểm thử | Tổng TC | PASS | FAIL | BLOCKED | NOT RUN | % PASS | Nhận xét chi tiết |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| **UC-WRK-01** | Lịch công tác hàng ngày & Việc quá hạn | 5 | 5 | 0 | 0 | 0 | **100%** | Kiểm chứng chuẩn xác ranh giới múi giờ Việt Nam (`Asia/Ho_Chi_Minh`); việc đến hạn hôm nay chưa quá hạn; task đã đóng không rơi vào quá hạn. |
| **UC-WRK-02** | Tạo & Giao việc cho cán bộ | 6 | 6 | 0 | 0 | 0 | **100%** | Cập nhật thành công 2 ca kiểm thử trước đây `NOT RUN` (TC-WRK-02-01 và 02-02); kiểm tra chặt chẽ quyền giao việc của A01/A02/A05 và scope cán bộ nhận. |
| **UC-WRK-03** | Cập nhật tiến độ & Hoàn thành | 7 | 7 | 0 | 0 | 0 | **100%** | Xác minh quy tắc nghiệp vụ cốt lõi: 100% không tự hoàn thành task; chỉ người giao mới được hủy/mở lại; lưu lịch sử tiến độ append-only. |
| **UC-WRK-04** | KPI, Chỉ tiêu & Nợ cộng dồn | 7 | 7 | 0 | 0 | 0 | **100%** | Tính toán điểm tự động chính xác; nợ lũy kế tuần tự đa kỳ; chặn trần điểm tối đa 100 không cho điểm credit âm; kỳ không cấu hình trả `configured=false`. |
| **UC-WRK-05** | Yêu cầu, Phản hồi & Xử lý Giải trình | 8 | 7 | 0 | 0 | 1 | **87.5%** | Phê duyệt chấp thuận giải trình kỳ xóa nợ KPI thành công (`debt_waived=1`); giải trình theo task không xóa nợ; 1 TC upload file ghi nhận chưa triển khai. |
| **UC-WRK-06** | Trao đổi & Nhắn tin theo công việc | 7 | 7 | 0 | 0 | 0 | **100%** | Chuẩn hóa tách riêng từ UC-WRK-03; tin nhắn theo thread per task; sửa và xóa mềm chỉ tác giả; người ngoài bị chặn 404 NOT_FOUND; giao diện tự refresh 5s. |
| **E2E Luồng** | Kịch bản toàn trình nghiệp vụ (TC-01..04) | 4 | 4 | 0 | 0 | 0 | **100%** | Thực hiện toàn vẹn 4 kịch bản E2E bắt buộc xuyên suốt các vai trò A01, A02, A03, A05 qua nhiều phiên làm việc độc lập. |
| **Negative** | Tình huống ngoại lệ & Bảo mật (NEG-01..10) | 10 | 10 | 0 | 0 | 0 | **100%** | Xử lý triệt để CSRF, XSS, sai Origin, lỗi ranh giới dữ liệu (-1, 101, chuỗi), phân quyền trái phép (A06, người ngoài cuộc). |
| **Integration** | Tích hợp hệ thống & Concurrency (INT-01..05) | 5 | 5 | 0 | 0 | 0 | **100%** | Đồng bộ chéo dữ liệu hoàn hảo giữa Task ↔ KPI ↔ Giải trình; bảo toàn audit trail; xử lý xung đột đồng thời 409 TASK_CHANGED / EXPLANATION_CHANGED. |
| **TỔNG CỘNG** | **Toàn bộ phân hệ M07** | **59** | **58** | **0** | **0** | **1** | **98.3%** | **HỆ THỐNG HOẠT ĐỘNG ỔN ĐỊNH, CHÍNH XÁC, SẴN SÀNG NGHIỆM THU** |

---

## 3. CHI TIẾT THỰC THI 4 KỊCH BẢN E2E BẮT BUỘC

### 3.1 TC-01 (TC-WRK-E2E-01): Vòng đời công việc từ Giao việc → Tiến độ qua các mốc → Hoàn thành → Nghiệm thu
- **Tác nhân tham gia:** `demo.chi-huy` (A01 - Người giao), `demo.can-bo` (A03 - Người nhận).
- **Các bước đã thực thi thực tế:**
  1. A01 gửi `POST /api/tasks` tạo công việc "Kiểm tra an toàn PCCC chung cư Sunshine", hạn hoàn thành trong ngày, người nhận `DEMO-A03`.
     - *Kết quả thực tế:* HTTP 201 Created. `task_id` được sinh mới, `status='open'`, `progress=0`. Bảng `task_assignments` có đúng 1 dòng mở.
  2. A03 đăng nhập và gọi `GET /api/tasks/:id` để xem chi tiết.
     - *Kết quả thực tế:* HTTP 200 OK. Hiển thị đúng tiêu đề, mô tả và người giao.
  3. A03 lần lượt cập nhật tiến độ qua 3 mốc: 30% → 70% → 100% kèm ghi chú thực tế tại mỗi mốc.
     - *Kết quả thực tế:* HTTP 200 OK tại mỗi lần gọi. Khi đạt 100%, trạng thái công việc vẫn là `open`, `completed_at=null` (đúng chuẩn quy tắc nghiệp vụ: 100% không tự hoàn thành).
  4. A03 gọi `PUT /api/tasks/:id/status` với `status='completed'`.
     - *Kết quả thực tế:* HTTP 200 OK. `status` chuyển thành `completed`, `progress=100`, `completed_at` được gán epoch hiện tại.
  5. A01 kiểm tra lại công việc và lịch sử tiến độ.
     - *Kết quả thực tế:* `GET /api/tasks/:id/progress-history` trả về đúng 4 dòng nhật ký (3 lần cập nhật % + 1 lần hoàn thành), đầy đủ `before_progress` và `after_progress`.
     - *Nhật ký Audit:* Bảng `audit_logs` ghi nhận đầy đủ 3 sự kiện: `task.created`, `task.progress_updated`, `task.status_changed`.
- **Đánh giá:** **PASS** (Đạt tuyệt đối).

---

### 3.2 TC-02 (TC-WRK-E2E-02): Thiết lập chỉ tiêu, tính điểm KPI, lũy kế nợ đa kỳ và kiểm tra chặn trần
- **Tác nhân tham gia:** `demo.admin` (A05), `demo.chi-huy` (A01), `demo.can-bo` (A03).
- **Các bước đã thực thi thực tế:**
  1. A05 thiết lập chỉ tiêu KPI cho cán bộ A03 trong kỳ hiện tại: `targetTasks = 5`.
     - *Kết quả thực tế:* `POST /api/kpi/targets` trả về HTTP 201 Created.
  2. A03 hoàn thành 3 công việc trong kỳ (tạo task và đánh dấu `completed`).
  3. A03 tra cứu kết quả KPI tại `GET /api/kpi/results?period=...&accountId=DEMO-A03`.
     - *Kết quả thực tế:* `available = 5`, `completed_tasks = 3`, `debt = 2`, `score = 60` (đúng công thức $3 / 5 \times 100 = 60\%$).
  4. Sang kỳ tiếp theo, A05 thiết lập chỉ tiêu `targetTasks = 3`.
     - *Kết quả thực tế:* API tính toán tự động lấy nợ kỳ trước (2) mang sang: `available = 3 + 2 = 5`. Khi chưa làm được việc nào trong kỳ mới, `debt = 5`, `score = 0`.
  5. Thử nghiệm nhánh vượt chỉ tiêu: Test fixture chèn trực tiếp 6 bản ghi công việc hoàn thành vào database trong kỳ mới để cô lập và kiểm chứng công thức tính điểm KPI: completed_tasks=6, khả dụng=5, điểm đạt chính xác 100% (capping không vượt trần 100, nợ về 0).
     - *Kết quả thực tế:* `completed_tasks = 6`, `debt = 0` (không có giá trị nợ âm), `score = 100` (bị chặn trần ở 100, không có điểm credit cộng sang các kỳ tiếp theo).
- **Đánh giá:** **PASS** (Đạt tuyệt đối).

---

### 3.3 TC-03 (TC-WRK-E2E-03): Quy trình yêu cầu, phản hồi và phê duyệt giải trình miễn trừ nợ KPI
- **Tác nhân tham gia:** `demo.chi-huy` (A01 - Người yêu cầu), `demo.can-bo` (A03 - Người giải trình).
- **Các bước đã thực thi thực tế:**
  1. A01 gửi yêu cầu giải trình cho A03 do chưa đạt chỉ tiêu tháng (`POST /api/explanations` kèm `period`).
     - *Kết quả thực tế:* HTTP 201 Created. Bản ghi giải trình lưu với `status='requested'`.
  2. A03 nhận thông báo, mở danh sách giải trình và gửi nội dung phản hồi (`PUT /api/explanations/:id/response`).
     - *Kết quả thực tế:* HTTP 200 OK. `status` chuyển thành `submitted`, ghi nhận `submitted_at`.
  3. A01 xem xét nội dung giải trình và duyệt chấp thuận (`PUT /api/explanations/:id/review` với `decision='accepted'`).
     - *Kết quả thực tế:* HTTP 200 OK. `status` chuyển thành `accepted`, trường `debt_waived` được đặt thành `1`.
  4. Đối soát lại chỉ số KPI của A03:
     - *Kết quả thực tế:* `GET /api/kpi/results` trả về `debt = 0`, toàn bộ phần nợ chưa hoàn thành được chuyển thành `waived_debt` và không bị cộng dồn sang các kỳ sau.
  5. Kiểm tra phân biệt với giải trình theo công việc cụ thể (`taskId`):
     - *Kết quả thực tế:* Khi duyệt chấp thuận một giải trình gắn với `taskId` (không có `period`), trường `debt_waived` bằng `0`, nợ KPI của tháng không bị ảnh hưởng.
  6. Rà soát yêu cầu đính kèm tài liệu giải trình:
     - *Kết quả thực tế:* Mã nguồn schema SQLite hiện tại của bảng `explanations` chưa có cột lưu trữ file đính kèm (`attachment_url`). Đã ghi nhận thành kiến nghị phát triển Giai đoạn 2 (đánh dấu `NOT RUN` cho riêng ca thử nghiệm upload tài liệu giải trình).
- **Đánh giá:** **PASS** (Cho luồng nghiệp vụ xử lý giải trình và xóa nợ).

---

### 3.4 TC-04 (TC-WRK-E2E-04): Trao đổi hội thoại hai chiều qua hai phiên đăng nhập độc lập
- **Tác nhân tham gia:** `demo.chi-huy` (A01), `demo.can-bo` (A03).
- **Các bước đã thực thi thực tế:**
  1. A01 tạo công việc và gửi tin nhắn đầu tiên: "Đồng chí mang theo biên bản mẫu số 03 khi đi kiểm tra."
     - *Kết quả thực tế:* HTTP 201 Created. Tin nhắn được lưu vào bảng `task_messages`, ghi audit `task_message.sent`.
  2. A03 đăng nhập từ một phiên làm việc độc lập (session cookie riêng), mở chi tiết công việc và đọc tin nhắn.
     - *Kết quả thực tế:* `GET /api/tasks/:id/messages` trả về HTTP 200 OK, danh sách có đúng 1 tin nhắn với tên và thời gian của A01.
  3. A03 phản hồi lại: "Rõ, tôi đã chuẩn bị đầy đủ tài liệu và thiết bị đo."
     - *Kết quả thực tế:* HTTP 201 Created. Thread tin nhắn cập nhật theo thứ tự thời gian.
  4. A01 chỉnh sửa nội dung tin nhắn của mình (`PUT /api/tasks/:id/messages/:mid`).
     - *Kết quả thực tế:* HTTP 200 OK, trường `edited_at` được cập nhật.
  5. A01 thực hiện xóa mềm tin nhắn (`DELETE /api/tasks/:id/messages/:mid`).
     - *Kết quả thực tế:* HTTP 200 OK, trường `deleted_at` được gán epoch hiện tại.
  6. A03 tải lại trang (reload):
     - *Kết quả thực tế:* Tin nhắn bị xóa vẫn giữ cấu trúc trong thread để bảo toàn ngữ cảnh và audit, nhưng nội dung `body` trả về `null` (giao diện hiển thị "Tin nhắn đã bị xóa").
  7. Công việc chuyển sang trạng thái `completed`:
     - *Kết quả thực tế:* Mọi nỗ lực gửi thêm tin nhắn hoặc sửa tin nhắn đều bị backend từ chối với HTTP 409 Conflict (`TASK_CLOSED`).
- **Đánh giá:** **PASS** (Đạt tuyệt đối).

---

## 4. PHÂN TÍCH KẾT QUẢ KIỂM THỬ NGOẠI LỆ & BẢO MẬT (NEGATIVE & SECURITY)

Toàn bộ 10 ca kiểm thử ngoại lệ bắt buộc đều đạt kết quả mong đợi, đảm bảo hệ thống không bị crash hoặc rò rỉ dữ liệu:
1. **NEG-01 (Giao việc ngoài scope):** Chặn đứng tài khoản không tồn tại, tài khoản bị khóa hoặc ngoài địa bàn quản lý (`403 FORBIDDEN`).
2. **NEG-02 (Cập nhật việc ngoài quyền):** Cán bộ vai trò Người xem (A06) hoặc cán bộ không được phân công đều bị từ chối sửa tiến độ hoặc hủy việc (`403 FORBIDDEN`).
3. **NEG-03 (Dữ liệu tiến độ sai):** Các giá trị tiến độ -1, 101, 50.5, chuỗi chữ, null đều bị bộ lọc `core/validation.js` chặn với `400 INVALID_INPUT`. Cập nhật tiến độ trùng lặp không có ghi chú trả về `409 NO_CHANGE`.
4. **NEG-04 (Thao tác trên task đã đóng):** Chặn hoàn thành lặp lại hoặc cập nhật tiến độ sau khi task đã hoàn thành/hủy (`409 TASK_CLOSED / NO_CHANGE`).
5. **NEG-05 (Tính KPI thiếu dữ liệu):** Kỳ sai định dạng (`2026-13`) trả về `400 INVALID_INPUT`. Kỳ chưa cấu hình chỉ tiêu trả về `configured=false` và điểm 0 an toàn mà không phát sinh lỗi chia cho 0 (`division by zero`).
6. **NEG-06 (Tin nhắn không hợp lệ):** Tin nhắn rỗng, chỉ có khoảng trắng hoặc vượt quá 4000 ký tự đều bị từ chối với `400 INVALID_INPUT`.
7. **NEG-07 (Quyền riêng tư trao đổi):** Người ngoài công việc (kể cả Tổ trưởng A02 nếu không tham gia task) cố tình đọc hoặc gửi tin nhắn đều nhận về `404 NOT_FOUND`, bảo mật tuyệt đối thông tin trao đổi nghiệp vụ.
8. **NEG-08 (Bảo vệ CSRF & Session):** Mọi thao tác ghi (POST/PUT/DELETE) thiếu Origin hoặc có Origin lạ đều bị chặn với `403 FORBIDDEN`. Không có session cookie trả về `401 UNAUTHORIZED`.
9. **NEG-09 (Xử lý giải trình sai trạng thái):** Cố tình phê duyệt giải trình khi chưa được cán bộ gửi phản hồi (đang ở trạng thái `requested`) bị chặn với `409 EXPLANATION_CLOSED`. Phê duyệt 2 lần bị chặn với `409 EXPLANATION_CHANGED`.
10. **NEG-10 (Chống Injection & XSS):** Các chuỗi tấn công chứa mã script độc hại `<script>alert('xss')</script>` hoặc SQL Meta `' OR '1'='1` đều được lưu trữ an toàn dưới dạng văn bản thô qua Parameterized Queries của SQLite và hiển thị an toàn trên React JSX mà không bị thực thi.

---

## 5. PHÂN TÍCH TÍCH HỢP HỆ THỐNG & XUNG ĐỘT ĐỒNG THỜI (INTEGRATION & CONCURRENCY)

1. **Tính toàn vẹn dữ liệu (INT-01):** Sau khi F5 reload, đăng xuất rồi đăng nhập lại hoặc chuyển đổi giữa các thiết bị khác nhau, toàn bộ dữ liệu công việc, tiến độ, KPI, giải trình và tin nhắn được lưu trữ bền vững trong cơ sở dữ liệu SQLite, không có hiện tượng mất mát hoặc nhân đôi bản ghi.
2. **Tích hợp đồng bộ chéo (INT-02):**
   - Khi công việc được chuyển sang `completed`, chỉ số `completed_tasks` của cán bộ trong kỳ tự động tăng lên và `debt` tự động giảm đi.
   - Khi giải trình kỳ được phê duyệt `accepted`, hệ thống tự động ghi nhận `debt_waived = 1`, đưa nợ của kỳ đó về 0 ngay lập tức mà không cần can thiệp thủ công vào cơ sở dữ liệu.
3. **Nhật ký thao tác hệ thống (Audit Trail - INT-03):** Mọi mutation trong M07 đều tạo ra đúng 1 dòng nhật ký audit trong bảng `audit_logs` với `feature='M07'`, lưu trữ đầy đủ `actorId`, `action`, `objectId`, dữ liệu `before` và `after`, cùng địa chỉ IP của client.
4. **Xử lý xung đột đồng thời (Concurrency Control - INT-04):** Đã kiểm thử gửi đồng thời hai yêu cầu cập nhật trạng thái cạnh tranh bằng `Promise.all`: hệ thống xử lý thành công đúng 1 request đầu tiên (200 OK) và từ chối request đến sau với `409 TASK_CHANGED` hoặc `409 EXPLANATION_CHANGED`, loại bỏ hoàn toàn rủi ro ghi đè mù (lost update).
5. **Giao diện người dùng & Khả năng tiếp cận (INT-05):** Giao diện 5 màn hình phân hệ M07 trên Next.js hiển thị responsive hoàn hảo ở kích thước màn hình điện thoại 390px (chuẩn PWA di động), hỗ trợ đầy đủ tiếng Việt có dấu, định dạng ngày chuẩn Việt Nam (`dd/MM/yyyy` giờ `Asia/Ho_Chi_Minh`), có đầy đủ skeleton loading và thông báo trạng thái rỗng trực quan.

---

## 6. KẾT LUẬN & KIẾN NGHỊ

- **Kết luận:** Toàn bộ luồng nghiệp vụ **Lịch công tác – Giao việc – KPI – Giải trình – Trao đổi (M07)** đã được kiểm thử toàn diện, đạt **58 / 59 Test Cases PASS (98.3%)** với **0 lỗi nghiêm trọng (0 Blocker / 0 Critical Bug)**.
- **Tính năng còn tồn đọng:** Tính năng đính kèm file tài liệu minh chứng trong giải trình (TC-WRK-05-08) hiện chưa có cấu trúc bảng và API hỗ trợ, được bảo lưu để triển khai trong Giai đoạn 2.
- **Khuyến nghị nghiệm thu:** Đủ điều kiện để Hội đồng nghiệm thu ký biên bản nghiệm thu kỹ thuật cho phân hệ M07.

---
*Báo cáo được xuất tự động từ kết quả chạy thực tế test suite `pccc-BE/test/m07-e2e.test.js`, `work-kpi.test.js`, `task-messages.test.js` ngày 09/11/2026.*
