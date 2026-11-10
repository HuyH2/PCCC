# Tài liệu Đặc tả Chức năng (Functional Specification)
# Hệ thống Quản lý PCCC & CNCH — PC07 / Đội Khu vực 10

> **Phiên bản:** 2.0 | **Ngày lập:** 09/11/2026  
> **Người lập:** QA Lead / Business Analyst (chuẩn hóa toàn diện 11 phân hệ nghiệp vụ, 56 Use Cases toàn hệ thống).  
> **Căn cứ:** Quyết định phê duyệt yêu cầu, URD v1.0, PROJECT.md và mã nguồn hiện thực thực tế.

---

## 1. Tổng quan Hệ thống

Hệ thống Quản lý PCCC & CNCH phục vụ công tác quản lý địa bàn, cơ sở, thanh tra kiểm tra, xử lý vi phạm, theo dõi lịch công tác, giao việc, đánh giá KPI và điều hành tác chiến của lực lượng Cảnh sát PCCC & CNCH — PC07 / Đội Khu vực 10.

Hệ thống được thiết kế theo kiến trúc **Modular Monolith**, phân tách rõ ràng giữa Frontend (Next.js App Router, Tailwind CSS) và Backend (Node.js Native HTTP Server, SQLite WAL in-process / PostgreSQL), bảo đảm tính toàn vẹn dữ liệu, kiểm soát truy cập phân quyền nghiêm ngặt theo 4 cấp phạm vi (Toàn quyền, Đơn vị, Khu vực, Cơ sở).

---

## 2. Nguyên tắc Kiến trúc & Kỹ thuật Cốt lõi

1. **Xác thực & Bảo mật Mật khẩu:** Sử dụng thuật toán băm mật khẩu `scrypt` từ thư viện gốc `node:crypto` với salt ngẫu nhiên 16 bytes và chuỗi băm 64 bytes (định dạng `scrypt$salt$hash`), không phụ thuộc thư viện ngoài; xác thực session qua cookie HttpOnly bảo mật.
2. **Lưu trữ Tệp tin Minh chứng & Tài liệu:** Tệp tin tải lên (biên bản kiểm tra, ảnh vi phạm, tài liệu pháp lý, hồ sơ cơ sở) được lưu trữ an toàn trên hệ sinh thái tệp tin cục bộ trong thư mục riêng biệt bảo vệ ngoài public web (`private directory`, kiểm tra magic bytes, chống path traversal). Cơ sở dữ liệu chỉ lưu trữ metadata (tên gốc, kích thước, mime type, checksum SHA-256, đường dẫn nội bộ).
3. **Phân quyền Đa tầng (RBAC & Multi-level Data Scope):** Kiểm soát đồng thời quyền thao tác (grants) và phạm vi dữ liệu (`all`, `unit`, `region`, `facility`). Mọi truy vấn đọc/ghi đều áp bộ lọc scope trực tiếp tại tầng SQL.
4. **Kiểm soát Xung đột Đồng thời (Concurrency Control):** Áp dụng cơ chế khóa lạc quan (Optimistic Locking) dựa trên phiên bản/thời điểm cập nhật (`updated_at`), trả về HTTP 409 khi xảy ra tranh chấp dữ liệu.
5. **Nhật ký Thao tác Append-only (Audit Trail):** Mọi giao dịch tạo mới, chỉnh sửa trạng thái, phê duyệt, chuyển giao đều được ghi vết vào bảng nhật ký kiểm toán không thể xóa sửa, liên kết phiên làm việc và địa chỉ IP.

---

## 3. Đặc tả Chi tiết 11 Phân hệ Nghiệp vụ (56 Use Cases)

### M01 — Quản trị & Phân quyền (5 Use Cases)

**UC-ADM-01: Đăng nhập & Xác thực**
- **Actor:** Mọi vai trò (A01 – A06)
- **Flow:** Nhập username/password → Xác thực scrypt → Tạo session HttpOnly → Chuyển hướng Dashboard.
- **Lỗi:** Sai thông tin: 401 UNAUTHORIZED; Tài khoản bị khóa: 403 ACCOUNT_LOCKED; Bắt buộc đổi mật khẩu lần đầu: yêu cầu chuyển trang `/doi-mat-khau`.
- **Trạng thái:** ✅ Đầy đủ + có test (`auth.test.js`).

