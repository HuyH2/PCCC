# Kho văn bản và nhật ký — UC-DOC-01, UC-DOC-02, UC-SYS-05

Triển khai trên backend Node.js/SQLite hiện có. Không dùng biến PostgreSQL để chuyển database.
Frontend: `/van-ban`, `/van-ban/them`, `/van-ban/[id]`, `/van-ban/[id]/sua`, `/quan-tri/nhat-ky`.

## Khởi chạy và quyền

Tại root repository, với Node.js >= 22.13.0 và `.env` đã cấu hình:

```powershell
npm --prefix Backend run migrate
npm --prefix Backend run seed
npm --prefix Backend run dev
# Terminal khác
npm run dev
```

Chỉ seed trên database demo/local. Migration `004-legal-documents-audit.sql` mở rộng bảng audit
hiện có, giữ nguyên log cũ và trigger append-only; tạo hai bảng kho văn bản. Không sửa migration cũ.
Migration forward-only; nếu cần rollback ứng dụng, giữ các bảng/cột bổ sung và khôi phục phiên bản
ứng dụng tương thích. Không xóa bảng hay audit để rollback; thay đổi schema tiếp theo dùng migration mới.
Các script migration cần được chạy trong cửa sổ bảo trì phù hợp và có backup trước khi áp dụng dữ liệu thật.

Seed tạo 6 loại và 6 văn bản **giả lập, không có giá trị pháp lý**, dùng link `example.org` để minh họa.
Seed không ghi đè văn bản đã có, mật khẩu, scope hoặc grants đã được quản trị cấu hình.

- Đọc kho chung, danh mục, chi tiết, file và lịch sử: `M05.view` + scope không rỗng.
- Tạo: `M05.view` + `M05.create` + scope `all`.
- Sửa, phân loại, thay file: `M05.view` + `M05.edit` + scope `all`.
- Nhật ký toàn hệ thống: giữ quy tắc hiện có `A05` + `M01.view` + scope `all`.
- Khi seed database mới, A01–A06 có quyền đọc M05, A05 có thêm quyền tạo/sửa. Đây là cấu hình demo,
  không phải ma trận Q02 chính thức. **Database đã có tài khoản không tự được mở rộng quyền**:
  quản trị vào `/quan-tri/vai-tro` cấp các quyền M05 cần thiết, bảo toàn grants hiện có.

Kho văn bản pháp luật được xem là danh mục dùng chung toàn hệ thống, không thuộc riêng một cơ sở.
Do đó scope địa bàn cho phép đọc kho chung, nhưng mutation kho chung đòi scope toàn hệ thống.
Không áp dụng quy tắc này cho dữ liệu nghiệp vụ khác; nếu cần kho riêng từng đơn vị phải thiết kế
ownership và bộ lọc scope tương ứng trước khi mở rộng.

## Schema và dữ liệu

- `legal_document_categories`: `id`, `name` duy nhất.
- `legal_documents`: loại, tên/trích yếu, số/ký hiệu duy nhất không phân biệt hoa thường, cơ quan,
  ngày ban hành tùy chọn, ngày hiệu lực, trạng thái, link, metadata và nội dung PDF, ghi chú,
  người tạo/cập nhật, timestamp epoch milliseconds và `version`.
- `status`: `pending` (chưa hiệu lực), `effective` (còn hiệu lực), `expired` (hết hiệu lực).
  Người có quyền quản lý trạng thái; không suy diễn hay tự xác nhận hiệu lực pháp lý theo ngày.
- Phải có link HTTP/HTTPS hoặc file PDF; có thể giữ cả hai. Link không được có credential;
  backend không fetch URL bên ngoài. File được lưu BLOB trong SQLite, không đặt vào `public/`.
