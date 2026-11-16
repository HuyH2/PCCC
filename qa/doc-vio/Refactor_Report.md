# Refactor luồng phê duyệt DOC/VIO — 15/11/2026

Phạm vi: cải thiện khả năng đọc và sửa lỗi trong `pccc-BE/src/core/violations.js`, giữ nguyên API, schema và quy tắc nghiệp vụ.

- Tách `restoreFacilityAfterApproval` khỏi `decideApproval`; dùng các điều kiện trả về sớm để thấy rõ lý do cơ sở chưa được khôi phục.
- `changeFacilityStatus` nhận object có tên trường thay cho chuỗi tham số vị trí; đổi `decision` thành `decisionReference`.
- Đổi trạng thái đích `to` thành `nextStatus`; ghi rõ ranh giới transaction và quan hệ đình chỉ M03/M04.
- Giữ cập nhật trạng thái, audit và lịch sử trong transaction hiện có.

Kiểm chứng sau refactor:

- Format, lint, typecheck, backend syntax check và `git diff --check`: PASS.
- Regression + facility history + legal documents: 18/18 PASS.
- Runner HTTP DOC/VIO: 30/30 PASS; kết quả trong `evidence/results.json` đã được cập nhật.
- Frontend/backend integration: 1/1 PASS trên artifact webpack vừa biên dịch, database thử nghiệm.
- Build mặc định: FAIL do Turbopack không kết nối được tiến trình con trong sandbox.
- Build webpack ngoài sandbox: biên dịch, TypeScript và tạo trang thành công; CLI vẫn exit 1 với `SecurityFatalError` cảnh báo phiên bản Next.js. Chưa nâng dependency trong task refactor.

Self-check phần thay đổi: quyền/scope, trạng thái, transaction, audit và hồi quy PASS qua các test trên. UI thủ công chưa chạy lại. Không tuyên bố build PASS hoặc hoàn tất nghiệm thu toàn hệ thống.

Các snapshot trong `evidence/source`, `fix.patch`, `source-sha256.json`, ZIP và Excel cũ thuộc lần bàn giao trước refactor; không dùng chúng làm snapshot của code hiện tại. Chưa commit/push trong lần refactor này.