**UC-ADM-02: Quản lý Tài khoản Người dùng**
- **Actor:** A05 (Quản trị hệ thống)
- **Flow:** Xem danh sách tài khoản → Tạo tài khoản mới (gán cán bộ, chức vụ, vai trò) → Khóa/Mở khóa tài khoản → Đặt lại mật khẩu mặc định.
- **Quy tắc:** Không thể tự khóa tài khoản của chính mình; bảo tồn ít nhất 1 tài khoản quản trị hệ thống có phạm vi toàn quyền.
- **Trạng thái:** ✅ Đầy đủ + có test (`auth.test.js`).

**UC-ADM-03: Phân quyền Vai trò & Phạm vi Dữ liệu**
- **Actor:** A05
- **Flow:** Chọn tài khoản → Thiết lập vai trò nghiệp vụ (A01 Đội trưởng, A02 Tổ trưởng, A03 Cán bộ kiểm tra, A04 Tổng hợp, A05 Quản trị, A06 Người xem) → Cấu hình phạm vi quản lý (all, unit, region, facility) → Cập nhật quyền hạn.
- **Trạng thái:** ✅ Đầy đủ + có test (`auth.test.js`).

**UC-ADM-04: Chuyển giao Phạm vi Công tác & Quản lý Địa bàn**
- **Actor:** A05 (yêu cầu grant `M01.edit`)
- **Flow:** Chọn cán bộ bàn giao → Chọn khu vực địa bàn/cơ sở phụ trách → Chọn cán bộ tiếp nhận → Xác nhận giao dịch atomic transfer → Thu hồi quyền cán bộ cũ, cấp quyền cán bộ mới và ghi audit log.
- **Trạng thái:** ✅ Đầy đủ + có test (`account-transfer.test.js`).

**UC-ADM-05: Đổi Mật khẩu & Bảo mật Tài khoản**
- **Actor:** Mọi cán bộ có tài khoản
- **Flow:** Nhập mật khẩu cũ → Nhập mật khẩu mới (xác thực độ mạnh) → Băm mật khẩu scrypt và lưu DB → Thu hồi toàn bộ session cũ trừ phiên hiện tại.
- **Trạng thái:** ✅ Đầy đủ + có test (`auth.test.js`).

---

### M02 — Tổ chức - Cán bộ - Địa bàn (3 Use Cases)

**UC-ORG-01: Quản lý Cơ cấu Tổ chức & Đơn vị**
- **Actor:** A01, A05
- **Flow:** Quản lý danh mục Đội/Tổ công tác trực thuộc, cây phân cấp tổ chức; xem thông tin, số lượng cán bộ chiến sĩ theo từng tổ nghiệp vụ.
- **Trạng thái:** ⚠️ Triển khai một phần / Mock UI (API backend đã có tại `/api/organization`).

**UC-ORG-02: Quản lý Hồ sơ Cán bộ & Chiến sĩ**
- **Actor:** A01, A02, A05
- **Flow:** Quản lý danh sách nhân sự (họ tên, cấp bậc, chức vụ, số hiệu CAND, thông tin liên lạc, chứng chỉ chuyên môn PCCC/CNCH).
- **Trạng thái:** ⚠️ Triển khai một phần / Mock UI (API backend đã có tại `/api/organization/officers`).

**UC-ORG-03: Phân công Địa bàn Quản lý**
- **Actor:** A01, A02
- **Flow:** Phân công khu vực địa bàn phụ trách (phường/xã, khu phố, cụm cơ sở trọng điểm) cho từng cán bộ kiểm tra; bảo đảm nguyên tắc mỗi địa bàn chỉ có 1 cán bộ phụ trách chính tại một thời điểm; lưu vết lịch sử phân công.
- **Trạng thái:** ⚠️ Triển khai một phần (Backend hoàn chỉnh tại `regions.test.js`, giao diện frontend đang hoàn thiện kết nối).

---

### M03 — Quản lý Cơ sở & Hồ sơ PCCC (8 Use Cases)

**UC-FAC-01: Danh mục & Tra cứu Cơ sở PCCC**
- **Actor:** Mọi vai trò (theo scope dữ liệu)
- **Flow:** Truy cập `/co-so` → Tìm kiếm theo tên cơ sở (tiếng Việt không dấu/có dấu), địa chỉ, loại hình nguy hiểm cháy nổ, trạng thái hoạt động → Phân trang dữ liệu.
- **Trạng thái:** ✅ Đầy đủ + có test (`facilities.test.js`).

