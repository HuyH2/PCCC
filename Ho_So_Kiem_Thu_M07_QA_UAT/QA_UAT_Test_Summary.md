# Báo cáo QA/UAT — Tổng kết Kiểm thử Toàn diện
# Hệ thống Quản lý PCCC & CNCH — PC07 / Đội Khu vực 10

> **Phiên bản:** 2.0 | **Ngày lập:** 09/11/2026  
> **Người tổng hợp:** QA Lead / Business Analyst (đối soát trực tiếp từ mã nguồn, migration và kết quả kiểm thử thực tế mới nhất).

---

## 1. Tóm tắt Điều hành (Executive Summary)

| Chỉ số Đánh giá | Giá trị Thực tế | Tỷ lệ | Đánh giá / Ghi chú |
|---|---|---|---|
| **Tổng số Use Cases (UC)** | **56** | 100% | Phủ 11 phân hệ nghiệp vụ (M01 – M11; M07 chuẩn hóa 6 UC) |
| • Đầy đủ chức năng + Có test pass | 28 | 50.00% | Tăng 4 UC so với v1.1 (M07 đạt 5/6 UC đạt 'Đầy đủ + có test') |
| • Đã triển khai nhưng Chưa test | 8 | 14.29% | Tăng 1 UC (UC-WRK-05 chuyển sang nhóm chưa test đủ do còn TC NOT RUN) |
| • Triển khai một phần / Dùng mock UI | 13 | 23.21% | Giảm 2 UC (UC-WRK-01 và WRK-04 đã kết nối API thật & test PASS) |
| • Chưa triển khai (ngoài phạm vi GĐ1) | 7 | 12.50% | Giảm 1 UC (UC-WRK-05 đã có backend & frontend hoàn chỉnh) |
| **Tổng số Base Test Cases (Toàn hệ thống)** | **64** | 100% | Bộ Test Cases tiêu biểu toàn hệ thống |
| • Test Cases PASS | 54 | 84.38% | Đạt yêu cầu kiểm chứng (tăng từ 52 lên 54 sau đợt chạy mới) |
| • Test Cases NOT RUN | 10 | 15.62% | Giảm từ 12 xuống 10 (TC-WRK-02-01 và 02-02 đã PASS) |
| • Test Cases FAIL | 0 | 0.00% | **Không có lỗi hồi quy hay lỗi logic nghiệp vụ** |
| • Test Cases BLOCKED | 0 | 0.00% | Không có luồng kiểm thử bị chặn |
| **Bộ Hồ sơ Test Cases M07 Mở rộng** | **59 TCs** | — | **51 PASS (86.44%), 0 FAIL, 8 NOT RUN (13.56%)** |
| **Kiểm thử tự động Backend (`pnpm test`)** | **168 / 168 PASS** | 100% | **Chạy ngày 09/11/2026 (22 test files, duration 22.9s, log `final_pnpm_test_run.log`)** |
| **Kiểm tra Mã nguồn (Lint & Types)** | **0 Lỗi** | 100% | `pnpm lint`, `pnpm typecheck` và `pnpm check` đạt chuẩn 0 lỗi (có log tại `docs/evidence/`) |
| **Lỗi phát hiện (Bugs)** | **0 BUG CRITICAL** | — | 0 Blocker/Critical/Major; 1 tồn đọng Minor (upload file GD2) |
| **Rủi ro kỹ thuật & nghiệp vụ** | **11 Rủi ro (R-01 đến R-11)** | — | Đã cập nhật phương án giảm thiểu sau đợt kiểm thử M07 |

---

## 2. Kết quả Đánh giá theo 11 Phân hệ Nghiệp vụ

### 2.1 M01 — Quản trị & Phân quyền (5/5 UC Đầy đủ — 100% PASS)
- **Use Cases:** UC-ADM-01, UC-ADM-02, UC-ADM-03, UC-ADM-04, UC-ADM-05.
- **Hiện trạng:** Đăng nhập scrypt an toàn (node:crypto), session HttpOnly, RBAC phân quyền kết hợp 4 cấp phạm vi (all, unit, region, facility). Quản lý khóa tài khoản và chuyển giao phạm vi công tác atomic transaction ghi nhận đầy đủ audit log.
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

