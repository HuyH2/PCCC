# CHECKLIST.md

> Checklist này là **quality gate bắt buộc**. Agent phải tự chạy checklist trước khi báo kết quả cho người dùng.

## A. Task & Scope

- [ ] Tôi đã đọc task hiện tại.
- [ ] Tôi đã đọc `AGENT.md`.
- [ ] Tôi đã đọc `RULES.md`.
- [ ] Tôi đã xác định đúng module / use case bị tác động.
- [ ] Tôi không thêm feature ngoài phạm vi.
- [ ] Tôi không tự quyết định nội dung URD đang ghi "Cần xác nhận".
- [ ] Nếu có giả định, tôi đã ghi rõ.

## B. Requirement Traceability

- [ ] Mỗi thay đổi chính có thể giải thích nó phục vụ requirement/use case nào.
- [ ] Happy path khớp yêu cầu.
- [ ] Alternative/error path liên quan đã được xử lý.
- [ ] Business rule liên quan đã được kiểm tra.
- [ ] Không làm mất behavior cũ ngoài phạm vi task.

## C. Authorization & Security

- [ ] Backend kiểm tra authentication.
- [ ] Backend kiểm tra role permission.
- [ ] Backend kiểm tra data scope.
- [ ] Frontend không phải lớp bảo vệ duy nhất.
- [ ] Search/list/count/dashboard/export không rò rỉ ngoài scope.
- [ ] Không hard-code secret/credential.
- [ ] Không log password/token/nội dung nhạy cảm không cần thiết.
- [ ] Upload/download kiểm quyền.
- [ ] Demo/test data không chứa dữ liệu bị cấm.

## D. Data & Database

- [ ] Schema phù hợp domain.
- [ ] Required field có constraint/validation phù hợp.
- [ ] FK/unique/check constraint đã xem xét.
- [ ] Migration đã được tạo nếu schema thay đổi.
- [ ] Migration chạy được.
- [ ] Không hard-delete dữ liệu cần lịch sử.
- [ ] State transition hợp lệ.
- [ ] Transaction được dùng cho mutation nhiều bước nếu cần.
- [ ] Index cho query quan trọng đã được xem xét.
- [ ] Không tạo dữ liệu duplicate ngoài ý muốn.

## E. Audit & History

- [ ] Thao tác quan trọng có audit log.
- [ ] Audit có actor và timestamp.
- [ ] Chuyển trạng thái có thể truy vết trước/sau khi URD yêu cầu.
- [ ] Dời lịch có lý do + history.
- [ ] Chuyển giao cán bộ giữ lịch sử.
- [ ] Người dùng thường không thể sửa/xóa audit log.

## F. Backend/API

- [ ] Request input được validate.
- [ ] Không tin `userId`, `role`, `scope` do client tự khai nếu server có session/token.
- [ ] Unauthorized / forbidden / not found được xử lý nhất quán.
- [ ] API không trả stack trace hoặc secret.
- [ ] Danh sách lớn có pagination hoặc giải pháp phù hợp.
- [ ] Filter/sort không gây injection.
- [ ] Không có N+1 rõ ràng.
- [ ] Không swallow exception.
- [ ] Không còn response fake/temporary.

## G. Frontend/UI

- [ ] UI dùng API/service thật theo scope task.
- [ ] Có loading state.
- [ ] Có error state.
- [ ] Có empty state.
- [ ] Form có validation.
- [ ] Hiển thị lỗi hữu ích.
- [ ] Action button phản ánh permission.
- [ ] Giao diện không vỡ ở viewport mobile phổ biến.
- [ ] Không còn debug component / placeholder giả.

## H. File / Import / Export

Nếu task liên quan file/import/export:

- [ ] File type được validate.
- [ ] File size được validate/cấu hình.
- [ ] File gắn đúng object.
- [ ] File access có authorization.
- [ ] Import parse thành công.
- [ ] Import validate từng dòng.
- [ ] Có preview trước commit nếu luồng yêu cầu.
- [ ] Dòng lỗi được báo rõ.
- [ ] Duplicate được cảnh báo/xử lý.
- [ ] Import commit có transaction/strategy an toàn.
- [ ] Export chỉ chứa dữ liệu trong scope.
- [ ] Import/export có log khi cần.

## I. Business-rule Specific

Đánh dấu các mục áp dụng:

- [ ] BR-01: Không tạo nguồn số liệu nghiệp vụ song song.
- [ ] BR-02: Thiếu evidence bắt buộc không thể hoàn thành/duyệt.
- [ ] BR-03: Thay đổi quan trọng có history.
- [ ] BR-04: Chỉ tiêu là mức tối thiểu, không chặn số thực hiện vượt chỉ tiêu.
- [ ] BR-05: Nợ chỉ tiêu được giữ qua kỳ.
- [ ] BR-06: Giải trình hỗ trợ đúng actor/flow.
- [ ] BR-07: Deadline alert cấu hình được và dừng khi đóng.
- [ ] BR-08: Dời lịch có lý do/history.
- [ ] BR-09: Khôi phục hoạt động cần đủ hồ sơ + duyệt.
- [ ] BR-10: Thời hạn chứng nhận không hard-code khi chưa chốt.
- [ ] BR-11: Sự cố giữ đủ loại/thời gian/địa điểm.
- [ ] BR-12: Tuân thủ ATTT/dữ liệu demo.

