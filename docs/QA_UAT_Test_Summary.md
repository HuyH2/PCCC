# Báo cáo QA/UAT — Tổng kết Kiểm thử Toàn diện
# Hệ thống Quản lý PCCC & CNCH — PC07 / Đội Khu vực 10

> **Phiên bản:** 1.1 | **Ngày lập:** 04/11/2026  
> **Người tổng hợp:** Đội ngũ QA / Agent (đối soát trực tiếp từ mã nguồn, migration và kết quả kiểm thử thực tế).

---

## 1. Tóm tắt Điều hành (Executive Summary)

| Chỉ số Đánh giá | Giá trị Thực tế | Tỷ lệ | Đánh giá / Ghi chú |
|---|---|---|---|
| **Tổng số Use Cases (UC)** | **55** | 100% | Phủ 11 phân hệ nghiệp vụ (M01 – M11) |
| • Đầy đủ chức năng + Có test pass | 24 | 43.64% | Mọi Test Case liên quan đều PASS |
| • Đã triển khai nhưng Chưa test | 8 | 14.55% | Đã có backend/API; cần chạy 11 TC mới thiết kế |
| • Triển khai một phần / Dùng mock UI | 15 | 27.27% | Cần chốt mức độ hoàn thiện trước nghiệm thu |
| • Chưa triển khai (ngoài phạm vi GĐ1) | 8 | 14.55% | Kiến nghị chuyển backlog hoặc văn bản chốt |
| **Tổng số Test Cases (TC)** | **64** | 100% | 53 TC gốc v1.0 + 11 TC thiết kế mới |
| • Test Cases PASS | 52 | 81.25% | Đạt yêu cầu kiểm chứng (backend & manual) |
| • Test Cases NOT RUN | 12 | 18.75% | Chưa chạy (1 TC gốc + 11 TC mới) |
| • Test Cases FAIL | 0 | 0.00% | **Không có lỗi hồi quy hay lỗi logic** |
| • Test Cases BLOCKED | 0 | 0.00% | Không có luồng kiểm thử bị chặn |
| **Kiểm thử tự động Backend (`node --test`)** | **160 / 160 PASS** | 100% | **Chạy ngày 04/11/2026 (duration 11.1s)** |
| **Lỗi phát hiện (Bugs)** | **0 BUG FAIL** | — | Các tồn đọng được quản lý dưới dạng Rủi ro |
| **Rủi ro kỹ thuật & nghiệp vụ** | **11 Rủi ro (R-01 đến R-11)** | — | Có phương án giảm thiểu chi tiết |

---

## 2. Kết quả Đánh giá theo 11 Phân hệ Nghiệp vụ

### 2.1 M01 — Quản trị & Phân quyền (5/5 UC Đầy đủ — 100% PASS)
- **Use Cases:** UC-ADM-01, UC-ADM-02, UC-ADM-03, UC-ADM-04, UC-ADM-05.
- **Hiện trạng:** Đăng nhập bcrypt an toàn, session HttpOnly, RBAC phân quyền kết hợp 4 cấp phạm vi (all, unit, region, facility). Quản lý khóa tài khoản và chuyển giao phạm vi công tác atomic transaction ghi nhận đầy đủ audit log.
- **Kiểm thử:** 11/11 TC PASS (`auth.test.js`, `account-transfer.test.js`).

### 2.2 M02 — Tổ chức - Cán bộ - Địa bàn (3/3 UC Một phần/mock)
- **Use Cases:** UC-ORG-01, UC-ORG-02, UC-ORG-03.
- **Hiện trạng:** Đã có migration và API tổ chức/khu vực (`/api/organization`, `/api/regions`), tuy nhiên giao diện người dùng vẫn đang phụ thuộc vào mock data.
- **Đánh giá:** Trạng thái **Một phần / mock**. Cần nối API frontend và bổ sung Test Case tương ứng.

