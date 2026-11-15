# Kiểm chứng sửa hồ sơ cơ sở và tra cứu — 15/11/2026

Nhánh: `Khai/fix-bug-facilities-certificates-search`, nền main `b2f425f`.

- BUG-FAC-01: thêm nội dung điều kiện PCCC và PUT `/api/facilities/:id/conditions`, form lưu thật, kiểm quyền/scope, transaction và audit trước/sau. Checklist pháp lý vẫn cần xác nhận theo URD; không tự áp đặt checklist.
- BUG-FAC-02: lưu ngày cấp chứng nhận trong hồ sơ nhân sự; validate ngày tồn tại và thứ tự cấp/hết hạn; hiển thị trạng thái dựa trên hạn nhập tay, ngày Việt Nam. Không nhập hạn thì hiển thị chưa xác định; không tự gán thời hạn pháp lý.
- BUG-SYS-01: kết quả cơ sở trong tra cứu là liên kết đến trang chi tiết có kiểm quyền hiện hành.

## Bằng chứng thực thi

- Formatter, lint, typecheck, backend syntax: PASS.
- Backend tests facilities/profile/search: 17/17 PASS.
- Backend tests history/data-transfer: 8/8 PASS.
- Build: PASS sau chạy lại vì cảnh báo bảo mật từ Next.js 16.4.0.
- Integration auth frontend/backend: 1/1 PASS.
- Migration được thực thi trong fixture PostgreSQL nhúng PGlite cô lập; không migrate database người dùng.
- Full backend suite chạy song song: không hoàn tất do thiếu bộ nhớ PGlite; lượt này đã dừng. Các nhóm liên quan được chạy tuần tự như trên.
- Browser retest production trên PGlite in-memory: **3/3 PASS**. Lưu điều kiện và reload còn dữ liệu; thêm nhân sự có ngày cấp 2025-01-01/hết hạn 2027-12-31 → Còn hạn; sửa hết hạn thành 2025-12-31 rồi reload → Hết hạn. Tra cứu CS001 → bấm kết quả → URL /co-so/CS001 và đúng tiêu đề.
- Đã dừng server QA và xóa fixture tạm; không tác động database người dùng.
- Self-review: kiểm quyền M03.edit/view và scope, audit, validation, migration mới, không sửa migration baseline, giữ file người dùng có sẵn.

## Triển khai

Chạy migration mới qua quy trình triển khai PostgreSQL trước khi đưa code vào vận hành. Không thay đổi cấu hình database hiện có.

## Sửa lỗi bộ nhớ suite và chạy lại

- `pccc-BE/package.json`: giới hạn `--test-concurrency=2` (vẫn chạy song song) thay vì theo số CPU, tránh khởi tạo quá nhiều PGlite/WASM.
- Lượt đầu với 2 worker: 164/165 PASS, không OOM; test bulk Export gặp fetch failed sau 5.001 insert đơn lẻ.
- Fixture bulk đổi sang một INSERT SELECT generate_series, giữ 5.001 hàng và các assertion 413/history rỗng, không retry hoặc bỏ test.
- Lượt cuối `pnpm test`: **165/165 PASS, 0 fail, 0 skipped**, exit code 0, 243.384 giây.
- Formatter, ESLint file test thay đổi, git diff --check: PASS. Không thay đổi mã runtime trong lượt retest này.