**UC-FAC-02: Thêm mới & Cập nhật Hồ sơ Cơ sở**
- **Actor:** A01, A02, A04, A05
- **Flow:** Nhập thông tin cơ sở (tên, địa chỉ, người đại diện pháp luật, phân loại cơ sở Phụ lục II/III/IV Nghị định 50/2024/NĐ-CP, tọa độ GPS) → Kiểm tra trùng lặp tên + địa chỉ → Lưu hồ sơ và ghi audit log.
- **Trạng thái:** ✅ Đầy đủ + có test (`facilities.test.js`).

**UC-FAC-03: Quản lý Người đứng đầu & Nhân sự Cơ sở**
- **Actor:** A01, A02, A03, A05
- **Flow:** Thêm/sửa thông tin người đứng đầu cơ sở, đội trưởng đội PCCC cơ sở, nhân sự được huấn luyện nghiệp vụ; ràng buộc duy nhất 1 người đứng đầu đang hoạt động.
- **Trạng thái:** ✅ Đầy đủ + có test (`facility-profile-documents.test.js`).

**UC-FAC-04: Đính kèm Tài liệu & Hồ sơ Cơ sở**
- **Actor:** A01, A02, A03, A05
- **Flow:** Tải lên tệp tài liệu (phương án chữa cháy, giấy chứng nhận thẩm duyệt, hồ sơ quản lý theo dõi) dung lượng ≤ 10MB (PDF, DOCX, ảnh); kiểm tra magic bytes; lưu trữ private storage; DB lưu metadata.
- **Trạng thái:** ✅ Đầy đủ + có test (`facility-profile-documents.test.js`).

**UC-FAC-05: Đình chỉ & Tạm đình chỉ Cơ sở**
- **Actor:** A01, A05
- **Flow:** Tiếp nhận đề xuất từ đoàn kiểm tra → Ban hành quyết định tạm đình chỉ hoặc đình chỉ hoạt động cơ sở vi phạm an toàn PCCC → Chuyển trạng thái cơ sở sang suspended/halted → Ghi lịch sử quyết định.
- **Trạng thái:** ⏳ Chưa test (đã triển khai backend API).

**UC-FAC-06: Quản lý Chứng chỉ Huấn luyện Nghiệp vụ PCCC**
- **Actor:** A01, A02, A03, A04
- **Flow:** Quản lý số giấy chứng nhận, ngày cấp, ngày hết hạn huấn luyện nghiệp vụ PCCC & CNCH của nhân sự cơ sở; cảnh báo chứng chỉ sắp hết hạn.
- **Trạng thái:** ✅ Đầy đủ + có test (`facility-profile-documents.test.js`).

**UC-FAC-07: Import Dữ liệu Cơ sở từ File Excel**
- **Actor:** A05
- **Flow:** Tải file mẫu Excel → Nhập danh sách hàng loạt cơ sở → Kiểm tra dữ liệu hợp lệ → Nhập tự động vào hệ thống.
- **Trạng thái:** 📋 Chưa triển khai (Chuyển Giai đoạn 2).

**UC-FAC-08: Lịch sử Quyết định & Biến động Cơ sở**
- **Actor:** Mọi cán bộ trong phạm vi
- **Flow:** Xem dòng thời gian (timeline) toàn bộ các quyết định thẩm duyệt, nghiệm thu, kiểm tra, xử phạt, tạm đình chỉ và phục hồi hoạt động của cơ sở.
- **Trạng thái:** ⏳ Chưa test (đã triển khai backend API `facility-history.test.js`).

---

### M04 — Vi phạm - Xử phạt - Khắc phục (5 Use Cases)

**UC-VIO-01: Lập Hồ sơ & Biên bản Vi phạm Hành chính**
- **Actor:** A01, A02, A03
- **Flow:** Ghi nhận hành vi vi phạm an toàn PCCC theo Nghị định 144/2021/NĐ-CP trong quá trình kiểm tra → Nhập hành vi, điều khoản, người làm chứng → Lưu biên bản vi phạm.
- **Trạng thái:** ⚠️ Triển khai một phần / Mock UI.

**UC-VIO-02: Ban hành Quyết định Xử phạt**
- **Actor:** A01, A05
- **Flow:** Căn cứ biên bản vi phạm → Lập quyết định xử phạt vi phạm hành chính (hình thức phạt tiền, tịch thu tang vật, thời hạn nộp phạt) → Cập nhật trạng thái hồ sơ.
- **Trạng thái:** ⚠️ Triển khai một phần / Mock UI.