- File PDF mặc định tối đa 5 MB. `LEGAL_DOCUMENT_MAX_BYTES` trong `Backend/.env` cho phép giảm giới hạn
  (1024–5242880 bytes); frontend lấy giới hạn từ API danh mục. Kiểm tên/đuôi, header `%PDF-`, dấu kết thúc `%%EOF`. Đây là kiểm tra
  định dạng cơ bản, không phải quét malware hay xác nhận nội dung pháp lý. API tải dạng attachment,
  có authentication/authorization, `nosniff`, `no-store` và CSP sandbox.
- Update yêu cầu version hiện tại. Xung đột trả `409 VERSION_CONFLICT`, người dùng cần tải lại trang.
  Thay file qua form cũng tăng version; không xóa lịch sử cũ. Audit lưu metadata trước/sau, không lưu
  bản sao nội dung file. Bản PDF cũ không được lưu phiên bản riêng trong phạm vi này.
- Không có API xóa văn bản, category hoặc audit. Phân loại lại bằng cập nhật `category_id`.

## API

Các API yêu cầu cookie `pccc_session`; mutation cần `Origin` khớp `APP_ORIGIN`.
JSON dùng `Content-Type: application/json`. Lỗi theo `{ error: { code, message } }` hiện có.

| Method | Endpoint                           | Nội dung                                            |
| ------ | ---------------------------------- | --------------------------------------------------- |
| GET    | `/api/legal-document-categories`   | Danh mục loại; `{ items }`                          |
| GET    | `/api/legal-documents`             | `q`, `categoryId`, `status`, `page`, `pageSize`     |
| POST   | `/api/legal-documents`             | Tạo; trả `201 { document }`                         |
| GET    | `/api/legal-documents/:id`         | Chi tiết `{ document }`                             |
| PUT    | `/api/legal-documents/:id`         | Cập nhật đầy đủ trường và `version`; `{ document }` |
| GET    | `/api/legal-documents/:id/file`    | Tải PDF có kiểm quyền; 404 nếu chỉ có link          |
| POST   | `/api/legal-documents/:id/file`    | Thay file bằng binary `application/pdf`             |
| GET    | `/api/legal-documents/:id/history` | Lịch sử văn bản, `page`, `pageSize`                 |
| GET    | `/api/audit-logs`                  | Nhật ký hệ thống với các filter bên dưới            |

Danh sách trả `{ items, total, page, pageSize }`, mặc định 20 dòng, tối đa 100.
Tìm kiếm tên/số ký hiệu không phân biệt hoa thường và dấu tiếng Việt.

Ví dụ JSON tạo (thêm `version` lấy từ detail khi PUT):

```json
{
  "category_id": "law",
  "title": "Văn bản minh họa (dữ liệu mẫu)",
  "reference_number": "MAU-TEST/2026",
  "issuing_authority": "Cơ quan giả lập",
  "issued_date": "2026-01-01",
  "effective_date": "2026-02-01",
  "status": "pending",
  "source_url": "https://example.org/",
  "notes": "Không có giá trị pháp lý."
}
```

Để tải file ngay khi tạo hoặc thay file trong form, JSON có thể thêm
`file: { name: "tai-lieu.pdf", contentBase64: "..." }` (chuỗi base64 chuẩn, bỏ prefix data URL).
Để giữ file đã có khi cập nhật, bỏ trường `file`. API binary thay file riêng dùng:
`X-File-Name` (tên đã encodeURIComponent) và `X-Document-Version` (version hiện tại).

Filter audit: `actorId`, `feature`, `action`, `objectType`, `objectId`, `from`, `to`, `page`, `pageSize`.
`from`/`to` là ISO 8601 có múi giờ, cận bao gồm; URL-encode giá trị.
Ví dụ: `?feature=M05&action=legal_document.updated&actorId=DEMO-A05`.
Các giá trị feature sẵn có: `M05`, `M01.auth`, `M01.authorization`; feature khác có thể do module khác ghi.
UI chuyển thời gian nhập theo múi giờ thiết bị sang ISO; kết quả hiển thị theo giờ Việt Nam.
Log cũ được phân loại từ action khi đọc, không sửa nội dung audit lịch sử.

