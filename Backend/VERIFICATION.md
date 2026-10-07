# Kết quả kiểm tra Authentication và Authorization

## Khôi phục UI nghiệp vụ theo yêu cầu

Đã đưa sidebar và cây điều hướng về nguyên bản, giữ nguyên dashboard `/`, trang `/co-so` và các màn hình nghiệp vụ. Các đường dẫn rút gọn chuyển về trang gốc; giữ session, nút bỏ qua đổi mật khẩu và kiểm tra quyền trên API/trang cấu hình phân quyền. UI nghiệp vụ vẫn dùng dữ liệu mẫu ban đầu, chưa phải dữ liệu API có scope.

Kiểm tra lần cập nhật này: lint, typecheck, build, backend check và 18/18 test backend PASS. Kiểm tra HTTP trên frontend đang chạy: đăng nhập A01 về `/`; `/`, `/co-so`, `/tra-cuu` trả 200 và có đầy đủ menu; `/du-lieu/co-so` chuyển về `/co-so`; A01 vào trang cấu hình phân quyền vẫn bị từ chối. Test production integration đã cập nhật nhưng không chạy được vì cổng backend 4000 đang được server người dùng sử dụng (EADDRINUSE). Các kết quả browser/integration bên dưới là kết quả trước lần khôi phục này.

## Cập nhật nút bỏ qua đổi mật khẩu

Theo yêu cầu mới, người dùng có thể chọn **Bỏ qua, đổi sau**. Endpoint chỉ tác động tài khoản trong session, giữ nguyên mật khẩu/quyền/phạm vi, lưu lựa chọn và ghi audit một lần. Đã chạy 18/18 test backend (bao gồm skip, idempotency, session, CSRF, tài khoản khóa và không ảnh hưởng tài khoản khác), formatter, lint, typecheck và build: PASS. Trang đổi mật khẩu trên frontend đang chạy đã kiểm tra có nút mới. Test production integration đã bổ sung luồng skip nhưng chưa chạy lại trong lần cập nhật này vì backend người dùng đang sử dụng cổng 4000; không dừng server của người dùng để chạy test.

Phạm vi: UC-ADM-01 và UC-ADM-03 trong môi trường đồ án; Node.js 22.20, Next.js 16.4.0, SQLite. Đã đọc AGENT.md, RULES.md, CHECKLIST.md, URD v1.0 và hình sequence ADM-01.

| Kiểm tra                                                             | Kết quả                                                        |
| -------------------------------------------------------------------- | -------------------------------------------------------------- |
| Formatter phần Auth (`npm run format:check`)                         | PASS                                                           |
| ESLint toàn repo (`npm run lint`)                                    | PASS                                                           |
| TypeScript frontend (`npm run typecheck`)                            | PASS                                                           |
| Syntax backend (`npm --prefix Backend run check`)                    | PASS                                                           |
| Backend HTTP + SQLite (`npm test`)                                   | PASS, 16/16                                                    |
| Frontend/backend production integration (`npm run test:integration`) | PASS, 1/1                                                      |
| Production build frontend                                            | PASS; cần cho phép tải Inter từ Google Fonts khi chưa có cache |
| Migration thực tế và persistence/idempotence/constraints             | PASS                                                           |
| npm audit sau cập nhật dependency tương thích                        | 0 vulnerabilities                                              |
| Browser Chrome desktop                                               | PASS các luồng bên dưới                                        |
| Browser viewport mobile                                              | NOT RUN; layout responsive đã kiểm tra qua mã CSS              |
| Backend build/TypeScript riêng                                       | N/A, JavaScript chạy trực tiếp                                 |

Các test backend bao phủ credentials sai, khóa/ngưng/role chưa kích hoạt, token giả/hết hạn/thu hồi, đổi mật khẩu lần đầu, session rotation, CSRF/validation/rate-limit, grants thay đổi tức thời, scope all/unit/region/facility/empty, list/search/count/dashboard/detail ngoài quyền, lưu cấu hình nguyên tử, admin cuối cùng và audit append-only.

Kiểm tra trực tiếp Chrome bằng DB in-memory dùng dữ liệu giả: thông báo sai mật khẩu; đăng nhập A03; sidebar theo quyền; dashboard có 1 cơ sở; danh sách chỉ CS001/KP01; tìm CS002 có empty state; A03 mở trang cấu hình bị chuyển tới trang từ chối; logout về đăng nhập; A05 vào màn hình cấu hình và tải grants/phạm vi KP01 từ database. Server và tab kiểm thử đã dừng/đóng sau kiểm tra.

Self-check RULES/CHECKLIST: xác thực API, RBAC + phạm vi, server không tin role/scope của client, FK/unique/check/index, transaction và audit trước/sau đều đã kiểm chứng. Các mục upload/import/export, workflow phê duyệt nghiệp vụ, KPI/deadline và chuyển giao cán bộ là N/A cho task này. Mã màn hình mock cũ được giữ nguyên và bị chặn khỏi phiên thật, không mở quyền bằng cách chỉ ẩn nút.

Giới hạn/giả định: Q02 chưa được phê duyệt nên seed chỉ là ma trận mẫu có thể sửa; A07 chưa kích hoạt. Chưa có schema tài khoản/cán bộ/cơ sở chung của các thành viên khác, nên đã cung cấp hợp đồng `accounts` và catalog tích hợp tối thiểu trong README. Không khẳng định các phân hệ nghiệp vụ khác đã hoàn thành hoặc hệ thống đã sẵn sàng production. Cần nối nguồn dữ liệu chung trước khi nhập dữ liệu thật.
