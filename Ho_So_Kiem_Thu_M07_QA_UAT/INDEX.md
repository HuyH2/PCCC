# THƯ MỤC TỔNG HỢP HỒ SƠ KIỂM THỬ M07 & QA/UAT TOÀN HỆ THỐNG
## HỆ THỐNG QUẢN LÝ PCCC & CNCH — PC07 / ĐỘI KHU VỰC 10

> Thư mục này tập hợp đầy đủ tất cả **các file tài liệu, bảng tính Excel, mã kiểm thử tự động và nhật ký thực thi thực tế** đã được chuẩn hóa và rà soát toàn diện trong đợt bàn giao ngày **09/11/2026**.

---

### Danh mục các file trong thư mục:

#### 1. Bộ hồ sơ kiểm thử phân hệ M07 (Lịch công tác, Giao việc, KPI, Giải trình, Trao đổi):
1. **`M07_Test_Cases_WRK.md`**: Chi tiết 59 Test Cases (40 Functional, 4 E2E, 10 Negative, 5 Integration) bao phủ cả 6 Use Cases WRK-01..06. Kết quả thẩm tra thực tế: **51 PASS (86.44%)**, **0 FAIL**, **8 NOT RUN (13.56%)** (gồm 7 ca kiểm thử chưa chạy test/thiếu biên bản UI thủ công và 1 ca upload file giải trình GĐ2).
2. **`M07_Test_Execution_Report.md`**: Báo cáo thực thi thực tế, phân tích chi tiết 4 kịch bản E2E toàn trình, 10 ca kiểm thử bảo mật & ngoại lệ, kiểm soát xung đột đồng thời HTTP 409 (`NO_CHANGE`/`TASK_CLOSED`/`EXPLANATION_CLOSED`), chèn fixture vượt chỉ tiêu cô lập logic KPI.
3. **`M07_Bug_Report_Retest.md`**: Danh mục Bug & kết quả Retest (0 Bug Blocker/Critical/Major; 1 tồn đọng Minor về upload file giải trình đề xuất chuyển GĐ2 cần văn bản chấp thuận của BA/PO; sửa lỗi trích dẫn file mã nguồn).
4. **`M07_Sign_off.md`**: Biên bản nghiệm thu kỹ thuật M07 kết luận **Đạt có điều kiện (Conditional Pass)**, rủi ro, phân loại tồn đọng và khung chữ ký xác nhận 3 bên (QA / BA / Chỉ huy).
5. **`m07-e2e.test.js`**: Bộ kiểm thử tự động chuyên sâu chạy bằng Node.js Native Test Runner (`node:test`) kiểm chứng toàn bộ luồng nghiệp vụ trên SQLite in-memory, assertions chính xác cho kiểm soát đồng thời và đối tượng gửi nhận.

#### 2. Kịch bản UAT & Hướng dẫn sử dụng:
6. **`UAT_Scripts.md`**: Kịch bản kiểm thử chấp nhận người dùng (UAT) theo vai trò A01-A06; chuẩn hóa A06 bị chặn xem chi tiết việc người khác (404 NOT_FOUND bảo mật) và A02 hiển thị bảng phân lịch 7 ngày liên tiếp từ ngày hiện tại.
7. **`User_Manual_PCCC.md`**: Hướng dẫn sử dụng toàn hệ thống v2.0 (56 Use Cases), lược bỏ khẳng định thông báo tự động chưa triển khai tại mục 5.3.