**UC-VIO-03: Theo dõi & Đôn đốc Khắc phục Vi phạm**
- **Actor:** A01, A02, A03
- **Flow:** Thiết lập thời hạn khắc phục kiến nghị; đôn đốc cơ sở thực hiện biện pháp an toàn; ghi nhận kết quả khắc phục từng lỗi vi phạm.
- **Trạng thái:** ⚠️ Triển khai một phần / Mock UI.

**UC-VIO-04: Tạm đình chỉ Hoạt động do Vi phạm Nghiêm trọng**
- **Actor:** A01, A05
- **Flow:** Quyết định tạm đình chỉ từng phần hoặc toàn bộ hoạt động đối với cơ sở có nguy cơ trực tiếp phát sinh cháy nổ nguy hiểm hoặc không chấp hành yêu cầu an toàn.
- **Trạng thái:** ⏳ Chưa test (đã có backend API).

**UC-VIO-05: Phục hồi Hoạt động Cơ sở sau Khắc phục**
- **Actor:** A01, A05
- **Flow:** Đoàn kiểm tra xác nhận cơ sở đã khắc phục hoàn toàn vi phạm → Trình văn bản bằng chứng → Chỉ huy phê duyệt quyết định phục hồi hoạt động cơ sở (restored status).
- **Trạng thái:** ⏳ Chưa test (đã có backend API).

---

### M05 — Văn bản Pháp luật & Quy chuẩn PCCC (3 Use Cases)

**UC-DOC-01: Kho Văn bản & Tra cứu Toàn hệ thống**
- **Actor:** Mọi vai trò
- **Flow:** Truy cập `/van-ban` → Tra cứu văn bản quy phạm pháp luật, TCVN, QCVN theo số hiệu, tên văn bản, cơ quan ban hành, loại văn bản; hỗ trợ tìm kiếm tiếng Việt không dấu (foldSearchText).
- **Trạng thái:** ✅ Đầy đủ + có test (`legal-documents.test.js`).

**UC-DOC-02: Thêm mới & Cập nhật Phiên bản Văn bản**
- **Actor:** A05 (Quản trị hệ thống)
- **Flow:** Đăng tải văn bản mới hoặc cập nhật văn bản thay thế/sửa đổi; kiểm soát xung đột phiên bản qua khóa lạc quan (HTTP 409 `VERSION_CONFLICT`); ghi nhận audit trail.
- **Trạng thái:** ✅ Đầy đủ + có test (`legal-documents.test.js`).

**UC-DOC-03: Xem & Tải Tệp Văn bản PDF**
- **Actor:** Mọi vai trò
- **Flow:** Xem trực tiếp tệp PDF quy chuẩn trên trình duyệt hoặc tải về máy; kiểm tra magic bytes `%PDF-` và `%%EOF` khi upload nhằm ngăn chặn tệp giả mạo.
- **Trạng thái:** ✅ Đầy đủ + có test (`legal-documents.test.js`).

---

### M06 — Công tác Kiểm tra An toàn PCCC (9 Use Cases)

**UC-INS-01: Lập Kế hoạch Kiểm tra Định kỳ & Đột xuất**
- **Actor:** A01, A02
- **Flow:** Lập kế hoạch kiểm tra (theo chuyên đề, ngành nghề kinh doanh có điều kiện, đột xuất) → Chọn danh sách cơ sở kiểm tra → Phân công cán bộ trưởng đoàn/thành viên.
- **Trạng thái:** ✅ Đầy đủ + có test (`inspections.test.js`).

**UC-INS-02: Quản lý Chỉ tiêu Kiểm tra**
- **Actor:** A01, A02
- **Flow:** Giao chỉ tiêu số lượt kiểm tra định kỳ hàng tháng/quý cho từng cán bộ và tổ công tác.
- **Trạng thái:** ⏳ Chưa test (đã có backend API).

**UC-INS-03: Phân công Lịch Kiểm tra Định kỳ**
- **Actor:** A01, A02
- **Flow:** Phân bổ cơ sở kiểm tra định kỳ trong năm theo chu kỳ quản lý (hàng năm hoặc 6 tháng/lần).
- **Trạng thái:** ⏳ Chưa test (đã có backend API).

