# Báo cáo lỗi và retest DOC/VIO

Phiên bản: `942bbabaa658eb6d0c9bd76b0e11b4f215cd598b`. Database thử: PostgreSQL nhúng PGlite, schema từ migration hiện tại. Dữ liệu hoàn toàn giả lập. Các lỗi dưới đây tái hiện bằng HTTP trên database mới, không phải kết luận chỉ từ đọc code.

**Cập nhật 15/11/2026: cả 4 lỗi đã FIXED và retest HTTP PASS trên working tree chưa commit.** Xem [báo cáo retest](Retest_Report.md). Các mô tả, số dòng source và kết quả thực tế dưới đây là **baseline trước sửa**, giữ lại để truy vết; liên kết JSON trong các mô tả trỏ đến `evidence/before-fix`.

| Bug         | Mức độ đề xuất | Test   | Kết quả thực tế                                              |
| ----------- | -------------- | ------ | ------------------------------------------------------------ |
| BUG-VIO-001 | High           | VIO-25 | Cơ sở hoạt động lại dù còn hồ sơ đình chỉ mở ở phân hệ cơ sở |
| BUG-VIO-002 | Medium         | VIO-12 | Sửa được quyết định đình chỉ của hồ sơ đã hoàn thành         |
| BUG-VIO-003 | Medium         | VIO-20 | Lưu được cán bộ theo dõi không tồn tại                       |
| BUG-VIO-004 | Medium         | VIO-21 | Đình chỉ từ M04 không bổ sung lịch sử trạng thái cơ sở       |

## BUG-VIO-001 — Khôi phục cơ sở khi còn hồ sơ đình chỉ chưa đóng

**Căn cứ:** yêu cầu đồng bộ trạng thái hồ sơ/cơ sở, BR-09 và RULES R-303.

Điều kiện: CS001 đang active; admin có quyền đổi trạng thái cơ sở; cán bộ có M04.view/create/edit, chỉ huy có M04.approve và scope CS001. Đây là cấu hình fixture, không phải đề xuất ma trận quyền chính thức.

1. Admin gọi `PUT /api/facilities/CS001/status` với `status=suspended`, lý do và `decisionReference=TEST_LEGACY_QD`.
2. Cán bộ tạo vi phạm CS001 qua `POST /api/violations`.
3. Lập thêm quyết định đình chỉ qua `POST /api/violations/:id/suspension`.
4. Thêm khắc phục, upload PDF và gửi duyệt.
5. Chỉ huy gọi `POST /api/violations/:id/approve`.
6. Đọc `GET /api/facilities/CS001/status`, đối chiếu bảng `facility_violations`.

**Kỳ vọng:** cơ sở vẫn suspended khi hồ sơ đình chỉ ban đầu còn mở; không để hai luồng quản lý cho kết quả mâu thuẫn.

**Thực tế:** API trả cơ sở **active**; `facility_violations` vẫn có **1** hồ sơ `suspended`. Chỉ hồ sơ M04 mới được phê duyệt.

**Ảnh hưởng:** trạng thái hoạt động hiển thị không phản ánh đầy đủ quyết định đình chỉ đang còn hiệu lực trong hệ thống.

Minh chứng: [request/response VIO-25](evidence/before-fix/VIO-25.json). Runner xác minh thêm số hồ sơ mở bằng SQL; trace HTTP lưu phản hồi active cuối cùng.

Điểm cần rà: `pccc-BE/src/core/violations.js`, `createSuspension` dòng 474–486 chuyển trạng thái trước đó suspended thành active; `decideApproval` dòng 808–817 chỉ xét các bảng `suspensions/violations`, chưa xét hồ sơ trong `facility_violations`. Đây là nhận định từ đọc code hỗ trợ kết quả runtime.

**Retest sau sửa:** chạy VIO-25 và VIO-19; kiểm cả hai thứ tự tạo đình chỉ, duyệt từng hồ sơ, hồ sơ đã đóng, cơ sở trước đình chỉ là paused/unlicensed; chỉ khôi phục khi mọi điều kiện đã thỏa. Không tự quy định cách hợp nhất hồ sơ nếu nghiệp vụ chưa chốt.

## BUG-VIO-002 — Sửa quyết định đình chỉ sau khi hồ sơ hoàn thành

**Căn cứ:** yêu cầu kiểm tra thao tác hồ sơ đã đóng và RULES R-205.

1. Tạo vi phạm, đình chỉ, thêm khắc phục/PDF, gửi duyệt.
2. Chỉ huy phê duyệt; xác nhận hồ sơ completed.
3. Cán bộ gọi `PUT /api/violations/:id/suspension` với `decisionNumber=TEST_CHANGED_AFTER_CLOSE`.

**Kỳ vọng:** chặn sửa thông thường khi hồ sơ đã đóng (409); nếu cần hiệu chỉnh phải có quy trình được xác nhận riêng.

