# Tổng kết DOC/VIO sau sửa lỗi

**Cập nhật 15/11/2026 — STATUS: PARTIAL.** Bốn lỗi đã sửa và retest đạt; còn E2E giao diện chưa hoàn tất và build CLI chưa đạt.

| Hạng mục                          | Kết quả                                                          |
| --------------------------------- | ---------------------------------------------------------------- |
| Test case DOC/VIO                 | **30/30 PASS** sau sửa; trước sửa 26 PASS, 4 FAIL                |
| Toàn bộ backend                   | **170/170 PASS**, bao gồm 7 test hồi quy mới                     |
| Frontend/backend integration      | **1/1 PASS**                                                     |
| Lint / typecheck / backend syntax | PASS                                                             |
| Build                             | Compile/TypeScript đạt; CLI exit 1 ở cảnh báo dependency Next.js |
| E2E UI                            | Chưa hoàn tất; yêu cầu cấp quyền điều khiển trình duyệt hết hạn  |

Môi trường: Windows, Node v22.23.4, PGlite in-memory mới cho từng test, HTTP localhost. Không dùng database thật. Bản sửa trong working tree trên commit nền `942bbabaa658eb6d0c9bd76b0e11b4f215cd598b`, chưa commit.

## Đã xử lý

1. Giữ cơ sở suspended khi còn hồ sơ đình chỉ mở ở một trong hai luồng M03/M04.
2. Chặn sửa quyết định đình chỉ khi hồ sơ completed.
3. Từ chối mã cán bộ không tồn tại khi tạo/cập nhật.
4. Ghi lịch sử cơ sở kèm audit cùng transaction khi đình chỉ/khôi phục.

[Báo cáo retest](Retest_Report.md) có chi tiết thay đổi và link log. [Báo cáo bug](Bug_Report_DOC_VIO.md) giữ bước tái hiện trước sửa. [Bảng test](Test_Cases_DOC_VIO.md) phản ánh lần chạy mới; [baseline JSON](evidence/before-fix/results.json) giữ kết quả cũ.

## Còn lại trước nghiệm thu

- Cấp quyền điều khiển trình duyệt để chạy UI-07..11 theo [báo cáo UI](UI_Test_Report.md), đặc biệt upload, đổi tài khoản, từ chối/gửi lại và reload.
- Xử lý build CLI dừng ở cảnh báo dependency trong nhiệm vụ nâng cấp phù hợp; chưa tự thay dependency.
- Xác nhận mapping từng mã UC-VIO và các quy tắc còn thiếu trong URD; xem [traceability](Traceability.md).
- Review và ghi commit sau khi nhóm chấp nhận; chưa merge/deploy hoặc cập nhật ticket bên ngoài.