**UC-INS-04: Điều chỉnh & Dời Lịch Kiểm tra**
- **Actor:** A01, A02
- **Flow:** Yêu cầu điều chỉnh thời gian kiểm tra; bắt buộc nhập lý do dời lịch (R-302); cập nhật thông báo cho cơ sở.
- **Trạng thái:** ⏳ Chưa test (đã có backend API).

**UC-INS-05: Thực hiện Kiểm tra theo Checklist Điện tử**
- **Actor:** A03 (Cán bộ kiểm tra)
- **Flow:** Đăng nhập di động tại hiện trường → Mở cuộc kiểm tra → Đánh giá từng tiêu chí trong checklist: Đạt / Không đạt / Không áp dụng → Nhập ghi chú vi phạm phát hiện.
- **Trạng thái:** ✅ Đầy đủ + có test (`inspections.test.js`).

**UC-INS-06: Quản lý Danh mục Biểu mẫu Checklist**
- **Actor:** A01, A02 (chỉ huy và phó chỉ huy)
- **Flow:** Thiết lập biểu mẫu kiểm tra chuẩn theo từng loại hình cơ sở (karaoke, chung cư, nhà xưởng sản xuất, chợ truyền thống); thêm/sửa tiêu chí kiểm tra.
- **Trạng thái:** ✅ Đầy đủ + có test (`inspections.test.js`).

**UC-INS-07: Đính kèm Biên bản & Hình ảnh Hiện trường**
- **Actor:** A03
- **Flow:** Chụp ảnh hiện trường vi phạm, tải file biên bản kiểm tra có chữ ký hai bên (PDF/ảnh); lưu private storage.
- **Trạng thái:** ✅ Đầy đủ + có test (`inspections.test.js`).

**UC-INS-08: Chốt Kết quả & Ban hành Kết luận Kiểm tra**
- **Actor:** A01, A02
- **Flow:** Rà soát biên bản hiện trường; bắt buộc có đầy đủ đánh giá checklist và biên bản đính kèm mới cho phép đóng cuộc kiểm tra (BR-02); chốt kết luận an toàn.
- **Trạng thái:** ✅ Đầy đủ + có test (`inspections.test.js`).

**UC-INS-09: Theo dõi & Lập Lịch Hậu kiểm (Follow-up)**
- **Actor:** A01, A02, A03
- **Flow:** Tự động tạo nhiệm vụ hậu kiểm đối với các cơ sở có lỗi vi phạm còn thời hạn khắc phục; giám sát tái kiểm tra.
- **Trạng thái:** ✅ Đầy đủ + có test (`inspections.test.js`).

---

### M07 — Lịch công tác - Giao việc - KPI - Giải trình (6 Use Cases)

**UC-WRK-01: Lịch Công tác Hàng ngày & Cảnh báo Quá hạn**
- **Actor:** Mọi vai trò trong phạm vi
- **Flow:** Truy cập `/cong-viec/lich` → Hiển thị 7 ngày liên tiếp từ ngày hiện tại (Hôm nay + 6 ngày kế tiếp) kèm thứ trong tuần và các thẻ việc tương ứng; hiển thị khu vực cảnh báo việc quá hạn (`deadline=overdue`, ranh giới 00:00:00 giờ Việt Nam).
- **Trạng thái:** ✅ Đầy đủ + có test (`m07-e2e.test.js:768`).

**UC-WRK-02: Tạo & Giao việc cho Cán bộ**
- **Actor:** A01, A02, A05 (giao việc); A03, A04 (nhận việc)
- **Flow:** Truy cập `/cong-viec/giao-viec` → Nhấn Giao việc mới → Nhập tiêu đề, mô tả, hạn hoàn thành (`dueDate`), chọn cán bộ nhận trong thẩm quyền scope → Tạo task (201 Created), tạo bản ghi `task_assignments` và audit log.
- **Trạng thái:** ✅ Đầy đủ + có test (`m07-e2e.test.js:70`, `work-kpi.test.js:80`).

**UC-WRK-03: Cập nhật Tiến độ & Hoàn thành Công việc**
- **Actor:** Cán bộ được giao việc (A03, A04); Chỉ huy giao việc (A01, A02)
- **Flow:** Cán bộ thực hiện cập nhật tiến độ (0..100) kèm ghi chú → Lưu lịch sử append-only `task_progress_history`. Tiến độ đạt 100% không tự ý đóng công việc; chỉ người giao việc mới có quyền đổi trạng thái sang `completed` hoặc `cancelled`.
- **Trạng thái:** ✅ Đầy đủ + có test (`m07-e2e.test.js:100-160`, `task-messages.test.js:235`).

