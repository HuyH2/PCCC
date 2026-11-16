# Bàn giao kiểm thử văn bản, vi phạm và khắc phục

**Trạng thái nghiệm thu: PARTIAL — chưa đủ điều kiện xác nhận toàn bộ nghiệp vụ ổn định.**

Bộ test hiện có 34 case HTTP. Kết quả review code ngày 16/11 xem [Review_16_11.md](Review_16_11.md). Excel và minh chứng thủ công mới nhất nằm trong [handoff](handoff/README.md). Các báo cáo ngày 14–15/11 bên dưới là lịch sử, không phải kết quả của lần chạy mới.

## Tài liệu bàn giao

- [Báo cáo tổng kết](Test_Summary_DOC_VIO.md): môi trường, kết quả, giới hạn và việc còn lại.
- [34 test case và kết quả](Test_Cases_DOC_VIO.md): bước chạy, kỳ vọng và link request/response cho từng trường hợp.
- [Báo cáo lỗi và kế hoạch retest](Bug_Report_DOC_VIO.md): 4 lỗi tái hiện được, mức độ ảnh hưởng và tiêu chí xác minh bản sửa.
- [Kiểm thử giao diện](UI_Test_Report.md): các bước thực hiện thật và ảnh minh chứng.
- [Đối chiếu phạm vi UC](Traceability.md): bao phủ nhóm yêu cầu, phần chưa xác nhận.
- [Kết quả máy đọc được](evidence/results.json), [log retest](evidence/retest.log).

## Chạy lại

### Đọc và sửa code test

- `document-cases.mjs`: 4 test văn bản DOC-01 đến DOC-04.
- `violation-cases.mjs`: 30 test vi phạm VIO-01 đến VIO-30.
- `test-data.mjs`: payload và PDF giả lập dùng chung.
- `test-context.mjs`: tạo database tạm, đăng nhập, gửi HTTP và dọn tài nguyên.
- `run.mjs`: chạy các case và ghi báo cáo/minh chứng; không chứa logic nghiệp vụ của từng test.

Mỗi case có các trường `id`, `uc`, `title`, `steps`, `expected` và `run`.
Đọc `steps` và `expected` trước khi đọc các thao tác trong `run(context)`.
`context.request` trả HTTP status và body để kiểm tra lỗi;
`context.requestSuccess` kiểm tra status mong đợi rồi trả body.
`context.prepareRemediationCase` tạo vi phạm, đình chỉ, thêm khắc phục/bằng chứng và gửi duyệt;
case kiểm dữ liệu thiếu có thể tắt từng bước bằng `suspend`, `upload`, `submit`.

### Lệnh thực thi

Tại root `PCCC`, dùng dependency hiện có và Node >= 22.13.0:

```powershell
node qa/doc-vio/run.mjs
node --test --test-reporter=tap pccc-BE/test/legal-documents.test.js pccc-BE/test/facility-history.test.js
```

Runner mở HTTP trên cổng localhost tự chọn, tạo PGlite in-memory mới cho **mỗi test**, chạy migration/seed của repository rồi đóng server/database. Nó từ chối chạy nếu có `PCCC_TEST_DATABASE_URL`; không đọc `.env`. Không cần chạy migrate/seed vào database của bạn. Sandbox cần cho phép kết nối localhost, nếu không `fetch` sẽ thất bại trước nghiệp vụ.

Sau bản sửa, runner trả exit code 0 khi cả 34 case đạt. Không đổi assertion để làm test xanh. Lần chạy sẽ ghi lại các JSON và bảng test case; sao lưu `evidence` trước nếu cần giữ lịch sử. Không chạy hai runner cùng lúc vì chúng ghi cùng tên tệp.

### Giao diện QA riêng

```powershell
$env:NEXT_TEST_DIST_DIR = '.next-doc-vio'
$env:BACKEND_URL = 'http://127.0.0.1:4217'
pnpm --filter pccc-fe exec next build --webpack
node qa/doc-vio/serve.mjs
```

Chỉ dùng cổng 3217/4217 khi trống; không dừng server khác để lấy cổng. `serve.mjs` cấp mật khẩu ngẫu nhiên dùng chung cho tài khoản demo trong database tạm, in ra terminal và không lưu vào minh chứng. Mở `http://127.0.0.1:3217`; dùng `demo.chi-huy` hoặc `demo.can-bo`. Gõ một dòng vào terminal hoặc Ctrl+C để đóng fixture. Dữ liệu tạm không còn sau khi tắt.

Build Next có thể thêm đường dẫn QA vào `pccc-FE/tsconfig.json`; rà diff sau chạy. Thư mục `.next-doc-vio` là artifact tạm, không commit. Chạy lệnh trên trong terminal riêng để các biến môi trường QA không ảnh hưởng công việc khác.

## Điều kiện đóng nhiệm vụ

1. Review bản sửa đã retest; ghi commit sau khi nhóm chấp nhận. Kết quả trước sửa được giữ trong `evidence/before-fix`.
2. Chạy hết 4 luồng E2E bằng trình duyệt có hỗ trợ hộp thoại `window.prompt` và upload; đặc biệt đổi tài khoản cán bộ → chỉ huy.
3. Bổ sung đặc tả UC để xác nhận chính xác ánh xạ UC-VIO-01..05, quy tắc bằng chứng và liên kết hồ sơ kiểm tra.
4. Ghi nhận người xác nhận nghiệm thu, phiên bản và lỗi được chấp nhận còn tồn tại (nếu có).