### 2.3 M03 — Cơ sở & Hồ sơ (5 Đầy đủ, 2 Chưa test, 1 Chưa triển khai)
- **Use Cases Đầy đủ:** UC-FAC-01, UC-FAC-02, UC-FAC-03, UC-FAC-04, UC-FAC-06.
- **Use Cases Chưa test:** UC-FAC-05 (đình chỉ/hoạt động lại), UC-FAC-08 (lịch sử quyết định).
- **Use Cases Chưa triển khai:** UC-FAC-07 (Import dữ liệu Excel cơ sở).
- **Hiện trạng:** Quản lý cơ sở phân trang theo scope; quản lý nhân sự có chứng chỉ huấn luyện PCCC, ràng buộc duy nhất 1 người đứng đầu đang hoạt động; upload file đính kèm đa định dạng ≤10MB đã hoàn thiện và pass test.

### 2.4 M04 — Vi phạm - Đình chỉ - Khắc phục (2 Chưa test, 3 Một phần/mock)
- **Use Cases Chưa test:** UC-VIO-04 (Đình chỉ cơ sở), UC-VIO-05 (Hoạt động lại cơ sở).
- **Use Cases Một phần:** UC-VIO-01, UC-VIO-02, UC-VIO-03 (Lập hồ sơ vi phạm, quyết định xử phạt, theo dõi khắc phục).
- **Hiện trạng:** Module vi phạm backend đã có cấu trúc, tuy nhiên luồng UI nghiệp vụ vi phạm cần kiểm thử liên thông với cơ sở.

### 2.5 M05 — Văn bản Pháp luật / Quy chuẩn (3/3 UC Đầy đủ — 100% PASS)
- **Use Cases:** UC-DOC-01, UC-DOC-02, UC-DOC-03.
- **Hiện trạng:** Kho văn bản toàn hệ thống có tìm kiếm full-text tiếng Việt không dấu; cơ chế optimistic locking chống xung đột phiên bản (HTTP 409 `VERSION_CONFLICT`); upload PDF kiểm tra magic bytes `%PDF-` và `%%EOF`; audit log append-only.
- **Kiểm thử:** 9/9 TC PASS (`legal-documents.test.js`).

### 2.6 M06 — Công tác Kiểm tra (6 Đầy đủ, 3 Chưa test)
- **Use Cases Đầy đủ:** UC-INS-01, UC-INS-05, UC-INS-06, UC-INS-07, UC-INS-08, UC-INS-09.
- **Use Cases Chưa test:** UC-INS-02 (chỉ tiêu), UC-INS-03 (phân công định kỳ), UC-INS-04 (lịch kiểm tra).
- **Hiện trạng:** Luồng state machine kiểm tra chuẩn mực: `planned → in_progress → evaluated → completed → follow_up`. Chặn hoàn thành nếu thiếu biên bản hoặc kết luận (BR-02); dời lịch bắt buộc nhập lý do (R-302).
- **Kiểm thử:** 12/17 TC PASS; 5 TC mới ở trạng thái NOT RUN.

### 2.7 M07 — Lịch - Công việc - KPI (1 Đầy đủ, 1 Chưa test, 2 Mock, 1 Chưa triển khai)
- **Use Cases Đầy đủ:** UC-WRK-03 (Trao đổi tin nhắn theo công việc — PASS).
- **Use Cases Chưa test:** UC-WRK-02 (Giao việc & theo dõi tiến độ — NOT RUN).
- **Use Cases Mock:** UC-WRK-01 (Lịch công tác), UC-WRK-04 (KPI & nợ chỉ tiêu).
- **Use Cases Chưa triển khai:** UC-WRK-05 (Yêu cầu giải trình).

### 2.8 M08 — Báo cáo - Deadline (3 Mock, 3 Chưa triển khai)
- **Use Cases Mock:** UC-RPT-01, UC-RPT-02, UC-RPT-03.
- **Use Cases Chưa triển khai:** UC-RPT-04 (Biểu mẫu báo cáo), UC-RPT-05 (Phê duyệt báo cáo), UC-RPT-06 (Export dữ liệu).