**UC-WRK-04: Đánh giá KPI, Chỉ tiêu & Quản lý Nợ Chỉ tiêu Cộng dồn**
- **Actor:** A01, A05 (cấu hình chỉ tiêu); Mọi cán bộ (xem kết quả KPI bản thân)
- **Flow:** Thiết lập chỉ tiêu nhiệm vụ định kỳ tháng; tính điểm KPI tự động theo công thức: `Score = (completed / available) * 100` (với `available = target + previous_debt`). Khi available = 0, mặc định đạt 100%. Điểm bị chặn trần tối đa 100%, nhiệm vụ hoàn thành vượt mức không credit điểm âm cho kỳ sau. Nợ chưa hoàn thành lũy kế sang kỳ tiếp theo.
- **Trạng thái:** ✅ Đầy đủ + có test (`m07-e2e.test.js:166-250`, `work-kpi.test.js:140`).

**UC-WRK-05: Yêu cầu, Phản hồi & Xử lý Giải trình Công việc/KPI**
- **Actor:** A01 (yêu cầu & phê duyệt); Cán bộ bị nợ chỉ tiêu (phản hồi)
- **Flow:** Chỉ huy gửi yêu cầu giải trình cho cán bộ có nợ chỉ tiêu hoặc chậm tiến độ → Cán bộ gửi nội dung giải trình → Chỉ huy duyệt: Nếu `accepted` giải trình định kỳ, hệ thống kích hoạt xóa nợ (`debt_waived=1`) và reset nợ về 0; nếu `rejected`, giữ nguyên nợ.
- **Tồn đọng:** Tính năng đính kèm tệp tài liệu minh chứng trong giải trình chưa triển khai (đề xuất dời sang GĐ2, chờ BA/PO phê duyệt văn bản).
- **Trạng thái:** ⚠️ Chưa test (đã triển khai) — Đã có backend & frontend hoàn chỉnh; còn 3 TC NOT RUN.

**UC-WRK-06: Trao đổi & Nhắn tin theo Công việc (Thread Messaging)**
- **Actor:** Người giao việc và cán bộ được phân công công việc
- **Flow:** Truy cập chi tiết công việc `/cong-viec/giao-viec/[id]` → Trao đổi tin nhắn nội bộ; hiển thị danh sách hội thoại; tác giả có quyền chỉnh sửa hoặc xóa mềm (soft-delete); người không tham gia nhận 404 NOT_FOUND bảo đảm bí mật thông tin.
- **Trạng thái:** ✅ Đầy đủ + có test (`m07-e2e.test.js:358-438`, `task-messages.test.js:80-220`).

---

### M08 — Báo cáo & Quản lý Thời hạn (6 Use Cases)

**UC-RPT-01: Báo cáo Định kỳ (Tháng, Quý, Năm)**
- **Actor:** A01, A04, A05
- **Flow:** Quản lý danh mục báo cáo công tác PCCC & CNCH theo kỳ báo cáo; theo dõi trạng thái soạn thảo, nộp và duyệt.
- **Trạng thái:** ⚠️ Triển khai một phần / Mock UI (API backend đã có tại `reports.test.js`).

**UC-RPT-02: Cảnh báo Thời hạn Nộp Báo cáo (Deadline Alerts)**
- **Actor:** Cán bộ được phân công nộp báo cáo
- **Flow:** Hệ thống cảnh báo tự động khi báo cáo đến hạn hoặc quá hạn nộp; hiển thị trạng thái cảnh báo trên bảng điều hành.
- **Trạng thái:** ⚠️ Triển khai một phần / Mock UI.

**UC-RPT-03: Soạn thảo, Nộp & Đính kèm Báo cáo**
- **Actor:** A04 (Cán bộ tổng hợp)
- **Flow:** Nhập thông tin báo cáo, đính kèm tệp số liệu (Excel, PDF, DOCX); nộp báo cáo lên chỉ huy phê duyệt.
- **Trạng thái:** ⚠️ Triển khai một phần / Mock UI.

**UC-RPT-04: Cấu hình Biểu mẫu Báo cáo Động**
- **Actor:** A05
- **Flow:** Thiết lập các trường chỉ tiêu, biểu mẫu báo cáo thống kê định kỳ phục vụ nhu cầu nghiệp vụ của PC07.
- **Trạng thái:** 📋 Chưa triển khai (Chuyển Giai đoạn 2).

