# Tổng kết kiểm thử DOC/VIO

**STATUS: PARTIAL. Chưa xác nhận đủ điều kiện nghiệm thu.** Đã bàn giao test case, kết quả chạy, minh chứng và bug; còn 4 lỗi mở, UI chưa chạy hết và chưa có bản sửa để retest.

## Phiên bản và môi trường

- Repository/commit: `PCCC` / `942bbabaa658eb6d0c9bd76b0e11b4f215cd598b`.
- Checkout ban đầu sạch; không sửa code sản phẩm. Chưa xác nhận đây là HEAD mới nhất của remote main; không fetch/pull hay suy đoán remote.
- Node `v22.23.4`, Windows, HTTP server thật của dự án, PostgreSQL nhúng PGlite `:memory:` mới cho từng case; chạy schema/seed hiện tại.
- M04 test grants: A03 view/create/edit; A01 view/create/edit/approve; A05 view/create/edit/approve. Scope giữ theo seed, có case thu hồi scope/quyền trong database tạm.
- Ngày kiểm thử đầu: 14/11/2026 (giờ Việt Nam). Chạy xác nhận và lập báo cáo tiếp trong phiên ngày 15/11/2026. Thời điểm UTC chính xác từng lần nằm trong JSON minh chứng.
- Không truy cập database thật, không gửi thông báo ra ngoài, không thay cấu hình quyền thật. Không lưu mật khẩu/session cookie vào minh chứng.

## Kết quả

| Hạng mục                   | Kết quả                                                                                 | Bằng chứng                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Bộ QA mới                  | **30 case: 26 PASS, 4 FAIL, 0 BLOCKED** ở lớp HTTP/database                             | [Bảng case](Test_Cases_DOC_VIO.md), [JSON](evidence/results.json), [log](evidence/run.log) |
| Tái hiện trên database mới | Cùng 4 case FAIL: VIO-12, VIO-20, VIO-21, VIO-25                                        | So sánh [lần xác nhận trước](evidence/confirmed-run/results.json) với kết quả hiện tại     |
| Kiểm thử hồi quy có sẵn    | **11/11 PASS**: legal-documents 7 test, facility-history 4 test                         | [TAP](evidence/existing-tests-rerun.tap)                                                   |
| Giao diện                  | 6 bước PASS, 2 BLOCKED, 3 NOT RUN; không coi các bước nhỏ này là 6 luồng E2E hoàn chỉnh | [Báo cáo UI](UI_Test_Report.md)                                                            |
| Retest sau sửa             | **NOT RUN** — chưa có bản sửa                                                           | [Phiếu retest](Bug_Report_DOC_VIO.md)                                                      |

### Luồng nghiệp vụ

- Tạo → phân loại → cập nhật → tìm kiếm → tải PDF văn bản: HTTP PASS; UI tạo/cập nhật/tìm/chi tiết PASS, UI xem nội dung PDF chưa xác minh.
- Vi phạm → đình chỉ → khắc phục → gửi duyệt → phê duyệt: HTTP PASS cho luồng cơ bản, có kiểm cơ sở suspended trước và active sau duyệt.
- Từ chối có lý do → cập nhật → gửi lại → phê duyệt: HTTP PASS, giữ lịch sử trạng thái.
- Trường hợp cơ sở có đình chỉ ở cả hai phân hệ: FAIL, có thể hoạt động lại khi hồ sơ đình chỉ ban đầu chưa đóng.
- Các ca chặn thiếu bằng chứng, thiếu khắc phục, không đủ quyền, duyệt lặp, scope rỗng/ngoài phạm vi và thu hồi quyền đã chạy đạt trong phạm vi test.

## Lỗi cần xử lý

1. **High — BUG-VIO-001:** cơ sở active dù còn hồ sơ đình chỉ mở trong `facility_violations`.
2. **Medium — BUG-VIO-002:** API cho sửa quyết định đình chỉ sau khi hồ sơ completed.
3. **Medium — BUG-VIO-003:** tạo được vi phạm gắn với cán bộ không tồn tại.
4. **Medium — BUG-VIO-004:** đình chỉ từ M04 chưa ghi vào lịch sử trạng thái cơ sở.

Chi tiết điều kiện, request, kỳ vọng, thực tế, source liên quan và kế hoạch retest nằm trong [báo cáo lỗi](Bug_Report_DOC_VIO.md). Mức độ là đề xuất cho nhóm triage; không tự sửa nghiệp vụ trong task QA.

## Nhật ký xử lý lỗi môi trường và test harness

- Lần chạy regression đầu thất bại `fetch failed` do môi trường không cho kết nối localhost; chạy lại với quyền localhost đạt 11/11. Giữ cả [log ban đầu](evidence/existing-tests.tap) và log chạy đạt; không tính lỗi môi trường thành bug sản phẩm.
- Lần đầu runner gửi sai cấu trúc file ở DOC-01: dùng `fileName/mediaType` của API vi phạm thay vì `name` của API văn bản. Đã sửa harness theo contract, chạy lại DOC-01 PASS. [Initial run](evidence/initial-run/results.json) chỉ dùng để truy vết, không cộng vào kết quả cuối.
- Frontend build compile, TypeScript và sinh 45 trang thành công; sau đó CLI kết thúc exit 1 với `SecurityFatalError` cảnh báo dependency Next.js. Chạy lại vẫn exit 1. **Không ghi build PASS.** [Build lần đầu](evidence/build.log), [build lần hai](evidence/build-rerun.log). Cảnh báo là kết quả CLI, chưa được độc lập xác minh trong task này; không tự nâng cấp dependency.
- Artifact build vẫn khởi động được server QA và đã dùng cho các bước UI đã ghi nhận. Điều này không đồng nghĩa build command thành công.
- Hộp thoại `window.prompt` không hiện trong trình duyệt kiểm thử; công cụ sau đó bị ngắt khi chọn tệp upload và không còn khả dụng. Các bước phụ thuộc ghi BLOCKED/NOT RUN, không chuyển sang PASS bằng kết quả API.

## Self-check và phạm vi xác minh

| Gate                                                     | Kết quả                                                               |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| Đọc AGENT/RULES/CHECKLIST, giữ phạm vi QA                | PASS                                                                  |
| Đối chiếu code, route, schema, test và contract          | PASS trong phạm vi khảo sát                                           |
| Formatter tài liệu/script mới                            | Xem `evidence/verification.log`                                       |
| ESLint script QA và Node syntax                          | Xem `evidence/verification.log`                                       |
| TypeScript frontend                                      | PASS ở bước TypeScript của build; không chạy lệnh typecheck độc lập   |
| Build frontend                                           | FAIL ở bước CLI security nudge sau compile; không phải lỗi do code QA |
| Migration/seed                                           | PASS thông qua tạo database mới cho 30 case                           |
| Hồi quy backend liên quan                                | PASS 11/11                                                            |
| Phân quyền/state/audit của sản phẩm                      | PARTIAL — các case có lỗi đã ghi rõ                                   |
| Diff/không đổi code sản phẩm                             | Kiểm cuối; chỉ giữ bộ QA, hoàn nguyên phần tsconfig do Next tự thêm   |
| Full suite, tải, concurrency, staging, PostgreSQL server | NOT RUN; không tuyên bố đã bao phủ                                    |

Chưa có URD để ánh xạ chính xác từng mã UC-VIO-01..05. [Traceability](Traceability.md) chỉ rõ phạm vi đã bao phủ và giả định. Cần đặc tả, bản sửa bốn lỗi, retest và hoàn thành E2E trình duyệt trước khi ký xác nhận toàn bộ nhiệm vụ.
