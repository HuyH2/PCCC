# RULES.md

## 1. Quy tắc tối cao

### R-001 — Bám tài liệu
Chỉ triển khai nghiệp vụ được task, URD hoặc tài liệu dự án hỗ trợ.

### R-002 — Không tự bịa nghiệp vụ
Nội dung được URD đánh dấu **"Cần xác nhận"** không được biến thành quy tắc cứng nếu chưa có xác nhận.

### R-003 — Giữ phạm vi
Không refactor diện rộng hoặc thêm feature ngoài task nếu không cần thiết để hoàn thành task.

### R-004 — Không phá code đang chạy
Mọi thay đổi phải ưu tiên backward compatibility trong phạm vi hợp lý và phải regression-check phần bị ảnh hưởng.

---

## 2. Phân quyền và bảo mật

### R-101 — Authorization phải ở backend
Frontend visibility không thay thế kiểm tra quyền API/service.

### R-102 — RBAC + data scope
Mọi truy vấn/mutation cần áp dụng cả quyền theo vai trò và phạm vi dữ liệu.

### R-103 — Tách quyền
Khi mô hình dự án hỗ trợ, xem / thêm / sửa / duyệt / xuất phải là quyền có thể kiểm soát riêng.

### R-104 — Không rò rỉ dữ liệu
Search, export, dashboard, count, dropdown và notification đều không được lộ dữ liệu ngoài scope.

### R-105 — Secret
Không commit mật khẩu, API key, JWT secret, connection string thật hoặc credential.

### R-106 — ATTT dữ liệu demo
Không đưa dữ liệu mật/bí mật nhà nước vào môi trường demo hoặc hạ tầng chưa được phê duyệt.

---

## 3. Audit, history và lifecycle

### R-201 — Audit thao tác quan trọng
Phải log tối thiểu actor, timestamp, action, object và thông tin thay đổi cần thiết đối với thao tác quan trọng.

### R-202 — Không sửa/xóa audit tùy tiện
Người dùng nghiệp vụ thông thường không có quyền sửa/xóa log.

### R-203 — Không hard-delete hồ sơ có lịch sử
Dùng inactive/closed/effective period/soft-delete tương thích với domain.

### R-204 — Chuyển giao phải giữ lịch sử
Thay cán bộ phụ trách chỉ thay current assignment; lịch sử cũ vẫn truy vết được.

### R-205 — State transition phải validate
Không cho phép nhảy trạng thái trái quy trình.

---

## 4. Quy tắc feature nghiệp vụ

### R-301 — Evidence
Nếu trạng thái yêu cầu tài liệu bắt buộc thì thiếu tài liệu phải chặn hoàn thành/duyệt.

### R-302 — Reschedule
Dời lịch phải có lý do và lịch sử thay đổi.

### R-303 — Restore facility
Cơ sở đình chỉ chỉ được chuyển hoạt động lại khi điều kiện hồ sơ và phê duyệt đều thỏa.

### R-304 — Deadline
Cảnh báo deadline phải dựa trên cấu hình; dừng nhắc khi record đã hoàn thành/đóng.

### R-305 — KPI debt
Không xóa phần chỉ tiêu thiếu khỏi thống kê; phải giữ cho đến khi xử lý/điều chỉnh.

### R-306 — Certificate
Không hard-code thời hạn chưa được xác nhận chính thức; thiết kế configurable.

### R-307 — Incident
Sự cố phải giữ tối thiểu loại, thời điểm và địa điểm theo URD.

---

## 5. Database

### R-401 — Migration
Mọi thay đổi schema phải có migration theo convention repository.

### R-402 — Constraint
Dùng DB constraint cho những invariant phù hợp: FK, unique, non-null, enum/check khi hợp lý.

### R-403 — Transaction
Chuỗi ghi dữ liệu nhiều bước có tính nguyên tử phải dùng transaction.

### R-404 — Index
Thêm index cho field được filter/search/join thường xuyên nếu cần; tránh index dư thừa.

### R-405 — Không chỉnh migration cũ đã phát hành
Tạo migration mới trừ khi repo đang ở trạng thái prototype và quy ước dự án cho phép sửa.

### R-406 — Seed
Seed/demo data phải rõ là dữ liệu mẫu, idempotent nếu repository yêu cầu.

---

## 6. API / Backend

### R-501 — Validate input
Không tin dữ liệu client.

### R-502 — Validate authorization trước mutation
Không cập nhật rồi mới kiểm quyền.

### R-503 — Error semantics
Trả lỗi nhất quán; không trả stack trace hoặc thông tin nhạy cảm cho client.