### 2.9 M09 — Sự cố (2 Mock, 1 Chưa triển khai)
- **Use Cases Mock:** UC-INC-01, UC-INC-02.
- **Use Cases Chưa triển khai:** UC-INC-03 (Nghiệp vụ CNCH chuyên biệt).

### 2.10 M10 — Tra cứu - Dashboard - Cảnh báo (4 Đầy đủ, 1 Mock, 1 Chưa triển khai)
- **Use Cases Đầy đủ:** UC-SYS-01 (Tra cứu toàn hệ thống), UC-SYS-02 (Dashboard thời gian thực), UC-SYS-05 (Nhật ký thao tác), UC-SYS-06 (Mobile Web & PWA).
- **Use Cases Mock:** UC-SYS-03 (Cảnh báo & nhắc việc).
- **Use Cases Chưa triển khai:** UC-SYS-04 (Import dữ liệu số hóa).

### 2.11 M11 — Số hóa - Vận hành (1 Mock, 1 Chưa triển khai)
- **Use Cases Mock:** UC-SYS-07 (Chuyển dữ liệu data transfer).
- **Use Cases Chưa triển khai:** UC-SYS-08 (Vận hành & giám sát — Ngoài phạm vi Giai đoạn 1).

---

## 3. Quản lý Rủi ro & Kế hoạch Ứng phó (11 Rủi ro)

| Mã | Mức độ | Nội dung Rủi ro | Kế hoạch Hành động / Giảm thiểu |
|---|---|---|---|
| **R-01** | **Cao** | **8 UC chưa triển khai:** UC-FAC-07, UC-WRK-05, UC-RPT-04..06, UC-INC-03, UC-SYS-04, UC-SYS-08. | Lập phụ lục biên bản xác nhận phạm vi Giai đoạn 1; đưa 8 UC này sang kế hoạch phát triển Giai đoạn 2. |
| **R-02** | **Trung bình** | **15 UC dùng mock/nối một phần:** M02, M04, M08, M09, M11. | Thống nhất với Product Owner các màn hình chấp nhận giao diện demo và màn hình bắt buộc nối API thật. |
| **R-03** | **Cao** | **8 UC đã có code nhưng chưa có TC PASS:** FAC-05, FAC-08, VIO-04, VIO-05, INS-02..04, WRK-02. | Tổ chức thực thi 11 Test Cases mới được bổ sung; chỉ nâng trạng thái nghiệm thu khi test đạt. |
| **R-04** | **Cao** | Ma trận phân quyền A01–A07 × M01–M11 (Q02) chưa được duyệt chính thức. | Trình Product Owner ký duyệt ma trận phân quyền chính thức trước khi triển khai môi trường staging. |
| **R-05** | **Cao** | Mới kiểm thử tự động tầng backend; thiếu biên bản UAT thủ công cho giao diện. | Tổ chức phiên kiểm thử chấp nhận người dùng (UAT) trên trình duyệt thực tế, chụp ảnh bằng chứng. |
| **R-06** | **Trung bình** | Kết quả TypeScript check và Next.js build cần được chạy lại ở thời điểm bàn giao. | Chạy `pnpm typecheck` và `pnpm build` trước khi đóng gói sản phẩm. |
| **R-07** | **Thấp** | TC-SYS-05 trỏ tới file `legal-documents.test.js`. | Đã ghi nhận giải trình: module audit log được kiểm thử tích hợp chung trong suite văn bản pháp luật. |
| **R-08** | **Trung bình** | Bộ Test Case hiện tại tổng hợp từ mã nguồn, chưa thu thập đủ bài test của cả 7 thành viên. | Mời các thành viên trong nhóm rà soát và bổ sung các ca kiểm thử đặc thù nếu có. |
| **R-09** | **Cao** | Chưa đối soát trực tiếp toàn bộ tài liệu URD v1.0 gốc (Q01). | Đã rà soát file `URD_He_thong_Quan_ly_PCCC_CNCH_PC07_v1.0 (2).docx` có sẵn trong repository để đối chiếu. |
| **R-10** | **Thấp** | Tính năng Hậu kiểm chưa có mã UC độc lập trong RTM. | Gán tạm vào UC-INS-08 và theo dõi qua 2 test cases: TC-INS-HK-01, TC-INS-HK-02. |
| **R-11** | **Trung bình** | Các câu hỏi nghiệp vụ Q-items (Q01, Q02, Q04, Q05, Q06, Q13, Q15) cần chốt bằng văn bản. | Tổng hợp phiếu yêu cầu làm rõ gửi đơn vị thụ hưởng (PC07). |