**Thực tế:** trả **200**, response chứa số quyết định mới. API sửa vi phạm, thêm khắc phục và upload ở cùng trạng thái đã chặn đúng, nhưng sửa quyết định chưa chặn.

**Ảnh hưởng:** có thể thay đổi thông tin quyết định thuộc hồ sơ đã được phê duyệt bằng quyền edit thông thường. Không kết luận mất audit: thao tác vẫn gọi audit.

Minh chứng: [VIO-12](evidence/before-fix/VIO-12.json); đối chứng [VIO-11](evidence/before-fix/VIO-11.json). Điểm rà: `updateSuspension`, `pccc-BE/src/core/violations.js:511`, đọc hồ sơ nhưng chưa kiểm trạng thái completed.

**Retest sau sửa:** VIO-12 phải 409 và đọc lại quyết định cũ không đổi; VIO-11 vẫn đạt. Kiểm sửa hợp lệ ở trạng thái được phép không bị chặn nhầm. Nếu nhóm chủ đích cho hiệu chỉnh sau đóng, cần xác nhận yêu cầu, quyền và lịch sử thay vì tự đổi kỳ vọng.

## BUG-VIO-003 — Chấp nhận cán bộ không tồn tại

**Căn cứ:** yêu cầu toàn vẹn dữ liệu/validate tham chiếu trong AGENT.md §6.2, RULES R-402/R-501.

1. Cán bộ có quyền tạo hồ sơ cho CS001.
2. POST dữ liệu hợp lệ nhưng `trackedOfficerId=TEST-NO-SUCH-OFFICER`.
3. Kiểm response.

**Kỳ vọng:** 400 hoặc 404, không tạo hồ sơ có tham chiếu cán bộ không hợp lệ.

**Thực tế:** **201** và hồ sơ lưu nguyên chuỗi mã không tồn tại.

**Ảnh hưởng:** phân công theo dõi không gắn với cán bộ thật; sai dữ liệu tra cứu/phụ trách.

Minh chứng: [VIO-20](evidence/before-fix/VIO-20.json). Điểm rà: `parseViolation` chỉ kiểm chuỗi tại `pccc-BE/src/core/violations.js:106`; `createViolation` không kiểm tồn tại cán bộ. Cột `violations.tracked_officer_id` trong baseline là TEXT NOT NULL, chưa có FK.

**Retest sau sửa:** VIO-20; thêm cập nhật sang cán bộ không tồn tại, cán bộ hợp lệ và phạm vi theo quy tắc đã xác nhận. Cần giữ test cho create lẫn update.

## BUG-VIO-004 — Thiếu lịch sử trạng thái cơ sở khi đình chỉ từ M04

**Căn cứ:** yêu cầu đồng bộ dữ liệu và kiểm lịch sử; BR-03, RULES R-201.

1. GET `/api/facilities/CS001/status-history`: total 0 trong fixture mới.
2. Tạo vi phạm rồi POST quyết định đình chỉ qua API M04.
3. GET lại lịch sử trạng thái cơ sở.

**Kỳ vọng:** có thêm sự kiện active → suspended, với người thực hiện và thời gian.

**Thực tế:** **total vẫn 0**, items rỗng. Trạng thái cơ sở đã đổi qua M04 nhưng không xuất hiện ở lịch sử cơ sở. Không kết luận toàn bộ hệ thống không có audit: M04 có audit riêng.

Minh chứng: [VIO-21](evidence/before-fix/VIO-21.json). Điểm rà: `createSuspension` cập nhật `facilities` tại `pccc-BE/src/core/violations.js:491` nhưng không ghi `facility_status_history`; API lịch sử cơ sở đọc bảng này trong `facility-history.service.js:111`.

**Retest sau sửa:** VIO-21; kiểm cả đình chỉ và khôi phục sau duyệt, actor/timestamp/trước-sau, không nhân đôi lịch sử khi gọi lại, rollback đầy đủ nếu ghi audit lỗi.

## Phiếu retest

| Bug         | Người sửa / commit sửa | Trạng thái retest     | Điều kiện đóng                                                                   |
| ----------- | ---------------------- | --------------------- | -------------------------------------------------------------------------------- |
| BUG-VIO-001 | Codex / working tree   | PASS API + regression | Không khôi phục khi còn đình chỉ mở; các luồng đình chỉ đơn/nhiều hồ sơ vẫn đúng |
| BUG-VIO-002 | Codex / working tree   | PASS API + regression | Chặn sửa trái trạng thái, dữ liệu cũ giữ nguyên                                  |
| BUG-VIO-003 | Codex / working tree   | PASS API + regression | Create/update từ chối cán bộ không tồn tại                                       |
| BUG-VIO-004 | Codex / working tree   | PASS API + regression | Lịch sử cơ sở phản ánh đình chỉ/khôi phục với đủ thông tin                       |