### R-504 — Idempotency khi hợp lý
Các thao tác có nguy cơ submit lặp phải tránh tạo bản ghi duplicate.

### R-505 — Pagination
Danh sách có khả năng lớn phải hỗ trợ pagination hoặc chiến lược tương đương.

### R-506 — Filter/sort
Chỉ cho phép field filter/sort hợp lệ, không build raw SQL từ input.

### R-507 — N+1
Không tạo truy vấn N+1 rõ ràng trên danh sách lớn.

---

## 7. Frontend

### R-601 — Không mock khi feature cần dữ liệu thật
Không hard-code array để giả vờ API đã hoàn thành.

### R-602 — Loading/error/empty state
Các màn hình lấy dữ liệu phải xử lý đủ trạng thái.

### R-603 — Permission-aware UI
Ẩn/disable thao tác người dùng không có quyền, nhưng backend vẫn phải bảo vệ.

### R-604 — Form validation
Client validation để UX tốt; server validation vẫn bắt buộc.

### R-605 — Responsive
Màn hình chính phải sử dụng được trên desktop và thiết bị di động theo NFR.

### R-606 — Accessible basics
Label, focus, keyboard và feedback lỗi phải được giữ ở mức hợp lý.

---

## 8. Import / Export / File

### R-701 — Import phải preview
Không commit file import trước bước validate/preview/xác nhận nếu feature thiết kế cho người dùng xác nhận.

### R-702 — Import error reporting
Dòng lỗi phải xác định được và không làm mất toàn bộ thông tin lỗi.

### R-703 — Duplicate
Áp dụng quy tắc phát hiện trùng phù hợp domain; với cơ sở URD yêu cầu cảnh báo trùng theo tên + địa chỉ.

### R-704 — Export obeys scope
Không export dữ liệu người dùng không được xem.

### R-705 — File validation
Kiểm tra file type, size, authorization và metadata.

### R-706 — Secure file access
Không cấp đường dẫn bypass permission.

---

## 9. Search, dashboard và notification

### R-801 — Search obeys scope
Kết quả search phải lọc theo quyền.

### R-802 — Dashboard source of truth
Dashboard lấy số liệu từ dữ liệu nghiệp vụ thật, không duy trì bảng số liệu thủ công song song nếu không có thiết kế rõ.

### R-803 — Drill-down consistency
Số trên dashboard và danh sách drill-down phải dùng cùng định nghĩa/filter nghiệp vụ.

### R-804 — Notification link permission
User chỉ mở được hồ sơ từ chuông nếu vẫn có quyền với hồ sơ đó.

---

## 10. Code quality

### R-901 — Theo convention repository
Không áp đặt kiến trúc mới nếu project đã có pattern hợp lý.

### R-902 — Tên rõ nghĩa
Không dùng tên mơ hồ như `data1`, `temp2`, `handleStuff`.

### R-903 — Hàm/class có trách nhiệm rõ
Tránh god class/god service.

### R-904 — Không duplicate logic nghiệp vụ
Business rule dùng nhiều nơi phải được gom vào layer phù hợp.

### R-905 — Không dead code
Không để code comment-out, debug print hoặc temporary bypass.

### R-906 — Không suppress lỗi vô cớ
Không disable lint/type-check/test chỉ để pass pipeline.

### R-907 — Không over-engineer
Giải pháp phải phù hợp đồ án và quy mô hiện tại, đồng thời giữ khả năng mở rộng hợp lý.

---

## 11. Testing

### R-1001 — Feature mới phải có test
Ít nhất test logic nghiệp vụ quan trọng và lỗi/edge case liên quan.

### R-1002 — Permission tests
Feature có phân quyền phải có test unauthorized/forbidden hoặc tương đương.

### R-1003 — Regression
Bug fix phải có regression test nếu framework cho phép.

### R-1004 — Không sửa test để che bug
Chỉ sửa expected behavior khi requirement thay đổi có căn cứ.

### R-1005 — Chạy test thật
Không tuyên bố PASS dựa trên đọc code.

---

## 12. Self-check gate

Trước khi trả kết quả:

1. đọc lại task;
2. kiểm `git diff` hoặc tập hợp file đã thay đổi;
3. chạy checklist;
4. chạy formatter/lint/typecheck/test/build;
5. sửa lỗi;
6. chạy lại;
7. chỉ sau đó mới báo kết quả.

Nếu một mục kiểm tra không áp dụng, ghi `N/A`.
Nếu chưa chạy được, ghi `NOT RUN`, không ghi `PASS`.

**Agent không được báo DONE trước khi hoàn thành self-check gate.**