**UC-RPT-05: Quy trình Phê duyệt & Ký số Báo cáo**
- **Actor:** A01 (Chỉ huy)
- **Flow:** Chỉ huy xem xét nội dung báo cáo tổng hợp; duyệt báo cáo hoặc yêu cầu cán bộ hiệu chỉnh số liệu.
- **Trạng thái:** 📋 Chưa triển khai (Chuyển Giai đoạn 2).

**UC-RPT-06: Kết xuất Dữ liệu Báo cáo Thống kê**
- **Actor:** A01, A04, A05
- **Flow:** Kết xuất các mẫu biểu thống kê tổng hợp phục vụ giao ban tháng/quý ra định dạng PDF hoặc Excel chuẩn.
- **Trạng thái:** 📋 Chưa triển khai (Chuyển Giai đoạn 2).

---

### M09 — Sự cố Cháy nổ & Cứu nạn Cứu hộ (3 Use Cases)

**UC-INC-01: Tiếp nhận & Ghi nhận Thông tin Vụ cháy / Sự cố**
- **Actor:** Cán bộ trực ban chỉ huy, A01, A04
- **Flow:** Tiếp nhận tin báo cháy qua điện thoại/hệ thống cảnh báo → Ghi nhận địa điểm, thời gian, loại hình công trình, mức độ thiệt hại sơ bộ.
- **Trạng thái:** ⚠️ Triển khai một phần / Mock UI (API backend đã có tại `incidents.test.js`).

**UC-INC-02: Điều động Lực lượng & Theo dõi Diễn biến Tác chiến**
- **Actor:** A01 (Chỉ huy chữa cháy)
- **Flow:** Điều động phương tiện (xe chữa cháy, xe thang, máy bơm), lực lượng cán bộ chiến sĩ tham gia dập lửa và cứu hộ; cập nhật diễn biến dập tắt đám cháy.
- **Trạng thái:** ⚠️ Triển khai một phần / Mock UI.

**UC-INC-03: Nghiệp vụ Cứu nạn, Cứu hộ Chuyên biệt**
- **Actor:** Lực lượng CNCH chuyên trách
- **Flow:** Ghi nhận và báo cáo các hoạt động tìm kiếm cứu nạn, sự cố sập đổ công trình, cứu nạn dưới nước, trên cao.
- **Trạng thái:** 📋 Chưa triển khai (Chuyển Giai đoạn 2).

---

### M10 — Tra cứu - Dashboard - Giám sát Hệ thống (6 Use Cases)

**UC-SYS-01: Tra cứu Toàn diện Hệ thống theo Phạm vi Scope**
- **Actor:** Mọi cán bộ (theo phạm vi dữ liệu được cấp)
- **Flow:** Thanh tra cứu toàn cục tại header `/api/search?q=...` → Tìm kiếm liên phân hệ (cơ sở, văn bản pháp luật, công việc, kế hoạch kiểm tra); tự động loại bỏ dấu tiếng Việt; tuyệt đối không trả về đối tượng ngoài phạm vi phụ trách của cán bộ.
- **Trạng thái:** ✅ Đầy đủ + có test (`search-dashboard.test.js`).

**UC-SYS-02: Dashboard Thống kê & Điều hành Thời gian thực**
- **Actor:** Lãnh đạo chỉ huy (A01, A02), Cán bộ tổng hợp (A04)
- **Flow:** Truy cập Dashboard trung tâm `/` → Hiển thị các chỉ số đo lường then chốt (KPI): Tổng số cơ sở quản lý, tỷ lệ cơ sở an toàn/vi phạm, số lượt kiểm tra đã hoàn thành, số việc quá hạn, biểu đồ tỷ lệ hoàn thành KPI.
- **Trạng thái:** ✅ Đầy đủ + có test (`search-dashboard.test.js`).

**UC-SYS-03: Cảnh báo & Nhắc việc Tự động**
- **Actor:** Cán bộ nhận nhiệm vụ
- **Flow:** Trung tâm thông báo hiển thị các sự kiện quan trọng: Cơ sở sắp đến hạn kiểm tra định kỳ, công việc giao sắp hết hạn, báo cáo chậm nộp.
- **Trạng thái:** ⚠️ Triển khai một phần / Mock UI.