## Service audit dùng chung

`Backend/src/audit.js` export `writeAudit` và wrapper `audit` tương thích module auth cũ.
Gọi service bằng principal đã được backend xác thực và snapshot nghiệp vụ đã chọn lọc:

```js
transaction(db, () => {
  // Kiểm quyền và thực hiện mutation, lấy before/after từ database.
  writeAudit(db, {
    actorId: principal.id,
    feature: "M05",
    objectType: "legal_document",
    objectId: document.id,
    action: "legal_document.updated",
    before,
    after,
    ip,
  });
});
```

Ghi log cùng transaction với mutation; lỗi audit phải rollback mutation. Không truyền nguyên request,
password, token, cookie, file binary hoặc secret vào snapshot. Writer loại bỏ các key nhạy cảm phổ biến
để phòng vệ bổ sung; caller vẫn chịu trách nhiệm chọn dữ liệu được phép ghi. Audit không có API ghi
tùy ý từ browser. Nhật ký văn bản chỉ trả history của văn bản mà người đọc có quyền truy cập;
snapshot auth/quyền chỉ được xem ở màn hình quản trị.

## Kiểm thử

```powershell
npm test
npm --prefix Backend run check
npm run lint
npm run typecheck
npm run build
npm run test:integration
```

Integration cần cổng 4000 và 3100 trống, dùng SQLite in-memory. Không dừng server của người dùng.
Nếu các cổng mặc định đang được sử dụng, chọn cổng riêng và build đúng backend URL trước khi test:

```powershell
$env:BACKEND_URL = "http://127.0.0.1:4100"
$env:PCCC_TEST_BACKEND_PORT = "4100"
$env:PCCC_TEST_FRONTEND_PORT = "3200"
npm run build -- --webpack
npm run test:integration
Remove-Item Env:BACKEND_URL, Env:PCCC_TEST_BACKEND_PORT, Env:PCCC_TEST_FRONTEND_PORT
```

Các biến trên chỉ áp dụng cho terminal kiểm thử. Build lại với `BACKEND_URL` sử dụng thực tế trước
khi dùng artifact đó để chạy ứng dụng, vì rewrite API được ghi vào bản build.
`Backend/test/legal-documents.test.js` kiểm tra nâng cấp DB cũ, seed, permission/scope, validation,
search/filter/pagination, version conflict, PDF và audit atomicity/append-only/redaction.

### Kết quả kiểm chứng ngày 16/10/2026

- Backend: 32/32 test PASS, gồm nâng cấp DB cũ, auth/search/dashboard hồi quy và kho văn bản/audit mới.
- Production integration: 1/1 PASS trên cổng riêng 4100/3200, bao gồm tạo/sửa, file PDF qua rewrite,
  trang chi tiết/form, history và chặn truy cập không có quyền.
- ESLint, TypeScript, backend syntax và `git diff --check`: PASS.
- Build bằng `npm run build -- --webpack`: PASS. Turbopack mặc định gặp lỗi tạo tiến trình trong
  môi trường kiểm tra; lần build sandbox còn bị chặn tải font. Không thay bundler mặc định của dự án.
- Prettier kiểm phạm vi script và file mới với `--end-of-line auto`: PASS. Lệnh `format:check`
  mặc định báo các file cũ dùng CRLF; không reformat các file ngoài phạm vi để đổi kiểu xuống dòng.
- Chrome trên môi trường in-memory: tạo văn bản, sửa loại/trạng thái, xem history/audit, tìm kiếm
  kết hợp loại/trạng thái và lọc audit M05. Viewport 390px không tràn chiều ngang; không có lỗi console
  trên màn hình đã kiểm tra. Không dùng database thật hoặc dừng server của người dùng.
- Self-check: phạm vi yêu cầu, permission/scope, validation, audit nguyên tử và hồi quy PASS.
  Quét malware đầy đủ, lưu nội dung các phiên bản PDF cũ và triển khai production không thuộc phạm vi.