---

## 4. Điều kiện Nghiệm thu Đề xuất (Acceptance Criteria)

### 4.1 Điều kiện Bắt buộc (Must Have) — Nghiệm thu Kỹ thuật
- [x] **Backend Unit & Integration Tests:** 160/160 test assertions PASS (Đã xác minh ngày 04/11/2026).
- [x] **Bảo mật & Phân quyền:** Chặn truy cập trái phép 401/403, bảo đảm tính toàn vẹn phạm vi dữ liệu (scope isolation).
- [x] **Toàn vẹn Dữ liệu:** Ghi nhận audit log append-only cho mọi giao dịch nhạy cảm (auth, cơ sở, văn bản, kiểm tra).
- [ ] **Thực thi 12 Test Cases NOT RUN:** Chạy kiểm thử tự động hoặc thủ công cho 12 ca kiểm thử còn lại.
- [ ] **Biên bản chốt phạm vi GĐ1:** Văn bản thống nhất chuyển 8 UC chưa triển khai sang GĐ2.

### 4.2 Điều kiện Nghiệp vụ (Should Have) — Nghiệm thu Người dùng
- [ ] **Ký duyệt Ma trận Phân quyền (Q02):** Xác nhận quyền hạn cho 6 vai trò chính (A01 đến A06).
- [ ] **UAT 5 Luồng cốt lõi:**
  1. Luồng Xác thực: Đăng nhập → Đổi mật khẩu → Khóa tài khoản → Chuyển giao địa bàn.
  2. Luồng Cơ sở: Thêm cơ sở → Thêm người đứng đầu & nhân sự PCCC → Đính kèm hồ sơ PDF ≤10MB.
  3. Luồng Kiểm tra: Lập kế hoạch → Thực hiện theo checklist → Đính kèm biên bản → Chốt kết quả & kết luận.
  4. Luồng Văn bản: Thêm văn bản kèm PDF → Cập nhật phiên bản (optimistic lock) → Tra cứu không dấu.
  5. Luồng Điều hành: Dashboard tổng hợp số liệu thực tế → Tra cứu phân tán theo scope.
- [ ] **Kiểm thử Responsive:** Đảm bảo hiển thị chuẩn trên màn hình máy tính và thiết bị di động (viewport 390px).

---

## 5. Kết luận & Kiến nghị

1. **Về mặt kỹ thuật:** Nền tảng cốt lõi của hệ thống (M01 Quản trị, M03 Cơ sở, M05 Văn bản, M06 Kiểm tra, M10 Dashboard/Tra cứu) được xây dựng rất vững chắc, tuân thủ Clean Architecture và kiến trúc Modular Monolith. Bộ test backend 160/160 assertions pass chứng minh độ tin cậy cao của logic nghiệp vụ đã cài đặt.
2. **Về mặt nghiệm thu:** Hệ thống đủ điều kiện nghiệm thu kỹ thuật đối với **24 Use Cases cốt lõi**. Đối với 8 UC chưa test, cần chạy bổ sung 12 TC để hoàn tất nghiệm thu. Đối với 15 UC mock và 8 UC chưa làm, kiến nghị tiến hành nghiệm thu theo giai đoạn (Phase 1 Acceptance) và ký kết kế hoạch triển khai Giai đoạn 2.