**UC-SYS-04: Import Dữ liệu Hồ sơ Số hóa Hàng loạt**
- **Actor:** A05
- **Flow:** Công cụ nạp dữ liệu số hóa từ các phần mềm cũ hoặc file dữ liệu lớn vào cơ sở dữ liệu hệ thống mới.
- **Trạng thái:** 📋 Chưa triển khai (Chuyển Giai đoạn 2).

**UC-SYS-05: Nhật ký Hệ thống & Giám sát Thao tác (Audit Trail)**
- **Actor:** A05 (Quản trị hệ thống)
- **Flow:** Truy cập `/quan-tri/nhat-ky` → Xem toàn bộ lịch sử thao tác nhạy cảm (đăng nhập, chuyển giao tài khoản, sửa cơ sở, sửa văn bản, xóa tin nhắn); bảo đảm tính append-only không thể can thiệp.
- **Trạng thái:** ✅ Đầy đủ + có test (`legal-documents.test.js`, `task-messages.test.js`).

**UC-SYS-06: Giao diện Di động & Ứng dụng PWA (Progressive Web App)**
- **Actor:** Cán bộ kiểm tra hiện trường (A03)
- **Flow:** Truy cập trên trình duyệt di động (smartphone màn hình 390px) → Hỗ trợ cài đặt màn hình chính (Add to Home Screen), giao diện responsive thân thiện, cho phép thao tác mượt mà khi kiểm tra ngoài thực địa.
- **Trạng thái:** ✅ Đầy đủ + có test (`mobile-web.test.js`).

---

### M11 — Số hóa & Vận hành Dữ liệu (2 Use Cases)

**UC-SYS-07: Xuất & Chuyển đổi Dữ liệu Phục vụ Nghiệp vụ (Data Transfer)**
- **Actor:** A05
- **Flow:** Hỗ trợ kết xuất dữ liệu quản lý cơ sở, cán bộ, kết quả kiểm tra sang định dạng CSV/JSON chuẩn phục vụ lưu trữ hoặc kết nối liên ngành; kiểm soát nghiêm ngặt thẩm quyền xuất dữ liệu.
- **Trạng thái:** ⚠️ Triển khai một phần (Backend API hoàn thành tại `data-transfer.test.js`).

**UC-SYS-08: Giám sát Hạ tầng & Vận hành Hệ thống Nâng cao**
- **Actor:** Đội ngũ Quản trị hạ tầng
- **Flow:** Bảng điều khiển giám sát hiệu năng máy chủ, dung lượng lưu trữ tệp, trạng thái kết nối cơ sở dữ liệu, sao lưu dữ liệu tự động.
- **Trạng thái:** 📋 Chưa triển khai (Chuyển Giai đoạn 2).

---

## 4. Ma trận Tổng hợp 56 Use Cases theo 11 Phân hệ

| Phân hệ | Tên phân hệ | Tổng số UC | Đầy đủ + có test | Chưa test đủ | Một phần / Mock | Chưa triển khai |
|:---:|---|:---:|:---:|:---:|:---:|:---:|
| **M01** | Quản trị & Phân quyền | 5 | 5 | 0 | 0 | 0 |
| **M02** | Tổ chức - Cán bộ - Địa bàn | 3 | 0 | 0 | 3 | 0 |
| **M03** | Cơ sở & Hồ sơ PCCC | 8 | 5 | 2 | 0 | 1 |
| **M04** | Vi phạm & Khắc phục | 5 | 0 | 2 | 3 | 0 |
| **M05** | Văn bản Pháp luật | 3 | 3 | 0 | 0 | 0 |
| **M06** | Công tác Kiểm tra | 9 | 6 | 3 | 0 | 0 |
| **M07** | Lịch - Việc - KPI - Giải trình | 6 | 5 | 1 | 0 | 0 |
| **M08** | Báo cáo & Deadline | 6 | 0 | 0 | 3 | 3 |
| **M09** | Sự cố Cháy & CNCH | 3 | 0 | 0 | 2 | 1 |
| **M10** | Tra cứu & Dashboard | 6 | 4 | 0 | 1 | 1 |
| **M11** | Số hóa & Vận hành | 2 | 0 | 0 | 1 | 1 |
| **TỔNG** | **Toàn hệ thống (11 Modules)** | **56** | **28 (50.00%)** | **8 (14.29%)** | **13 (23.21%)** | **7 (12.50%)** |