Các mục không liên quan task phải ghi `N/A`, không coi là fail.

## J. Search / Dashboard / Notification

Nếu task liên quan:

- [ ] Search chỉ trả object user được phép xem.
- [ ] Dashboard tính từ source of truth.
- [ ] Metric có định nghĩa thống nhất với drill-down.
- [ ] Count không lộ dữ liệu ngoài scope.
- [ ] Notification đi tới đúng object.
- [ ] User không thể mở deep-link nếu mất quyền.
- [ ] Deadline notification dừng khi record hoàn thành.

## K. Code Quality

- [ ] Code theo convention hiện tại.
- [ ] Tên biến/hàm/class rõ nghĩa.
- [ ] Không duplicate business logic không cần thiết.
- [ ] Không có `TODO` giả để che phần chưa làm.
- [ ] Không có `console.log`/debug print thừa.
- [ ] Không có code comment-out.
- [ ] Không disable lint/type safety vô lý.
- [ ] Không dùng hard-code magic value nếu nên cấu hình.
- [ ] Diff chỉ chứa thay đổi liên quan task.

## L. Automated Verification

Điền kết quả thực tế:

- [ ] Formatter: `PASS / FAIL / NOT RUN / N/A`
- [ ] Lint: `PASS / FAIL / NOT RUN / N/A`
- [ ] Type-check / compile: `PASS / FAIL / NOT RUN / N/A`
- [ ] Unit tests: `PASS / FAIL / NOT RUN / N/A`
- [ ] Integration tests: `PASS / FAIL / NOT RUN / N/A`
- [ ] Build: `PASS / FAIL / NOT RUN / N/A`
- [ ] Migration test: `PASS / FAIL / NOT RUN / N/A`

Nếu có FAIL do code vừa sửa, **không được báo DONE**.

## M. Manual Verification

- [ ] Tôi đã kiểm tra happy path.
- [ ] Tôi đã kiểm tra ít nhất một invalid-input case.
- [ ] Tôi đã kiểm tra unauthorized/forbidden nếu có phân quyền.
- [ ] Tôi đã kiểm tra empty/no-data case nếu có list/dashboard.
- [ ] Tôi đã kiểm tra state transition nếu feature có trạng thái.
- [ ] Tôi đã kiểm tra refresh/reload không làm mất hoặc nhân đôi dữ liệu bất thường.

## N. Regression Check

- [ ] Existing tests liên quan vẫn pass.
- [ ] API contract cũ không bị phá ngoài chủ ý.
- [ ] Schema change không làm hỏng dữ liệu/seed hiện có.
- [ ] Permission cũ không bị mở rộng ngoài ý muốn.
- [ ] UI liên quan vẫn render.
- [ ] Không phát sinh lỗi rõ ràng ở module lân cận.

## O. Final Self-Review

Trước câu trả lời cuối cùng, Agent phải trả lời nội bộ:

- [ ] Tôi đã làm đúng thứ người dùng yêu cầu chưa?
- [ ] Có phần nào tôi chỉ "giả định là hoạt động" mà chưa test không?
- [ ] Có test nào tôi nói PASS nhưng thực tế chưa chạy không?
- [ ] Có dữ liệu ngoài quyền có thể bị truy cập bằng API trực tiếp không?
- [ ] Có thao tác quan trọng nào thiếu audit/history không?
- [ ] Có hard-code nào thuộc nhóm "Cần xác nhận" không?
- [ ] Có file/code nào thừa trong diff không?
- [ ] Nếu tôi là reviewer, tôi có chấp nhận merge thay đổi này không?

Nếu bất kỳ câu trả lời nào cho thấy rủi ro do code của Agent gây ra, Agent phải sửa trước khi báo kết quả.

---

# FINAL REPORT GATE

Agent chỉ được dùng:

`STATUS: DONE`

khi:
- các mục bắt buộc liên quan task đều PASS;
- không còn lỗi build/test do thay đổi hiện tại;
- self-check đã hoàn thành.

Nếu không:

`STATUS: PARTIAL`
hoặc
`STATUS: BLOCKED`

và phải ghi nguyên nhân cụ thể.

Mẫu:

```text
STATUS: DONE

Implemented:
- ...

Files changed:
- ...

Verification:
- Formatter: PASS
- Lint: PASS
- Type-check: PASS
- Tests: PASS
- Build: PASS

Self-check:
- Requirement: PASS
- Authorization: PASS
- Data integrity: PASS
- Audit/history: PASS
- Regression: PASS

Notes:
- None
```
