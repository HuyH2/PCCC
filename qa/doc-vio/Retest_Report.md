# Retest và sửa lỗi DOC/VIO — 15/11/2026

**Bốn lỗi đã sửa, retest đạt. Trạng thái nhiệm vụ tổng thể: PARTIAL** vì còn E2E giao diện và build CLI chưa đạt.

Phiên bản kiểm thử: working tree chứa bản sửa trên commit nền `942bbabaa658eb6d0c9bd76b0e11b4f215cd598b`, **chưa commit**. Trường commit trong results.json là commit nền, không phải commit mới. Bản diff và SHA-256 các file được lưu trong `evidence/fix.patch` và `evidence/source-sha256.json` để xác định mã đã kiểm thử.

## Bản sửa và retest

| Lỗi         | Bản sửa                                                                                                                                       | Minh chứng                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| BUG-VIO-001 | M04 kiểm cả đình chỉ M03 trước khi khôi phục; M03 trả 409 OPEN_SUSPENSION nếu còn đình chỉ M04 chưa hoàn tất. Không tự đóng hồ sơ luồng khác. | [VIO-25](evidence/VIO-25.json); regression kiểm hai chiều, duyệt M04 rồi duyệt M03 mới active               |
| BUG-VIO-002 | updateSuspension từ chối completed với 409 INVALID_STATE                                                                                      | [VIO-12](evidence/VIO-12.json); regression đọc lại quyết định/số audit không đổi                            |
| BUG-VIO-003 | Create và update trackedOfficerId kiểm tồn tại trong officers; trả 400 INVALID_OFFICER                                                        | [VIO-20](evidence/VIO-20.json); regression kiểm create/update và cán bộ hợp lệ                              |
| BUG-VIO-004 | M04 ghi facility_status_history cùng audit trong transaction, chỉ ghi khi thực sự đổi trạng thái                                              | [VIO-21](evidence/VIO-21.json); regression kiểm đình chỉ/khôi phục, actor/timestamp, rollback khi audit lỗi |

Truy vấn lấy trạng thái trước đình chỉ cũng chỉ xét hồ sơ chưa đóng: chu kỳ mới không lấy trạng thái active của hồ sơ đã hoàn thành từ trước. Regression xác minh khôi phục paused/unlicensed và giữ suspended khi còn hồ sơ M04 khác.

Không đổi quyền, không migration, không sửa dữ liệu thật. Không tự sửa mã cán bộ không hợp lệ đã tồn tại; bản sửa kiểm đầu vào khi tạo hoặc đổi mã cán bộ. Không tự chốt phạm vi cán bộ theo dõi khi đặc tả chưa xác nhận.

## Kết quả thực thi

| Kiểm tra                       | Kết quả                                                                                                   | Log                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 30 case DOC/VIO                | **30 PASS, 0 FAIL**                                                                                       | [retest](evidence/retest.log), [JSON](evidence/results.json) |
| Hồi quy tập trung              | **18/18 PASS**, gồm 7 test mới và 11 test cũ                                                              | [TAP](evidence/regression-after-fix.tap)                     |
| Toàn bộ backend, concurrency 2 | **170/170 PASS**, đã bao gồm 18 test trên                                                                 | [TAP](evidence/full-backend-after-fix.tap)                   |
| Frontend/backend integration   | **1/1 PASS**, suite có sẵn auth/proxy và kho văn bản                                                      | [TAP](evidence/frontend-integration-after-fix.tap)           |
| pnpm lint                      | PASS                                                                                                      | [Log](evidence/lint-after-fix.log)                           |
| pnpm typecheck                 | PASS                                                                                                      | [Log](evidence/typecheck-after-fix.log)                      |
| pnpm check                     | PASS                                                                                                      | [Log](evidence/check-after-fix.log)                          |
| Formatter/diff                 | Xem kiểm chứng cuối                                                                                       | [Log](evidence/verification-after-fix.log)                   |
| Frontend build                 | Compile/TypeScript/sinh trang thành công; CLI **exit 1 SecurityFatalError** ở cảnh báo dependency Next.js | [Log](evidence/build-after-fix.log)                          |

Artifact build khởi động được và đã dùng cho integration; không lấy điều đó để ghi build command PASS. Không nâng cấp dependency ngoài phạm vi hoặc bỏ qua cảnh báo để làm build đạt.

## UI còn thiếu

Đã thử điều khiển Windows bằng skill computer-use mới. list_apps hoạt động; khi chọn cửa sổ Cốc Cốc để đọc trạng thái, công cụ trả **Computer Use app approval timed out**. Không có click/nhập liệu nghiệp vụ mới hoặc minh chứng mới để nâng các bước UI cũ lên PASS.

Cần cấp quyền truy cập cửa sổ trình duyệt rồi tiếp tục UI-07..11 trong [báo cáo UI](UI_Test_Report.md): đình chỉ, upload, khắc phục, đổi tài khoản duyệt/từ chối và reload. Bằng chứng UI cũ không phải kết quả chạy lại trên bản sửa.

## Self-check

- Giữ phạm vi bốn lỗi, quyền/scope cũ, dữ liệu thật và các assertion ban đầu.
- Có test rollback audit, nhiều hồ sơ/chu kỳ đình chỉ, create/update cán bộ và hồ sơ đã đóng.
- Baseline JSON giữ trong `evidence/before-fix`; kết quả mới có thời điểm thực thi riêng.
- Chưa xác nhận URD chi tiết từng mã UC-VIO, chưa thử PostgreSQL server thật hoặc concurrent production.
- Chưa đủ điều kiện ký nghiệm thu UI toàn bộ; không ghi DONE cho toàn nhiệm vụ.