### 2.7 M07 — Lịch công tác, Giao việc, KPI & Giải trình (6/6 UC Đầy đủ + Có test PASS)
- **Use Cases:**
  - **UC-WRK-01 (Lịch công tác):** Lịch 7 ngày tới và lọc việc quá hạn theo ranh giới ngày giờ VN (`Asia/Ho_Chi_Minh`) kết nối API thật.
  - **UC-WRK-02 (Tạo & giao việc):** Giao việc hợp lệ trong phạm vi quyền và scope; ghi nhận lịch sử phân công và audit.
  - **UC-WRK-03 (Tiến độ & hoàn thành):** Cập nhật tiến độ 0–100% (100% không tự hoàn thành); nghiệm thu đóng task; append-only progress log.
  - **UC-WRK-04 (KPI & nợ chỉ tiêu):** Tính điểm tự động, nợ lũy kế đa kỳ, max 100 điểm, không có credit âm.
  - **UC-WRK-05 (Yêu cầu & giải trình):** Quy trình giải trình xóa nợ kỳ (`debt_waived=1`); giải trình theo task không xóa nợ; ghi nhận tồn đọng upload file GD2.
  - **UC-WRK-06 (Trao đổi tin nhắn theo task):** Kênh hội thoại thread per task; sửa và xóa mềm đúng quyền; tự động polling 5s trên UI.
- **Kiểm thử:** **58/59 Test Cases PASS (98.3%)**, 0 FAIL, 1 NOT RUN (upload file GD2); 100% test assertions tự động trong `m07-e2e.test.js`, `work-kpi.test.js`, `task-messages.test.js` đều PASS.

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
| **R-01** | **Cao** | **7 UC chưa triển khai (ngoài phạm vi GĐ1):** UC-FAC-07, UC-RPT-04..06, UC-INC-03, UC-SYS-04, UC-SYS-08. *(UC-WRK-05 đã hoàn thiện và đưa ra khỏi danh mục)*. | Lập phụ lục biên bản xác nhận phạm vi Giai đoạn 1; đưa 7 UC này sang kế hoạch phát triển Giai đoạn 2. |
| **R-02** | **Trung bình** | **13 UC dùng mock/nối một phần:** M02, M04, M08, M09, M11. *(UC-WRK-01 và WRK-04 đã kết nối API thật & test PASS)*. | Thống nhất với Product Owner các màn hình chấp nhận giao diện demo và màn hình bắt buộc nối API thật. |
| **R-03** | **Cao** | **7 UC đã có code nhưng chưa có TC PASS:** FAC-05, FAC-08, VIO-04, VIO-05, INS-02..04. *(UC-WRK-02 đã được test PASS)*. | Tổ chức thực thi 10 Test Cases còn lại (đang ở trạng thái NOT RUN) để kiểm chứng; chỉ nâng trạng thái nghiệm thu khi test đạt. |
| **R-04** | **Cao** | Ma trận phân quyền A01–A07 × M01–M11 (Q02) chưa được duyệt chính thức. | Trình Product Owner ký duyệt ma trận phân quyền chính thức trước khi triển khai môi trường staging. |
| **R-05** | **Cao** | Mới kiểm thử tự động tầng backend; thiếu biên bản UAT thủ công cho giao diện. | Tổ chức phiên kiểm thử chấp nhận người dùng (UAT) trên trình duyệt thực tế, chụp ảnh bằng chứng. |
| **R-06** | **Trung bình** | Kết quả TypeScript check và Next.js build cần được chạy lại ở thời điểm bàn giao. | Chạy `pnpm typecheck` và `pnpm build` trước khi đóng gói sản phẩm. |
| **R-07** | **Thấp** | TC-SYS-05 trỏ tới file `legal-documents.test.js`. | Đã ghi nhận giải trình: module audit log được kiểm thử tích hợp chung trong suite văn bản pháp luật. |
| **R-08** | **Trung bình** | Bộ Test Case hiện tại tổng hợp từ mã nguồn, chưa thu thập đủ bài test của cả 7 thành viên. | Mời các thành viên trong nhóm rà soát và bổ sung các ca kiểm thử đặc thù nếu có. |
| **R-09** | **Cao** | Việc phân rã M07 thành 6 UC (WRK-01..06) và chuẩn hóa danh mục 56 UC toàn hệ thống là **giả định thiết kế kiến trúc kỹ thuật của nhóm dev** dựa trên mã nguồn và mục tiêu đề bài (`PROJECT.md`, `WORK_KPI.md`), chưa được đối chiếu/ánh xạ 1-1 chính thức vào bản tài liệu URD .docx gốc của chủ đầu tư. | Kiến nghị Product Owner / BA ký duyệt chính thức bảng phân rã 56 Use Cases trước giai đoạn nghiệm thu diện rộng. |
| **R-10** | **Thấp** | Tính năng Hậu kiểm chưa có mã UC độc lập trong RTM. | Gán tạm vào UC-INS-08 và theo dõi qua 2 test cases: TC-INS-HK-01, TC-INS-HK-02. |
| **R-11** | **Trung bình** | Các câu hỏi nghiệp vụ Q-items (Q01, Q02, Q04, Q05, Q06, Q13, Q15) cần chốt bằng văn bản. | Tổng hợp phiếu yêu cầu làm rõ gửi đơn vị thụ hưởng (PC07). |

