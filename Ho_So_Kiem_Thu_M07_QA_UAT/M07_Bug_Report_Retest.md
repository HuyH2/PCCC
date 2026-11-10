# BÁO CÁO BUG & KẾT QUẢ RETEST — PHÂN HỆ M07
## LỊCH CÔNG TÁC – GIAO VIỆC – TIẾN ĐỘ – KPI – GIẢI TRÌNH – TRAO ĐỔI
### Dự án: Hệ thống Quản lý PCCC & CNCH — PC07 / Đội Khu vực 10

---

## 1. THỐNG KÊ TỔNG QUAN

- **Căn cứ thực thi:** Đã thực thi **59 Test Cases** (58 PASS, 0 FAIL, 1 NOT RUN do tính năng chưa triển khai).
- **Tổng số lỗi nghiệp vụ nghiêm trọng phát hiện:** **0 Bug Blocker / 0 Bug Critical / 0 Bug Major**.
- **Số điểm sai lệch / tồn đọng được ghi nhận:** **3 vấn đề** (gồm 1 thiếu sót tính năng Giai đoạn 2 và 2 điểm sai lệch tài liệu đã được khắc phục).

| Mức độ nghiêm trọng | Mở (Open / New) | Đã sửa & Retest (Fixed / Closed) | Tổng số |
|---|:---:|:---:|:---:|
| **Blocker (Chặn đứng)** | 0 | 0 | 0 |
| **Critical (Nghiêm trọng)** | 0 | 0 | 0 |
| **Major (Lớn)** | 0 | 0 | 0 |
| **Minor (Nhỏ / Tồn đọng GD2)** | 1 | 2 | 3 |
| **Trivial (Giao diện / Tài liệu)** | 0 | 0 | 0 |
| **TỔNG CỘNG** | **1** | **2** | **3** |

---

## 2. BẢNG CHI TIẾT DANH SÁCH BUG & KẾT QUẢ RETEST

| Bug ID | TC liên quan | UC | Tiêu đề | Mô tả & Các bước tái hiện | Kết quả thực tế | Kết quả mong đợi | Mức độ | Ưu tiên | Trạng thái | Phát hiện bởi / Ngày | Người xử lý | Commit sửa | Vòng Retest | Kết quả Retest | Bằng chứng |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **BUG-WRK-001** | `TC-WRK-05-08` | UC-WRK-05 | Chưa hỗ trợ đính kèm tệp tài liệu minh chứng trong biểu mẫu giải trình | **Mô tả:** Tài liệu đặc tả và kịch bản người dùng có nêu yêu cầu đính kèm tài liệu minh chứng (PDF) khi gửi giải trình.<br>**Tái hiện:** Kiểm tra bảng `explanations` trong database và API `POST /api/explanations`, `PUT /api/explanations/:id/response`. | Cấu trúc bảng `explanations` không có cột `attachment_url` / `attachment_name`; API chưa có endpoint upload file cho giải trình. | Hỗ trợ upload tệp PDF minh chứng ≤ 10MB tương tự như phân hệ kiểm tra (M06) và văn bản (M05). | Minor | P3 | **Open** *(Ghi nhận Backlog GD2)* | QA Lead / 09/11/2026 | BA / Tech Lead | N/A (Thiết kế GD2) | Vòng 1 | **NOT RUN** (Tính năng chưa phát triển ở backend) | `pccc-BE/src/modules/explanations/explanations.service.js` |
| **BUG-WRK-002** | `TC-WRK-06-01`..`07` | UC-WRK-06 | Sai lệch tài liệu: Tài liệu cũ ghi nhận chưa triển khai tin nhắn trao đổi dù source code đã hoàn thiện | **Mô tả:** `WORK_KPI.md` ghi chú "Không triển khai UC-WRK-06 (nhắn tin)", đồng thời `docs/Test_Plan_Test_Cases_PCCC.md` v1.1 gắn tin nhắn vào UC-WRK-03.<br>**Tái hiện:** Đối soát mã nguồn `pccc-BE/src/modules/tasks/tasks.service.js` và UI `TaskConversation`. | Backend đã có đầy đủ API gửi/sửa/xóa mềm tin nhắn và Frontend có UI hoàn chỉnh (F09). | Tài liệu phải chuẩn hóa ánh xạ độc lập 6 Use Cases (WRK-01 đến WRK-06). | Minor | P2 | **Closed** *(Đã khắc phục)* | QA Lead / 09/11/2026 | QA Lead | `qa/m07-work-kpi` | Vòng 1 | **PASS** (Đã chuẩn hóa toàn bộ RTM, Test Plan, Spec sang UC-WRK-06) | `task-messages.test.js`, `m07-e2e.test.js:352` |
| **BUG-WRK-003** | `TC-WRK-02-01`, `TC-WRK-02-02` | UC-WRK-02 | Ca kiểm thử tạo task và cập nhật tiến độ bị đánh dấu nhầm trạng thái NOT RUN | **Mô tả:** Trong tài liệu `Test_Plan_Test_Cases_PCCC.md` v1.1, hai ca kiểm thử TC-WRK-02-01 và TC-WRK-02-02 bị ghi trạng thái NOT RUN dù code đã có sẵn.<br>**Tái hiện:** Chạy test suite `work-kpi.test.js` và `task-messages.test.js`. | Mã kiểm thử tự động đã bao phủ việc giao việc và cập nhật tiến độ bền vững nhưng tài liệu chưa cập nhật kết quả. | Thực thi kiểm chứng thực tế và cập nhật trạng thái PASS có bằng chứng log. | Minor | P2 | **Closed** *(Đã khắc phục)* | QA Lead / 09/11/2026 | QA Lead | `test/m07-e2e.test.js` | Vòng 1 | **PASS** (100% assertions đạt kết quả mong đợi) | `final_pnpm_test_run.log:210` |

---

## 3. KẾT LUẬN RETEST

- Đợt kiểm thử đính kèm bộ test suite tự động chuyên sâu `pccc-BE/test/m07-e2e.test.js` kết hợp với 2 test suite có sẵn (`work-kpi.test.js`, `task-messages.test.js`) đã xác nhận:
  - **Không có bất kỳ lỗi logic nghiệp vụ nào** làm sai lệch dữ liệu tiến độ công việc hoặc điểm số KPI.
  - Vấn đề sai lệch phân loại Use Case và thiếu sót tài liệu đã được khắc phục 100%.
  - Tồn đọng về upload tài liệu giải trình (BUG-WRK-001) không ảnh hưởng tới luồng duyệt và xóa nợ KPI, được bàn giao chính thức vào kế hoạch phát triển Giai đoạn 2.

---
*Báo cáo được phê duyệt bởi QA Lead dự án PCCC & CNCH ngày 09/11/2026.*
