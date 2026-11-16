# Review DOC/VIO ngày 16/11/2026

Nhánh: `test/legal-document-violation-remediation`. Phạm vi: BUG011–014, test hồi quy và bộ QA DOC/VIO. Chưa merge.

## Thay đổi

1. Kiểm tra cán bộ theo dõi tồn tại trước khi tạo/cập nhật vi phạm.
2. Chặn sửa quyết định đình chỉ khi hồ sơ đã hoàn thành.
3. Ghi trạng thái cơ sở, audit và lịch sử trong cùng transaction. Không khôi phục cơ sở nếu còn đình chỉ M03/M04 đang mở.
4. Tách khôi phục cơ sở thành helper có điều kiện trả về sớm và biến `restoredStatus`; gộp nhánh kiểm tra đình chỉ M03, đặt tên truy vấn rõ nghĩa.
5. Đổi tên helper test thành `createFixture`, `createTestViolation`, `createPendingSuspension`, `approveViolation`. Sửa lỗi thay nhầm chữ trong Markdown của runner và sắp xếp case theo ID.

Giữ API, schema và ma trận quyền hiện tại. Không sửa database local hoặc seed lại dữ liệu người dùng. Các quyền M04 trong fixture chỉ phục vụ kiểm thử.

## Kiểm chứng local

| Kiểm tra                     | Kết quả                                                         | Minh chứng                                         |
| ---------------------------- | --------------------------------------------------------------- | -------------------------------------------------- |
| Hồi quy BUG011–014           | 7/7 PASS                                                        | `evidence/review-regression.tap`                   |
| HTTP DOC/VIO                 | 34/34 PASS                                                      | `evidence/results.json`, `evidence/review-api.log` |
| Backend đầy đủ               | 170/170 PASS (concurrency=2)                                    | `evidence/review-backend-rerun.tap`                |
| Lint                         | PASS                                                            | `evidence/review-lint.log`                         |
| Backend syntax               | PASS                                                            | `evidence/review-check.log`                        |
| Typecheck                    | PASS                                                            | `evidence/review-typecheck.log`                    |
| Format                       | PASS, gồm kiểm trực tiếp các file JS/MJS thay đổi               | `evidence/review-format.log`                       |
| Frontend/backend integration | 1/1 PASS trên artifact webpack vừa biên dịch                    | `evidence/review-integration.tap`                  |
| Build webpack                | FAIL: CLI exit 1 do `SecurityFatalError` của dependency Next.js | `evidence/review-build.log`                        |

Build đã compile, typecheck và tạo 45 trang, nhưng không được coi là PASS. Cần xử lý dependency và build lại trước merge. Không nâng dependency trong bản sửa DOC/VIO này.

Lần backend chạy song song mặc định đạt 169/170, test export gặp `fetch failed`; giữ log gốc trong `review-backend.tap`. Lần chạy lại với concurrency=2 đạt 170/170, bao gồm test export đã lỗi kết nối ở lần trước. Các lần bị sandbox chặn localhost không phải bằng chứng lỗi nghiệp vụ.

HTTP runner ghi HEAD nền trong `results.json`; lần chạy kiểm tra working tree đã sửa, không khẳng định HEAD nền chứa bản sửa. Commit bàn giao chứa source, test và bằng chứng đi kèm.

## Bàn giao và self-check

- [Excel và ảnh thủ công](handoff/README.md) là bộ bàn giao mới nhất. Các báo cáo retest/refactor trước ngày này là lịch sử.
- Quyền/scope, trạng thái, audit và rollback được kiểm bằng test hồi quy và HTTP. Không thêm migration.
- Không thay assertion để làm test xanh. Kiểm thử trên PGlite local, chưa kiểm tải hoặc nhiều server PostgreSQL đồng thời.
- Chưa nghiệm thu toàn hệ thống. Sau push, review nhánh và giải quyết build trước khi merge.