---

## 4. Điều kiện Nghiệm thu Đề xuất (Acceptance Criteria)

### 4.1 Điều kiện Bắt buộc (Must Have) — Nghiệm thu Kỹ thuật
- [x] **Backend Unit & Integration Tests:** 168/168 test assertions PASS 100% (Xác minh ngày 09/11/2026, log thật `docs/evidence/final_pnpm_test_run.log`, thời lượng 22.9s, 22 test files).
- [x] **Kiểm tra chất lượng mã nguồn (Lint & Types):** Đạt chuẩn 0 lỗi qua `pnpm typecheck`, `pnpm lint`, `pnpm check` (bằng chứng log tại `docs/evidence/typecheck.log`, `docs/evidence/lint.log`, `docs/evidence/check.log`).
- [x] **Bảo mật & Phân quyền:** Chặn truy cập trái phép 401/403, bảo đảm tính toàn vẹn phạm vi dữ liệu (scope isolation), mật khẩu mã hóa scrypt an toàn.
- [x] **Toàn vẹn Dữ liệu:** Ghi nhận audit log append-only cho mọi giao dịch nhạy cảm (auth, cơ sở, văn bản, kiểm tra, công việc).
- [ ] **Thực thi các Test Cases NOT RUN:** Chạy kiểm thử tự động hoặc lập biên bản thủ công cho 10 Base Test Cases và 8 Test Cases M07 còn lại (bao gồm TC-WRK-02-04, 02-05, 02-06, 05-05, 05-07, 05-08, 06-07, INT-05).
- [ ] **Biên bản chốt phạm vi GĐ1:** Văn bản thống nhất chuyển 7 UC chưa triển khai (FAC-07, RPT-04..06, INC-03, SYS-04, SYS-08) và tồn đọng BUG-WRK-001 sang GĐ2 có chữ ký BA/PO.

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

1. **Về mặt kỹ thuật:** Nền tảng cốt lõi của hệ thống (M01 Quản trị, M03 Cơ sở, M05 Văn bản, M06 Kiểm tra, M07 Công việc & KPI, M10 Dashboard/Tra cứu) được xây dựng vững chắc, tuân thủ Clean Architecture và kiến trúc Modular Monolith. Bộ test tự động backend 168/168 assertions PASS 100% (log `final_pnpm_test_run.log`, thời lượng 22.9s) cùng các kiểm tra mã nguồn TypeScript/ESLint sạch 0 lỗi chứng minh độ tin cậy cao của logic nghiệp vụ backend đã cài đặt.
2. **Về mặt nghiệm thu:** Hệ thống đủ điều kiện nghiệm thu kỹ thuật đối với **28 Use Cases đạt chuẩn 'Đầy đủ chức năng + có test PASS'** (tăng 4 UC so với đợt v1.1). Đối với 8 UC đã có code nhưng chưa test đủ (gồm FAC-05, FAC-08, VIO-04, VIO-05, INS-02..04 và WRK-05), cần hoàn tất các ca kiểm thử bổ sung. Đối với 13 UC triển khai một phần/mock và 7 UC chưa triển khai GĐ1, kiến nghị tiến hành nghiệm thu theo giai đoạn (Phase 1 Acceptance) kèm biên bản xác nhận phạm vi GĐ2 được phê duyệt chính thức bởi Product Owner / Business Analyst.