#### 3. Bộ tài liệu nghiệp vụ, Ma trận truy vết & Báo cáo QA toàn hệ thống (v2.0):
8. **`Functional_Specification_PCCC.md`**: Đặc tả chức năng v2.0 mở rộng bao phủ đầy đủ **11 phân hệ nghiệp vụ và 56 Use Cases toàn hệ thống**; làm rõ cơ chế lưu trữ tệp tin trên file system bảo mật và thuật toán mật khẩu `scrypt`.
9. **`Requirements_Traceability_Matrix.md`**: Ma trận truy vết yêu cầu (RTM) v2.0 theo dõi toàn bộ 56 Use Cases: **28 UC Đầy đủ + có test (50.00%)**, **8 UC Đã triển khai nhưng chưa test đủ (14.29%)**, **13 UC Một phần/Mock (23.21%)**, **7 UC Chưa triển khai (12.50%)**; chuyển UC-WRK-05 sang nhóm chưa test đủ do còn TC NOT RUN; chuẩn hóa mã `TC-WRK-03-01`.
10. **`Requirements_Traceability_Matrix.xlsx`**: File Excel RTM v2.0 gồm 5 sheets (`RTM`, `Tổng hợp & Module`, `Bug & Rủi ro`, `Q-items`, `Chú giải Trạng thái`) đồng bộ 100% với file Markdown.
11. **`Test_Plan_Test_Cases_PCCC.md`**: Kế hoạch kiểm thử & 64 Base Test Cases tiêu biểu toàn hệ thống (54 PASS, 10 NOT RUN, 0 FAIL) v2.0; chuẩn hóa mã ca kiểm thử tiến độ thành `TC-WRK-03-01`.
12. **`Test_Plan_Test_Cases_PCCC.xlsx`**: File Excel Test Plan v2.0 gồm 4 sheets (`Test Plan`, `Test Cases`, `Tóm tắt kết quả`, `M07_WRK` 59 TCs chuyên sâu).
13. **`QA_UAT_Test_Summary.md`**: Báo cáo tổng kết chất lượng kiểm thử toàn diện v2.0; khắc phục triệt để mâu thuẫn số liệu giữa Executive Summary và Mục 4.1, Mục 5.
14. **`PROJECT.md`**: Tài liệu quy hoạch kiến trúc toàn dự án và đặc tả hạng mục F14 hoàn thiện hồ sơ QA/UAT M07.

#### 4. Bằng chứng kiểm thử & Xác thực mã nguồn:
15. **`final_pnpm_test_run.log`**: Nhật ký chạy kiểm thử tự động toàn bộ backend đạt **168 / 168 tests PASS 100%** (22 test files, thời lượng 22.9 giây).
16. **`typecheck.log`**: Nhật ký xác thực TypeScript (`tsc --noEmit`) đạt **0 lỗi**.
17. **`lint.log`**: Nhật ký kiểm tra mã nguồn ESLint đạt **0 lỗi**.
18. **`check.log`**: Nhật ký kiểm tra cú pháp Node.js (`node --check`) đạt **0 lỗi**.

---

### Bảng tóm tắt chỉ số nghiệm thu cốt lõi:

| Chỉ số nghiệm thu | Giá trị v1.1 cũ (04/11) | Giá trị v2.0 chuẩn hóa (09/11) | Đánh giá & Thay đổi |
|---|:---:|:---:|---|
| **Tổng số Use Cases toàn hệ thống** | 55 UCs | **56 UCs** | Chuẩn hóa M07 thành 6 UC độc lập (WRK-01..06) |
| • Đầy đủ chức năng + Có test PASS | 24 UCs (43.6%) | **28 UCs (50.0%)** | Tăng 4 UC đạt chuẩn nghiệm thu tuyệt đối |
| • Đã triển khai nhưng Chưa test đủ | 8 UCs (14.5%) | **8 UCs (14.3%)** | WRK-05 tham gia nhóm này do còn TC NOT RUN |
| • Triển khai một phần / Mock UI | 15 UCs (27.3%) | **13 UCs (23.2%)** | WRK-01, WRK-04 đã kết nối backend thật |
| • Chưa triển khai (ngoài phạm vi GĐ1) | 8 UCs (14.5%) | **7 UCs (12.5%)** | Kiến nghị chuyển GĐ2 có văn bản phê duyệt |
| **M07 Use Cases (Lịch, Việc, KPI, Giải trình)** | 1/5 UC Đầy đủ | **5/6 UC Đầy đủ** | WRK-01, 02, 03, 04, 06 đạt; WRK-05 chưa test đủ |
| **Hồ sơ Test Cases M07 Mở rộng** | Chưa có | **59 Test Cases** | **51 PASS (86.4%)**, **8 NOT RUN**, **0 FAIL** |
| **Base Test Cases (Toàn hệ thống)** | 52 PASS / 12 NOT RUN | **54 PASS / 10 NOT RUN** | TC-WRK-02-01 & TC-WRK-03-01 đã test PASS |
| **Kiểm thử tự động Backend (`pnpm test`)** | 160 / 160 PASS (11.1s) | **168 / 168 PASS (22.9s)** | Bổ sung suite `m07-e2e.test.js`, 100% PASS |
| **Kiểm tra Mã nguồn (Lint & Types)** | Chưa có log | **0 lỗi (có log thật)** | TypeScript, ESLint, Syntax Check 100% sạch |

